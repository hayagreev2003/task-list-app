"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isTaskStatus, TASK_STATUSES, validateTaskInput } from "@/lib/tasks/validation";

export type TaskFormState = {
  errors?: string[];
  /** Submitted values, echoed back so the form keeps them after a failed save. */
  values?: Record<string, string>;
  /** Changes on every successful save so the form can reset. */
  savedAt?: number;
};

export type TaskActionResult = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUPLICATE_MESSAGE = "A task with this title and due date already exists.";
const GENERIC_MESSAGE = "Something went wrong saving the task. Please try again.";

function readForm(formData: FormData) {
  const values = {
    title: String(formData.get("title") ?? ""),
    due_date: String(formData.get("due_date") ?? ""),
    priority: String(formData.get("priority") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    status: String(formData.get("status") ?? "todo"),
  };
  const result = validateTaskInput(values);
  const errors = result.ok ? [] : [...result.errors];
  if (!isTaskStatus(values.status)) errors.push(`status must be one of: ${TASK_STATUSES.join(", ")}`);
  if (!result.ok || errors.length > 0) return { ok: false as const, errors, values };
  return { ok: true as const, task: { ...result.value, status: values.status as (typeof TASK_STATUSES)[number] }, values };
}

function saveError(error: { code?: string; message: string }, values: Record<string, string>): TaskFormState {
  if (error.code === "23505") return { errors: [DUPLICATE_MESSAGE], values };
  console.error("task save failed", { code: error.code, message: error.message });
  return { errors: [GENERIC_MESSAGE], values };
}

export async function createTask(_prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const { supabase } = await requireUser();
  const form = readForm(formData);
  if (!form.ok) return { errors: form.errors, values: form.values };

  const { error } = await supabase.from("tasks").insert(form.task);
  if (error) return saveError(error, form.values);

  revalidatePath("/tasks");
  return { savedAt: Date.now() };
}

export async function updateTask(id: string, _prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const { supabase } = await requireUser();
  if (!UUID.test(id)) return { errors: ["Task not found."] };
  const form = readForm(formData);
  if (!form.ok) return { errors: form.errors, values: form.values };

  const { data, error } = await supabase
    .from("tasks")
    .update(form.task)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return saveError(error, form.values);
  if (data.length === 0) return { errors: ["Task not found."], values: form.values };

  revalidatePath("/tasks");
  return { savedAt: Date.now() };
}

async function updateOne(id: string, patch: { status?: "todo" | "done"; deleted_at?: string }): Promise<TaskActionResult> {
  const { supabase } = await requireUser();
  if (!UUID.test(id)) return { error: "Task not found." };

  const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).is("deleted_at", null).select("id");
  if (error) {
    console.error("task update failed", { code: error.code, message: error.message });
    return { error: GENERIC_MESSAGE };
  }
  if (data.length === 0) return { error: "Task not found." };

  revalidatePath("/tasks");
  return {};
}

export async function setCompleted(id: string, completed: boolean): Promise<TaskActionResult> {
  return updateOne(id, { status: completed ? "done" : "todo" });
}

/** Soft delete: the row stays in the database with deleted_at set. */
export async function deleteTask(id: string): Promise<TaskActionResult> {
  return updateOne(id, { deleted_at: new Date().toISOString() });
}

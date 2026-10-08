"use client";

import { useState, useTransition } from "react";
import { deleteTask, setCompleted, updateTask, type TaskFormState } from "@/app/tasks/actions";
import type { Task } from "@/lib/tasks/queries";
import { STATUS_LABELS, type TaskStatus } from "@/lib/tasks/validation";
import { TaskForm } from "./TaskForm";

type Mode = "view" | "edit" | "confirm-delete";

export function TaskItem({ task }: { task: Task }) {
  const [mode, setMode] = useState<Mode>("view");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const done = task.status === "done";

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  if (mode === "edit") {
    const save = async (prev: TaskFormState, formData: FormData) => {
      const result = await updateTask(task.id, prev, formData);
      if (result.savedAt) setMode("view");
      return result;
    };
    return (
      <li className="task editing">
        <TaskForm action={save} task={task} submitLabel="Save" onCancel={() => setMode("view")} />
      </li>
    );
  }

  return (
    <li className={`task${done ? " done" : ""}`} aria-busy={pending}>
      <input
        type="checkbox"
        checked={done}
        disabled={pending}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        onChange={() => run(() => setCompleted(task.id, !done))}
      />
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        {task.notes ? <div className="task-notes">{task.notes}</div> : null}
        <div className="task-meta">
          <span>Due {task.due_date}</span>
          <span>Priority {task.priority}</span>
          <span className={`badge status-${task.status}`}>{STATUS_LABELS[task.status as TaskStatus]}</span>
        </div>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
      </div>
      <div className="task-actions">
        {mode === "confirm-delete" ? (
          <>
            <span>Delete this task?</span>
            <button type="button" className="danger" disabled={pending} onClick={() => run(() => deleteTask(task.id))}>
              Delete
            </button>
            <button type="button" className="secondary" onClick={() => setMode("view")}>
              Keep
            </button>
          </>
        ) : (
          <>
            <button type="button" className="secondary" onClick={() => setMode("edit")}>
              Edit
            </button>
            <button type="button" className="secondary" onClick={() => setMode("confirm-delete")}>
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

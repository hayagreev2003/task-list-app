"use client";

import { useActionState, useId } from "react";
import type { TaskFormState } from "@/app/tasks/actions";
import type { Task } from "@/lib/tasks/queries";
import { NOTES_MAX_LENGTH, STATUS_LABELS, TASK_STATUSES, TITLE_MAX_LENGTH } from "@/lib/tasks/validation";

type Props = {
  action: (prev: TaskFormState, formData: FormData) => Promise<TaskFormState>;
  task?: Task;
  submitLabel: string;
  onCancel?: () => void;
};

const initialState: TaskFormState = {};

export function TaskForm({ action, task, submitLabel, onCancel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const id = useId();
  // After a failed save, show what the user typed; otherwise the task's values (or blanks).
  const value = (field: keyof Task, fallback = "") =>
    state.values?.[field] ?? (task ? String(task[field] ?? "") : fallback);

  return (
    <form action={formAction} className="task-form" aria-describedby={state.errors ? `${id}-errors` : undefined}>
      <label className="grow">
        Title
        <input name="title" required maxLength={TITLE_MAX_LENGTH} defaultValue={value("title")} />
      </label>
      <label>
        Due date
        <input name="due_date" type="date" required defaultValue={value("due_date")} />
      </label>
      <label>
        Priority
        <select name="priority" defaultValue={value("priority", "3")}>
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select name="status" defaultValue={value("status", "todo")}>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="full">
        Notes
        <textarea name="notes" rows={2} maxLength={NOTES_MAX_LENGTH} defaultValue={value("notes")} />
      </label>
      {state.errors ? (
        <ul id={`${id}-errors`} role="alert" className="error full">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      <div className="row full">
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

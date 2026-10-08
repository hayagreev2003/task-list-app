"use client";

import { useState, useTransition } from "react";
import { deleteTask, setCompleted, updateTask, type TaskFormState } from "@/app/tasks/actions";
import type { Task } from "@/lib/tasks/queries";
import { STATUS_LABELS, type TaskStatus } from "@/lib/tasks/validation";
import { DueDate } from "./DueDate";
import { AlertIcon, CheckIcon, PencilIcon, TrashIcon } from "./icons";
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
        <TaskForm action={save} task={task} submitLabel="Save changes" onCancel={() => setMode("view")} />
      </li>
    );
  }

  return (
    <li className={`task priority-${task.priority}${done ? " done" : ""}`} aria-busy={pending}>
      <label className="check">
        <input
          type="checkbox"
          checked={done}
          disabled={pending}
          aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          onChange={() => run(() => setCompleted(task.id, !done))}
        />
        <span className="check-box" aria-hidden="true">
          <CheckIcon />
        </span>
      </label>
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        {task.notes ? <div className="task-notes">{task.notes}</div> : null}
        <div className="task-meta">
          <DueDate date={task.due_date} done={done} />
          <span className={`pill priority-pill p${task.priority}`} title={`Priority ${task.priority} (1 is highest)`}>
            <span aria-hidden="true">P{task.priority}</span>
            <span className="sr-only">Priority {task.priority}</span>
          </span>
          <span className={`pill status-pill status-${task.status}`}>{STATUS_LABELS[task.status as TaskStatus]}</span>
        </div>
        {error ? (
          <p role="alert" className="error inline-error">
            <AlertIcon /> {error}
          </p>
        ) : null}
      </div>
      <div className="task-actions">
        {mode === "confirm-delete" ? (
          <div className="confirm" role="group" aria-label="Confirm delete">
            <span>Delete this task?</span>
            <button type="button" className="danger small" disabled={pending} onClick={() => run(() => deleteTask(task.id))}>
              Delete
            </button>
            <button type="button" className="secondary small" onClick={() => setMode("view")}>
              Keep
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="icon-button"
              aria-label={`Edit "${task.title}"`}
              title="Edit"
              onClick={() => setMode("edit")}
            >
              <PencilIcon />
            </button>
            <button
              type="button"
              className="icon-button icon-button-danger"
              aria-label={`Delete "${task.title}"`}
              title="Delete"
              onClick={() => setMode("confirm-delete")}
            >
              <TrashIcon />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

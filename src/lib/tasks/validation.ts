// Single source of truth for task field rules, shared by the task form and CSV import (R6).

export const TITLE_MAX_LENGTH = 200;
export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export type TaskInput = {
  title: string;
  due_date: string;
  priority: number;
  notes: string | null;
};

export type RawTaskInput = {
  title?: unknown;
  due_date?: unknown;
  priority?: unknown;
  notes?: unknown;
};

export type ValidationResult =
  | { ok: true; value: TaskInput }
  | { ok: false; errors: string[] };

export const MESSAGES = {
  titleRequired: "title is required",
  titleTooLong: `title must be ${TITLE_MAX_LENGTH} characters or fewer`,
  dueDateRequired: "due_date is required",
  dueDateInvalid: "due_date must be a real date in YYYY-MM-DD format",
  priorityRequired: "priority is required",
  priorityInvalid: "priority must be a whole number from 1 to 5",
} as const;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const PRIORITY_PATTERN = /^[1-5]$/;

function asTrimmedString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** True when `value` is YYYY-MM-DD and names a day that exists on the calendar. */
export function isValidIsoDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  // Year 0 doesn't exist in Postgres's (proleptic Gregorian, AD) date type.
  if (year < 1) return false;
  const date = new Date(0);
  // setUTCFullYear avoids Date.UTC's 0–99 → 1900–1999 mapping.
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Validates every field and returns all failure reasons, not just the first. */
export function validateTaskInput(raw: RawTaskInput): ValidationResult {
  const errors: string[] = [];

  const title = asTrimmedString(raw.title);
  if (title === "") errors.push(MESSAGES.titleRequired);
  else if ([...title].length > TITLE_MAX_LENGTH) errors.push(MESSAGES.titleTooLong);

  const dueDate = asTrimmedString(raw.due_date);
  if (dueDate === "") errors.push(MESSAGES.dueDateRequired);
  else if (!isValidIsoDate(dueDate)) errors.push(MESSAGES.dueDateInvalid);

  const priorityText = asTrimmedString(raw.priority);
  if (priorityText === "") errors.push(MESSAGES.priorityRequired);
  else if (!PRIORITY_PATTERN.test(priorityText)) errors.push(MESSAGES.priorityInvalid);

  if (errors.length > 0) return { ok: false, errors };

  const notes = asTrimmedString(raw.notes);
  return {
    ok: true,
    value: {
      title,
      due_date: dueDate,
      priority: Number(priorityText),
      notes: notes === "" ? null : notes,
    },
  };
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

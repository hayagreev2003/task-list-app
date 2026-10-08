/**
 * Duplicate key: title trimmed and lower-cased, plus due date.
 * Mirrors the database's unique index on (user_id, lower(title), due_date).
 */
export function dedupeKey(title: string, dueDate: string): string {
  return `${title.trim().toLowerCase()}\u0000${dueDate}`;
}

type Dedupable = { rowNumber: number; task: { title: string; due_date: string } };

/** Splits rows into first occurrences and later copies (each pointing at the first). */
export function findInFileDuplicates<T extends Dedupable>(items: T[]) {
  const firstRowByKey = new Map<string, number>();
  const unique: T[] = [];
  const duplicates: { item: T; firstRowNumber: number }[] = [];

  for (const item of items) {
    const key = dedupeKey(item.task.title, item.task.due_date);
    const firstRowNumber = firstRowByKey.get(key);
    if (firstRowNumber === undefined) {
      firstRowByKey.set(key, item.rowNumber);
      unique.push(item);
    } else {
      duplicates.push({ item, firstRowNumber });
    }
  }

  return { unique, duplicates };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isTaskStatus, TASK_STATUSES, type TaskStatus } from "./validation";

export const LIST_LIMIT = 500;

export type Task = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "id" | "title" | "notes" | "due_date" | "priority" | "status"
>;

export type TaskFilters = { q: string; status: TaskStatus | null; priority: number | null };

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

/** Reads filters from URL search params, ignoring anything invalid. */
export function parseFilters(params: SearchParams): TaskFilters {
  const q = first(params.q).trim().slice(0, 200);
  const status = first(params.status);
  const priority = first(params.priority);
  return {
    q,
    status: isTaskStatus(status) ? status : null,
    priority: /^[1-5]$/.test(priority) ? Number(priority) : null,
  };
}

export const hasActiveFilters = (f: TaskFilters) => Boolean(f.q || f.status || f.priority);

/**
 * Builds a PostgREST `or` filter for a case-insensitive substring match on title and notes.
 * Uses `imatch` (Postgres `~*`) rather than `ilike`, because PostgREST turns every `*` in an
 * `ilike` value into `%` and offers no way to escape it. Regex metacharacters in the search text
 * are escaped so they match literally, and the value is double-quoted so commas and parentheses
 * can't break out of the filter syntax.
 */
export function searchFilter(q: string): string {
  const regexEscaped = q.replace(/[\\^$.*+?()[\]{}|]/g, (c) => `\\${c}`);
  const quoted = `"${regexEscaped.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
  return `title.imatch.${quoted},notes.imatch.${quoted}`;
}

type Client = SupabaseClient<Database>;

/**
 * Live (not deleted) tasks for the signed-in user, up to LIST_LIMIT; RLS scopes rows to that user.
 * `truncated` is true only when more matching tasks exist.
 */
export async function listTasks(
  supabase: Client,
  filters: TaskFilters,
): Promise<{ tasks: Task[]; truncated: boolean }> {
  let query = supabase
    .from("tasks")
    .select("id, title, notes, due_date, priority, status")
    .is("deleted_at", null);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.q) query = query.or(searchFilter(filters.q));

  const { data, error } = await query
    .order("due_date", { ascending: true })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    // One extra row tells "exactly LIST_LIMIT" apart from "more than LIST_LIMIT".
    .limit(LIST_LIMIT + 1);

  if (error) throw new Error(`Could not load tasks: ${error.message}`);
  return { tasks: data.slice(0, LIST_LIMIT), truncated: data.length > LIST_LIMIT };
}

export async function countLiveTasks(supabase: Client): Promise<number> {
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (error) throw new Error(`Could not count tasks: ${error.message}`);
  return count ?? 0;
}

export type StatusCounts = Record<TaskStatus, number> & { all: number };

/**
 * Live task counts per status, honouring the search and priority filters but not the status
 * filter, so each status tab shows how many tasks selecting it would list.
 */
export async function countTasksByStatus(supabase: Client, filters: TaskFilters): Promise<StatusCounts> {
  const results = await Promise.all(
    TASK_STATUSES.map(async (status) => {
      let query = supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", status);
      if (filters.priority) query = query.eq("priority", filters.priority);
      if (filters.q) query = query.or(searchFilter(filters.q));
      const { count, error } = await query;
      if (error) throw new Error(`Could not count tasks: ${error.message}`);
      return [status, count ?? 0] as const;
    }),
  );
  const counts = Object.fromEntries(results) as Record<TaskStatus, number>;
  return { ...counts, all: results.reduce((sum, [, n]) => sum + n, 0) };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isTaskStatus, type TaskStatus } from "./validation";

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
 * LIKE wildcards in the search text are escaped so they match literally, and the value is
 * double-quoted so commas and parentheses can't break out of the filter syntax.
 */
export function searchFilter(q: string): string {
  const likeEscaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const quoted = `"${`%${likeEscaped}%`.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
  return `title.ilike.${quoted},notes.ilike.${quoted}`;
}

type Client = SupabaseClient<Database>;

/** Live (not deleted) tasks for the signed-in user; RLS scopes rows to that user. */
export async function listTasks(supabase: Client, filters: TaskFilters): Promise<Task[]> {
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
    .limit(LIST_LIMIT);

  if (error) throw new Error(`Could not load tasks: ${error.message}`);
  return data;
}

export async function countLiveTasks(supabase: Client): Promise<number> {
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (error) throw new Error(`Could not count tasks: ${error.message}`);
  return count ?? 0;
}

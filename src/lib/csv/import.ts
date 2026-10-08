import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { validateTaskInput, type TaskInput } from "@/lib/tasks/validation";
import { parseCsv } from "./parse";
import type { RejectedRow } from "./types";

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_DATA_ROWS = 5000;

export const ALREADY_EXISTS = "already exists in your tasks";
export const duplicateOfRow = (rowNumber: number) => `duplicate of row ${rowNumber}`;

export type ImportCandidate = { rowNumber: number; cells: string[]; task: TaskInput };

export type ImportPlan = {
  headers: string[];
  candidates: ImportCandidate[];
  rejected: RejectedRow[];
  blankSkipped: number;
};

export type ImportResult =
  | {
      ok: true;
      imported: number;
      blankSkipped: number;
      headers: string[];
      rejected: RejectedRow[];
    }
  | { ok: false; error: string };

const byRowNumber = (a: { rowNumber: number }, b: { rowNumber: number }) => a.rowNumber - b.rowNumber;

/**
 * Pure part of the import: parse and validate every row. Duplicates (in the file or against
 * existing tasks) are left to the database, whose lower() defines what counts as the same title.
 */
export function planImport(text: string): { ok: true; plan: ImportPlan } | { ok: false; error: string } {
  const parsed = parseCsv(text);
  if (!parsed.ok) return parsed;

  if (parsed.rows.length > MAX_DATA_ROWS) {
    return {
      ok: false,
      error: `The file has ${parsed.rows.length} rows. The limit is ${MAX_DATA_ROWS}.`,
    };
  }

  const rejected: RejectedRow[] = [];
  const valid: ImportCandidate[] = [];
  for (const row of parsed.rows) {
    const result = validateTaskInput(row.fields);
    if (result.ok) valid.push({ rowNumber: row.rowNumber, cells: row.cells, task: result.value });
    else rejected.push({ rowNumber: row.rowNumber, cells: row.cells, reasons: result.errors });
  }

  return {
    ok: true,
    plan: {
      headers: parsed.headers,
      candidates: valid,
      rejected,
      blankSkipped: parsed.blankSkipped,
    },
  };
}

type ImportRpcResult = {
  inserted: number;
  skipped_row_numbers: number[];
  duplicates: { row_number: number; first_row_number: number }[];
};

const isInt = (value: unknown): value is number => Number.isInteger(value);

/** The RPC returns untyped JSON; check its shape so a changed function fails loudly, not silently. */
function parseRpcResult(data: unknown): ImportRpcResult {
  const r = data as Partial<Record<keyof ImportRpcResult, unknown>> | null;
  if (
    r &&
    isInt(r.inserted) &&
    Array.isArray(r.skipped_row_numbers) &&
    r.skipped_row_numbers.every(isInt) &&
    Array.isArray(r.duplicates) &&
    r.duplicates.every((d) => d && isInt(d.row_number) && isInt(d.first_row_number))
  ) {
    return r as ImportRpcResult;
  }
  throw new Error("import_tasks returned an unexpected result");
}

/**
 * Full import as the signed-in user: plan in TypeScript, then insert every valid row in one
 * database call (one transaction). Rows that repeat an earlier row or clash with an existing live
 * task come back as skipped.
 */
export async function runImport(supabase: SupabaseClient<Database>, text: string): Promise<ImportResult> {
  const planned = planImport(text);
  if (!planned.ok) return planned;
  const { plan } = planned;

  let imported = 0;
  const rejected = [...plan.rejected];

  if (plan.candidates.length > 0) {
    const rows = plan.candidates.map((c) => ({ row_number: c.rowNumber, ...c.task }));
    const { data, error } = await supabase.rpc("import_tasks", { rows });
    if (error) {
      console.error("import_tasks failed", { code: error.code, message: error.message });
      return { ok: false, error: "The import failed and no rows were saved. Please try again." };
    }
    const result = parseRpcResult(data);
    imported = result.inserted;
    const skipped = new Set(result.skipped_row_numbers);
    const firstRowOf = new Map(result.duplicates.map((d) => [d.row_number, d.first_row_number]));
    for (const candidate of plan.candidates) {
      if (!skipped.has(candidate.rowNumber)) continue;
      const firstRow = firstRowOf.get(candidate.rowNumber);
      const reason = firstRow === undefined ? ALREADY_EXISTS : duplicateOfRow(firstRow);
      rejected.push({ rowNumber: candidate.rowNumber, cells: candidate.cells, reasons: [reason] });
    }
  }

  return {
    ok: true,
    imported,
    blankSkipped: plan.blankSkipped,
    headers: plan.headers,
    rejected: rejected.sort(byRowNumber),
  };
}

import Papa from "papaparse";
import type { RejectedRow } from "./types";

/** Builds the downloadable rejects file: row_number, the original columns, then reason. */
export function buildRejectsCsv(headers: string[], rejected: RejectedRow[]): string {
  const data = rejected.map((row) => {
    const cells = headers.map((_, index) => row.cells[index] ?? "");
    return [String(row.rowNumber), ...cells, row.reasons.join("; ")];
  });
  return Papa.unparse({ fields: ["row_number", ...headers, "reason"], data }, { newline: "\r\n" });
}

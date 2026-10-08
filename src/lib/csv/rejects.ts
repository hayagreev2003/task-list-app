import Papa from "papaparse";
import type { RejectedRow } from "./types";

/**
 * Builds the downloadable rejects file: row_number, the original columns, then reason.
 * Cells starting with = + - @ (tab or CR) get a leading ' so spreadsheets show them as text
 * rather than running them as formulae. parseCsv strips that ' again, so a corrected rejects file
 * can be imported as is.
 */
export function buildRejectsCsv(headers: string[], rejected: RejectedRow[]): string {
  const data = rejected.map((row) => {
    const cells = headers.map((_, index) => row.cells[index] ?? "");
    return [String(row.rowNumber), ...cells, row.reasons.join("; ")];
  });
  return Papa.unparse({ fields: ["row_number", ...headers, "reason"], data }, { newline: "\r\n", escapeFormulae: true });
}

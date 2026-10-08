import Papa from "papaparse";
import { KNOWN_COLUMNS, REQUIRED_COLUMNS, type CsvColumn, type ParseResult, type ParsedRow } from "./types";

const BOM = "﻿";

function isBlank(cells: string[]): boolean {
  return cells.every((cell) => cell.trim() === "");
}

/**
 * Parses CSV text into rows keyed by known column.
 * Row numbers count every record (blank ones included), so they match what a spreadsheet shows
 * even when a quoted cell spans several lines.
 */
export function parseCsv(input: string): ParseResult {
  const withoutBom = input.startsWith(BOM) ? input.slice(BOM.length) : input;
  // Normalise line endings so files mixing CRLF and LF parse consistently.
  const text = withoutBom.replace(/\r\n?/g, "\n");
  if (text.trim() === "") return { ok: false, error: "The file is empty." };

  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: false, newline: "\n" });

  const quoteError = parsed.errors.find((e) => e.type === "Quotes");
  if (quoteError) {
    const row = quoteError.row === undefined ? "" : ` near row ${quoteError.row + 1}`;
    return { ok: false, error: `The file has an unclosed quote${row}, so it can't be read reliably.` };
  }

  const records = parsed.data;
  // A trailing newline yields one final empty record; it isn't a row.
  const last = records.at(-1);
  if (records.length > 1 && last && last.length === 1 && last[0] === "") records.pop();

  // Skip any blank lines before the header.
  const headerIndex = records.findIndex((cells) => !isBlank(cells));
  if (headerIndex === -1) return { ok: false, error: "The file is empty." };

  const headers = records[headerIndex].map((h) => h.trim());
  const columnIndex = new Map<CsvColumn, number>();
  headers.forEach((header, index) => {
    const key = header.toLowerCase() as CsvColumn;
    if ((KNOWN_COLUMNS as readonly string[]).includes(key) && !columnIndex.has(key)) {
      columnIndex.set(key, index);
    }
  });

  const missing = REQUIRED_COLUMNS.filter((column) => !columnIndex.has(column));
  if (missing.length > 0) {
    const label = missing.length === 1 ? "column" : "columns";
    return {
      ok: false,
      error: `Missing required ${label}: ${missing.join(", ")}. Expected columns: ${KNOWN_COLUMNS.join(", ")}.`,
    };
  }

  const rows: ParsedRow[] = [];
  let blankSkipped = 0;
  for (let i = headerIndex + 1; i < records.length; i++) {
    const cells = records[i];
    if (isBlank(cells)) {
      blankSkipped++;
      continue;
    }
    const cellAt = (column: CsvColumn) => {
      const index = columnIndex.get(column);
      return index === undefined ? "" : (cells[index] ?? "");
    };
    rows.push({
      rowNumber: i + 1,
      cells,
      fields: {
        title: cellAt("title"),
        due_date: cellAt("due_date"),
        priority: cellAt("priority"),
        notes: cellAt("notes"),
      },
    });
  }

  return { ok: true, headers, rows, blankSkipped };
}

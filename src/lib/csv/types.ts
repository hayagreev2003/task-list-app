export const REQUIRED_COLUMNS = ["title", "due_date", "priority"] as const;
export const OPTIONAL_COLUMNS = ["notes"] as const;
export const KNOWN_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS] as const;
export type CsvColumn = (typeof KNOWN_COLUMNS)[number];

export type CsvFields = Record<CsvColumn, string>;

export type ParsedRow = {
  /** Spreadsheet row number: the header is row 1. */
  rowNumber: number;
  /** Original cells, aligned with the file's headers (used for the rejects export). */
  cells: string[];
  /** Cells mapped to known columns; missing cells are "". */
  fields: CsvFields;
};

export type ParseResult =
  | { ok: true; headers: string[]; rows: ParsedRow[]; blankSkipped: number }
  | { ok: false; error: string };

export type RejectedRow = {
  rowNumber: number;
  cells: string[];
  reasons: string[];
};

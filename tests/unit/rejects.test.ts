import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv/parse";
import { buildRejectsCsv } from "@/lib/csv/rejects";

describe("buildRejectsCsv", () => {
  const headers = ["title", "due_date", "priority", "notes"];
  const rejected = [
    {
      rowNumber: 4,
      cells: ['Buy "milk", eggs', "2026-02-30", "high", "line1\nline2"],
      reasons: ["due_date must be a real date in YYYY-MM-DD format", "priority must be a whole number from 1 to 5"],
    },
  ];

  it("adds row_number and reason columns around the original columns", () => {
    const csv = buildRejectsCsv(headers, rejected);
    expect(csv.split("\r\n")[0]).toBe("row_number,title,due_date,priority,notes,reason");
  });

  it("round-trips through the parser with commas, quotes and newlines intact", () => {
    const parsed = parseCsv(buildRejectsCsv(headers, rejected));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.rows[0].cells).toEqual([
      "4",
      'Buy "milk", eggs',
      "2026-02-30",
      "high",
      "line1\nline2",
      "due_date must be a real date in YYYY-MM-DD format; priority must be a whole number from 1 to 5",
    ]);
    expect(parsed.rows[0].fields.title).toBe('Buy "milk", eggs');
  });

  it("pads short rows so every line has the same number of columns", () => {
    const csv = buildRejectsCsv(headers, [{ rowNumber: 2, cells: ["A"], reasons: ["x"] }]);
    expect(csv.split("\r\n")[1]).toBe("2,A,,,,x");
  });

  it("neutralises cells that a spreadsheet would run as formulae", () => {
    const csv = buildRejectsCsv(headers, [
      { rowNumber: 2, cells: ['=HYPERLINK("http://x")', "+1", "-2", "@SUM(A1)"], reasons: ["x"] },
    ]);
    const parsed = parseCsv(csv);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.rows[0].cells.slice(1, 5)).toEqual(["'=HYPERLINK(\"http://x\")", "'+1", "'-2", "'@SUM(A1)"]);
  });

  it("gives back the original values when the rejects file is parsed for re-import", () => {
    const parsed = parseCsv(buildRejectsCsv(headers, [{ rowNumber: 2, cells: ["-Call bank", "=1", "+2", "@x"], reasons: ["x"] }]));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.rows[0].fields).toEqual({ title: "-Call bank", due_date: "=1", priority: "+2", notes: "@x" });
  });
});

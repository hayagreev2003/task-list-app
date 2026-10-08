import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv/parse";

function ok(text: string) {
  const result = parseCsv(text);
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result;
}

describe("parseCsv", () => {
  it("maps columns to fields with spreadsheet row numbers", () => {
    const result = ok("title,due_date,priority,notes\nBuy milk,2026-01-05,3,shop\n");
    expect(result.headers).toEqual(["title", "due_date", "priority", "notes"]);
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        cells: ["Buy milk", "2026-01-05", "3", "shop"],
        fields: { title: "Buy milk", due_date: "2026-01-05", priority: "3", notes: "shop" },
      },
    ]);
    expect(result.blankSkipped).toBe(0);
  });

  it("keeps a quoted comma in one field", () => {
    const result = ok('title,due_date,priority\n"Buy milk, eggs",2026-01-05,3');
    expect(result.rows[0].fields.title).toBe("Buy milk, eggs");
  });

  it("unescapes doubled quotes", () => {
    const result = ok('title,due_date,priority\n"Say ""hi""",2026-01-05,3');
    expect(result.rows[0].fields.title).toBe('Say "hi"');
  });

  it("keeps a quoted newline in one field and numbers rows by record", () => {
    const result = ok('title,due_date,priority,notes\nA,2026-01-05,3,"line1\nline2"\nB,2026-01-06,2,');
    expect(result.rows.map((r) => r.rowNumber)).toEqual([2, 3]);
    expect(result.rows[0].fields.notes).toBe("line1\nline2");
  });

  it("handles CRLF line endings", () => {
    const result = ok("title,due_date,priority\r\nA,2026-01-05,3\r\nB,2026-01-06,2\r\n");
    expect(result.rows.map((r) => r.fields.title)).toEqual(["A", "B"]);
    expect(result.rows[1].fields.priority).toBe("2");
  });

  it("handles a mix of CRLF and LF", () => {
    const result = ok("title,due_date,priority\r\nA,2026-01-05,3\nB,2026-01-06,2\r\n");
    expect(result.rows.map((r) => r.fields.priority)).toEqual(["3", "2"]);
  });

  it("strips a UTF-8 BOM before the header", () => {
    const result = ok("﻿title,due_date,priority\nA,2026-01-05,3");
    expect(result.rows[0].fields.title).toBe("A");
  });

  it("does not add a row for a trailing newline", () => {
    const result = ok("title,due_date,priority\nA,2026-01-05,3\n");
    expect(result.rows).toHaveLength(1);
    expect(result.blankSkipped).toBe(0);
  });

  it("skips and counts blank rows while still advancing row numbers", () => {
    const result = ok("title,due_date,priority\nA,2026-01-05,3\n,,,\n\n  ,  ,\nB,2026-01-06,2");
    expect(result.blankSkipped).toBe(3);
    expect(result.rows.map((r) => r.rowNumber)).toEqual([2, 6]);
  });

  it("matches headers case-insensitively, in any order, ignoring extras", () => {
    const result = ok(" Priority ,EXTRA,Due_Date,Title\n3,x,2026-01-05,A");
    expect(result.rows[0].fields).toEqual({
      title: "A",
      due_date: "2026-01-05",
      priority: "3",
      notes: "",
    });
  });

  it("treats a missing notes column as empty notes", () => {
    const result = ok("title,due_date,priority\nA,2026-01-05,3");
    expect(result.rows[0].fields.notes).toBe("");
  });

  it("treats missing trailing cells as empty", () => {
    const result = ok("title,due_date,priority,notes\nA,2026-01-05");
    expect(result.rows[0].fields).toMatchObject({ priority: "", notes: "" });
  });

  it("rejects the file when a required column is missing", () => {
    expect(parseCsv("title,due_date,notes\nA,2026-01-05,x")).toEqual({
      ok: false,
      error: "Missing required column: priority. Expected columns: title, due_date, priority, notes.",
    });
  });

  it("lists every missing required column", () => {
    const result = parseCsv("name,when\nA,2026-01-05");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("title, due_date, priority");
  });

  it.each(["", "﻿", "\n\n", "  \r\n"])("rejects an empty file %j", (text) => {
    expect(parseCsv(text)).toEqual({ ok: false, error: "The file is empty." });
  });

  it("accepts a header with no data rows", () => {
    const result = ok("title,due_date,priority\n");
    expect(result.rows).toEqual([]);
  });

  it("rejects an unclosed quote instead of swallowing the rest of the file", () => {
    const result = parseCsv('title,due_date,priority\n"Broken,2026-01-05,3\nB,2026-01-06,2');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/quote/i);
  });

  it("always splits on commas, even when another character looks more regular", () => {
    const result = ok(
      ["title,due_date,priority,notes", "A,2026-01-05,3", "B,2026-01-06,2,x;y;z", "C,2026-01-07,1,p;q;r"].join("\n"),
    );
    expect(result.rows.map((r) => r.fields.title)).toEqual(["A", "B", "C"]);
    expect(result.rows[1].fields.notes).toBe("x;y;z");
  });

  it("does not accept a semicolon-separated file as CSV", () => {
    const result = parseCsv("title;due_date;priority\nA;2026-01-05;3");
    expect(!result.ok && result.error).toMatch(/Missing required columns/);
  });

  it("drops the formula-guard apostrophe only before = + - @", () => {
    const result = ok("title,due_date,priority,notes\n'=SUM(A1),2026-01-05,3,'quoted'");
    expect(result.rows[0].fields.title).toBe("=SUM(A1)");
    expect(result.rows[0].fields.notes).toBe("'quoted'");
    expect(result.rows[0].cells[0]).toBe("'=SUM(A1)");
  });
});

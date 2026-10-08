import { describe, expect, it } from "vitest";
import { MAX_DATA_ROWS, planImport } from "@/lib/csv/import";

describe("planImport", () => {
  it("separates valid rows from invalid ones and keeps every reason", () => {
    const result = planImport(
      [
        "title,due_date,priority,notes",
        '"Buy milk, eggs",2026-01-05,3,',
        ",2026-02-30,high,",
        "Call bank,2026-01-06,2,urgent",
      ].join("\n"),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.candidates.map((c) => [c.rowNumber, c.task.title])).toEqual([
      [2, "Buy milk, eggs"],
      [4, "Call bank"],
    ]);
    expect(result.plan.rejected).toEqual([
      {
        rowNumber: 3,
        cells: ["", "2026-02-30", "high", ""],
        reasons: [
          "title is required",
          "due_date must be a real date in YYYY-MM-DD format",
          "priority must be a whole number from 1 to 5",
        ],
      },
    ]);
  });

  it("rejects later in-file duplicates with the first row number", () => {
    const result = planImport(
      "title,due_date,priority\nBuy milk,2026-01-05,3\n  BUY MILK ,2026-01-05,1\n",
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.candidates.map((c) => c.rowNumber)).toEqual([2]);
    expect(result.plan.rejected).toEqual([
      { rowNumber: 3, cells: ["  BUY MILK ", "2026-01-05", "1"], reasons: ["duplicate of row 2"] },
    ]);
  });

  it("doesn't let an invalid row claim a duplicate key", () => {
    const result = planImport(
      "title,due_date,priority\nBuy milk,2026-01-05,high\nBuy milk,2026-01-05,3\n",
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.candidates.map((c) => c.rowNumber)).toEqual([3]);
    expect(result.plan.rejected.map((r) => r.rowNumber)).toEqual([2]);
  });

  it("counts blank rows", () => {
    const result = planImport("title,due_date,priority\nA,2026-01-05,3\n,,\n\n");
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.blankSkipped).toBe(2);
  });

  it("passes file-level errors through", () => {
    expect(planImport("title,priority\nA,3")).toMatchObject({ ok: false });
  });

  it(`rejects files with more than ${MAX_DATA_ROWS} data rows`, () => {
    const body = Array.from({ length: MAX_DATA_ROWS + 1 }, (_, i) => `T${i},2026-01-05,3`);
    const result = planImport(["title,due_date,priority", ...body].join("\n"));
    expect(result).toEqual({
      ok: false,
      error: `The file has ${MAX_DATA_ROWS + 1} rows. The limit is ${MAX_DATA_ROWS}.`,
    });
  });

  it(`accepts exactly ${MAX_DATA_ROWS} data rows`, () => {
    const body = Array.from({ length: MAX_DATA_ROWS }, (_, i) => `T${i},2026-01-05,3`);
    const result = planImport(["title,due_date,priority", ...body].join("\n"));
    expect(result.ok && result.plan.candidates).toHaveLength(MAX_DATA_ROWS);
  });
});

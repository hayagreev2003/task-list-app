import { describe, expect, it } from "vitest";
import { dedupeKey, findInFileDuplicates } from "@/lib/csv/dedupe";

const row = (rowNumber: number, title: string, due_date: string) => ({
  rowNumber,
  task: { title, due_date },
});

describe("dedupeKey", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(dedupeKey(" Buy Milk ", "2026-01-05")).toBe(dedupeKey("buy milk", "2026-01-05"));
  });

  it("differs by due date", () => {
    expect(dedupeKey("a", "2026-01-05")).not.toBe(dedupeKey("a", "2026-01-06"));
  });
});

describe("findInFileDuplicates", () => {
  it("keeps the first occurrence and points later ones at it", () => {
    const result = findInFileDuplicates([
      row(2, "Buy milk", "2026-01-05"),
      row(3, "BUY MILK", "2026-01-05"),
      row(5, "buy milk", "2026-01-05"),
    ]);
    expect(result.unique.map((r) => r.rowNumber)).toEqual([2]);
    expect(result.duplicates).toEqual([
      { item: row(3, "BUY MILK", "2026-01-05"), firstRowNumber: 2 },
      { item: row(5, "buy milk", "2026-01-05"), firstRowNumber: 2 },
    ]);
  });

  it("treats the same title on a different date as distinct", () => {
    const result = findInFileDuplicates([
      row(2, "Buy milk", "2026-01-05"),
      row(3, "Buy milk", "2026-01-06"),
    ]);
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toEqual([]);
  });
});

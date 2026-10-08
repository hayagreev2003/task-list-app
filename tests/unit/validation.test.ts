import { describe, expect, it } from "vitest";
import { validateTaskInput } from "@/lib/tasks/validation";

const valid = { title: "Buy milk", due_date: "2026-01-05", priority: "3", notes: "" };

function errorsFor(overrides: Partial<Record<keyof typeof valid, unknown>>) {
  const result = validateTaskInput({ ...valid, ...overrides });
  return result.ok ? [] : result.errors;
}

describe("validateTaskInput", () => {
  it("accepts a valid row and normalises values", () => {
    const result = validateTaskInput({
      title: "  Buy milk  ",
      due_date: " 2026-01-05 ",
      priority: " 3 ",
      notes: "  ",
    });
    expect(result).toEqual({
      ok: true,
      value: { title: "Buy milk", due_date: "2026-01-05", priority: 3, notes: null },
    });
  });

  it("keeps non-empty notes, trimmed", () => {
    const result = validateTaskInput({ ...valid, notes: "  two\nlines  " });
    expect(result.ok && result.value.notes).toBe("two\nlines");
  });

  describe("title", () => {
    it.each([[undefined], [""], ["   "], [null]])("rejects missing title %j", (title) => {
      expect(errorsFor({ title })).toEqual(["title is required"]);
    });

    it("accepts exactly 200 characters", () => {
      expect(errorsFor({ title: "a".repeat(200) })).toEqual([]);
    });

    it("rejects 201 characters", () => {
      expect(errorsFor({ title: "a".repeat(201) })).toEqual([
        "title must be 200 characters or fewer",
      ]);
    });

    it("measures length after trimming", () => {
      expect(errorsFor({ title: `  ${"a".repeat(200)}  ` })).toEqual([]);
    });
  });

  describe("due_date", () => {
    it.each(["2026-01-05", " 2026-01-05 ", "2024-02-29"])("accepts %j", (due_date) => {
      expect(errorsFor({ due_date })).toEqual([]);
    });

    it.each([
      "05-01-2026",
      "05/01/2026",
      "2026/01/05",
      "26-01-05",
      "2026-1-5",
      "2026-01-05T00:00",
      "２０２６-01-05",
      "tomorrow",
    ])("rejects wrong format %j", (due_date) => {
      expect(errorsFor({ due_date })).toEqual([
        "due_date must be a real date in YYYY-MM-DD format",
      ]);
    });

    it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "0000-01-01"])(
      "rejects date not on the calendar %j",
      (due_date) => {
        expect(errorsFor({ due_date })).toEqual([
          "due_date must be a real date in YYYY-MM-DD format",
        ]);
      },
    );

    it.each([[""], ["  "], [undefined]])("requires a due date %j", (due_date) => {
      expect(errorsFor({ due_date })).toEqual(["due_date is required"]);
    });
  });

  describe("priority", () => {
    it.each(["1", "5", " 3 "])("accepts %j", (priority) => {
      expect(errorsFor({ priority })).toEqual([]);
    });

    it("accepts a number value from a form", () => {
      expect(errorsFor({ priority: 4 })).toEqual([]);
    });

    it.each(["high", "2.5", "0", "6", "-1", "01", "3.0", "1e0", "+3"])("rejects %j", (priority) => {
      expect(errorsFor({ priority })).toEqual(["priority must be a whole number from 1 to 5"]);
    });

    it.each([[""], [undefined]])("requires a priority %j", (priority) => {
      expect(errorsFor({ priority })).toEqual(["priority is required"]);
    });
  });

  describe("notes", () => {
    it("accepts 2,000 characters", () => {
      expect(errorsFor({ notes: "n".repeat(2000) })).toEqual([]);
    });

    it("rejects more than 2,000 characters", () => {
      expect(errorsFor({ notes: "n".repeat(2001) })).toEqual(["notes must be 2000 characters or fewer"]);
    });
  });

  it("reports every failing field together", () => {
    expect(errorsFor({ title: "", due_date: "2026-02-30", priority: "high" })).toEqual([
      "title is required",
      "due_date must be a real date in YYYY-MM-DD format",
      "priority must be a whole number from 1 to 5",
    ]);
  });
});

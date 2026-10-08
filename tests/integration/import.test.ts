import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALREADY_EXISTS, runImport } from "@/lib/csv/import";
import { assertSupabaseRunning, createTestUser, deleteTestUsers, type TestUser } from "./helpers";

const edgeCase = readFileSync("samples/edge-case.csv", "utf8");

describe("CSV import against the database", () => {
  let user: TestUser;

  beforeAll(assertSupabaseRunning);
  beforeEach(async () => {
    user = await createTestUser("import");
  });
  afterAll(deleteTestUsers);

  async function liveTitles() {
    const { data, error } = await user.client
      .from("tasks")
      .select("title")
      .is("deleted_at", null)
      .order("title");
    if (error) throw error;
    return data.map((t) => t.title);
  }

  it("imports the edge-case file: valid rows in, bad rows reported, blank row skipped", async () => {
    const result = await runImport(user.client, edgeCase);
    if (!result.ok) throw new Error(result.error);

    expect(result.imported).toBe(4);
    expect(result.blankSkipped).toBe(1);
    expect(result.rejected.map((r) => [r.rowNumber, r.reasons])).toEqual([
      [4, ["duplicate of row 2"]],
      [6, ["priority must be a whole number from 1 to 5"]],
      [7, ["title must be 200 characters or fewer"]],
      [8, ["due_date must be a real date in YYYY-MM-DD format"]],
      [9, ["due_date must be a real date in YYYY-MM-DD format"]],
    ]);
    expect(await liveTitles()).toEqual([
      "Buy milk, eggs",
      "Call the plumber",
      "Team lunch",
      'Write "Q4" report',
    ]);
  });

  it("rejects a row matching an existing task (different case and spacing) and leaves it unchanged", async () => {
    await user.client.from("tasks").insert({ title: "Buy Milk", due_date: "2026-01-05", priority: 1, notes: "orig" });

    const result = await runImport(user.client, "title,due_date,priority,notes\n  buy milk ,2026-01-05,5,new\n");
    if (!result.ok) throw new Error(result.error);

    expect(result.imported).toBe(0);
    expect(result.rejected).toEqual([
      { rowNumber: 2, cells: ["  buy milk ", "2026-01-05", "5", "new"], reasons: [ALREADY_EXISTS] },
    ]);
    const { data } = await user.client.from("tasks").select("title, priority, notes");
    expect(data).toEqual([{ title: "Buy Milk", priority: 1, notes: "orig" }]);
  });

  it("allows importing a task whose only match is soft-deleted", async () => {
    const { data: task } = await user.client
      .from("tasks")
      .insert({ title: "Buy milk", due_date: "2026-01-05", priority: 1 })
      .select("id")
      .single();
    await user.client.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", task!.id);

    const result = await runImport(user.client, "title,due_date,priority\nBuy milk,2026-01-05,2\n");
    expect(result).toMatchObject({ ok: true, imported: 1, rejected: [] });
  });

  it("re-importing the same file imports nothing and reports every row as existing", async () => {
    await runImport(user.client, edgeCase);
    const again = await runImport(user.client, edgeCase);
    if (!again.ok) throw new Error(again.error);

    expect(again.imported).toBe(0);
    const existing = again.rejected.filter((r) => r.reasons.includes(ALREADY_EXISTS));
    expect(existing.map((r) => r.rowNumber)).toEqual([2, 3, 10, 11]);
    expect(await liveTitles()).toHaveLength(4);
  });

  it("is all-or-nothing: one bad row in the batch means no rows are saved", async () => {
    // Bypass TypeScript validation and send a row that violates a database check (priority 9).
    const { error } = await user.client.rpc("import_tasks", {
      rows: [
        { row_number: 2, title: "Good row", due_date: "2026-01-05", priority: 3, notes: null },
        { row_number: 3, title: "Bad row", due_date: "2026-01-06", priority: 9, notes: null },
      ],
    });
    expect(error).not.toBeNull();
    expect(await liveTitles()).toEqual([]);
  });

  it("rejects over-long notes at the database even when app validation is bypassed", async () => {
    const { error } = await user.client.rpc("import_tasks", {
      rows: [{ row_number: 2, title: "Long notes", due_date: "2026-01-05", priority: 3, notes: "n".repeat(2001) }],
    });
    expect(error).not.toBeNull();
    expect(await liveTitles()).toEqual([]);
  });

  it("skips duplicates within one RPC batch, keeping the first", async () => {
    const { data, error } = await user.client.rpc("import_tasks", {
      rows: [
        { row_number: 2, title: "Same", due_date: "2026-01-05", priority: 3, notes: null },
        { row_number: 3, title: "SAME", due_date: "2026-01-05", priority: 1, notes: null },
      ],
    });
    expect(error).toBeNull();
    expect(data).toEqual({
      inserted: 1,
      skipped_row_numbers: [3],
      duplicates: [{ row_number: 3, first_row_number: 2 }],
    });
  });

  it("tells in-file duplicates apart from existing tasks when both occur", async () => {
    await user.client.from("tasks").insert({ title: "Old", due_date: "2026-01-05", priority: 1 });

    const result = await runImport(
      user.client,
      "title,due_date,priority\nOld,2026-01-05,2\nNew,2026-01-05,3\nOLD,2026-01-05,4\nnew,2026-01-05,5\n",
    );
    if (!result.ok) throw new Error(result.error);

    expect(result.imported).toBe(1);
    expect(result.rejected.map((r) => [r.rowNumber, r.reasons])).toEqual([
      [2, [ALREADY_EXISTS]],
      [4, ["duplicate of row 2"]],
      [5, ["duplicate of row 3"]],
    ]);
  });

  it("re-imports a corrected rejects file without the formula-guard apostrophe", async () => {
    const result = await runImport(user.client, "title,due_date,priority\n'-Call bank,2026-01-05,2\n");
    expect(result).toMatchObject({ ok: true, imported: 1 });
    expect(await liveTitles()).toEqual(["-Call bank"]);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listTasks, parseFilters } from "@/lib/tasks/queries";
import { assertSupabaseRunning, createTestUser, deleteTestUsers, type TestUser } from "./helpers";

describe("listTasks", () => {
  let user: TestUser;

  beforeAll(async () => {
    await assertSupabaseRunning();
    user = await createTestUser("queries");
    const { error } = await user.client.from("tasks").insert([
      { title: "Buy milk, eggs", due_date: "2026-01-06", priority: 2, notes: "corner shop" },
      { title: "Discount 50% off", due_date: "2026-01-05", priority: 4, status: "done" },
      { title: "Read (chapter 3)", due_date: "2026-01-05", priority: 1, notes: 'quote "x" \\ slash' },
      { title: "snake_case rename", due_date: "2026-01-07", priority: 3 },
      { title: "Glob *.csv [a-z]+ files?", due_date: "2026-01-08", priority: 3, notes: "^start | end$" },
      { title: "Deleted task", due_date: "2026-01-05", priority: 1 },
    ], { defaultToNull: false });
    if (error) throw error;
    await user.client.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("title", "Deleted task");
  });

  afterAll(deleteTestUsers);

  const titles = async (params: Record<string, string>) =>
    (await listTasks(user.client, parseFilters(params))).tasks.map((t) => t.title);

  it("lists live tasks ordered by due date then priority", async () => {
    expect(await titles({})).toEqual([
      "Read (chapter 3)",
      "Discount 50% off",
      "Buy milk, eggs",
      "snake_case rename",
      "Glob *.csv [a-z]+ files?",
    ]);
  });

  it("searches title and notes case-insensitively", async () => {
    expect(await titles({ q: "CORNER" })).toEqual(["Buy milk, eggs"]);
    expect(await titles({ q: "milk" })).toEqual(["Buy milk, eggs"]);
  });

  it.each([
    ["milk, eggs", ["Buy milk, eggs"]],
    ["(chapter", ["Read (chapter 3)"]],
    ["50%", ["Discount 50% off"]],
    ["%", ["Discount 50% off"]],
    ["_", ["snake_case rename"]],
    ['"x"', ["Read (chapter 3)"]],
    ["\\", ["Read (chapter 3)"]],
    ["*", ["Glob *.csv [a-z]+ files?"]],
    ["*.csv", ["Glob *.csv [a-z]+ files?"]],
    ["u*m", []],
    [".", ["Glob *.csv [a-z]+ files?"]],
    ["[a-z]+", ["Glob *.csv [a-z]+ files?"]],
    ["files?", ["Glob *.csv [a-z]+ files?"]],
    ["^start | end$", ["Glob *.csv [a-z]+ files?"]],
  ])("treats special characters in %j literally", async (q, expected) => {
    expect(await titles({ q })).toEqual(expected);
  });

  it("combines status, priority and search filters", async () => {
    expect(await titles({ status: "done" })).toEqual(["Discount 50% off"]);
    expect(await titles({ priority: "1" })).toEqual(["Read (chapter 3)"]);
    expect(await titles({ status: "todo", q: "read" })).toEqual(["Read (chapter 3)"]);
    expect(await titles({ status: "done", priority: "1" })).toEqual([]);
  });

  it("ignores invalid filter values", () => {
    expect(parseFilters({ status: "nope", priority: "9", q: "  x " })).toEqual({
      q: "x",
      status: null,
      priority: null,
    });
  });
});

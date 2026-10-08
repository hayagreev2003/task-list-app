import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  assertSupabaseRunning,
  createTestUser,
  deleteTestUsers,
  sampleTask,
  type TestUser,
} from "./helpers";

// These tests talk to Postgres through the public API as real users, so they prove isolation at
// the database layer. Disabling RLS on public.tasks makes the read/update tests fail.
describe("row-level security on tasks", () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceTaskId: string;
  const aliceTask = sampleTask({ title: "Alice private task" });

  beforeAll(async () => {
    await assertSupabaseRunning();
    [alice, bob] = await Promise.all([createTestUser("alice"), createTestUser("bob")]);
    const { data, error } = await alice.client.from("tasks").insert(aliceTask).select("id, user_id").single();
    if (error) throw error;
    expect(data.user_id).toBe(alice.id);
    aliceTaskId = data.id;
  });

  afterAll(deleteTestUsers);

  async function readAliceTaskAsAlice() {
    const { data, error } = await alice.client.from("tasks").select("*").eq("id", aliceTaskId).single();
    if (error) throw error;
    return data;
  }

  it("owner can read their task", async () => {
    expect((await readAliceTaskAsAlice()).title).toBe(aliceTask.title);
  });

  it("another user can't list the owner's tasks", async () => {
    const { data, error } = await bob.client.from("tasks").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("another user can't read the owner's task by id", async () => {
    const { data, error } = await bob.client.from("tasks").select("id").eq("id", aliceTaskId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("another user's update affects no rows and leaves the task unchanged", async () => {
    const { data, error } = await bob.client
      .from("tasks")
      .update({ title: "hacked", status: "done" })
      .eq("id", aliceTaskId)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const after = await readAliceTaskAsAlice();
    expect(after).toMatchObject({ title: aliceTask.title, status: "todo" });
  });

  it("another user's soft delete affects no rows", async () => {
    const { data, error } = await bob.client
      .from("tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", aliceTaskId)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await readAliceTaskAsAlice()).deleted_at).toBeNull();
  });

  it("a user can't insert a task owned by someone else", async () => {
    const { error } = await bob.client
      .from("tasks")
      .insert({ ...sampleTask(), user_id: alice.id })
      .select("id");
    expect(error).not.toBeNull();
    const { data } = await alice.client.from("tasks").select("id");
    expect(data).toHaveLength(1);
  });

  it("a user can't move their own task to someone else", async () => {
    const { data: bobTask } = await bob.client.from("tasks").insert(sampleTask()).select("id").single();
    const { error } = await bob.client
      .from("tasks")
      .update({ user_id: alice.id } as never)
      .eq("id", bobTask!.id);
    expect(error).not.toBeNull();
  });

  it("a signed-out client reads nothing", async () => {
    const { data } = await anonClient().from("tasks").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("a signed-out client can't insert", async () => {
    const { error } = await anonClient().from("tasks").insert(sampleTask());
    expect(error).not.toBeNull();
  });

  it("the owner can't hard delete (soft delete only)", async () => {
    const { error } = await alice.client.from("tasks").delete().eq("id", aliceTaskId);
    expect(error).not.toBeNull();
    expect((await readAliceTaskAsAlice()).id).toBe(aliceTaskId);
  });

  it("import_tasks for one user ignores another user's tasks when checking duplicates", async () => {
    const { data, error } = await bob.client.rpc("import_tasks", {
      rows: [{ row_number: 2, title: aliceTask.title, due_date: aliceTask.due_date, priority: 1, notes: null }],
    });
    expect(error).toBeNull();
    expect(data).toEqual({ inserted: 1, skipped_row_numbers: [], duplicates: [] });
  });

  it("signed-out callers can't run import_tasks", async () => {
    const { error } = await anonClient().rpc("import_tasks", { rows: [] });
    expect(error).not.toBeNull();
  });
});

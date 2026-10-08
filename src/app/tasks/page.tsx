import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskFilters } from "@/components/TaskFilters";
import { TaskForm } from "@/components/TaskForm";
import { TaskList } from "@/components/TaskList";
import { parseFilters } from "@/lib/tasks/queries";
import { createTask } from "./actions";

export const metadata: Metadata = { title: "Your tasks" };

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <>
      <h1>Your tasks</h1>
      <details className="card" open>
        <summary>Add a task</summary>
        <TaskForm action={createTask} submitLabel="Add task" />
      </details>
      <Suspense fallback={<TaskListSkeleton />}>
        <FilteredTasks searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function FilteredTasks({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  const filters = parseFilters(await searchParams);
  return (
    <>
      <TaskFilters filters={filters} />
      <Suspense key={JSON.stringify(filters)} fallback={<TaskListSkeleton />}>
        <TaskList filters={filters} />
      </Suspense>
    </>
  );
}

function TaskListSkeleton() {
  return (
    <p className="muted" role="status">
      Loading tasks…
    </p>
  );
}

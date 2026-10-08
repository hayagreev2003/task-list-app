import type { Metadata } from "next";
import { Suspense } from "react";
import { PlusIcon } from "@/components/icons";
import { StatusTabs, StatusTabsSkeleton } from "@/components/StatusTabs";
import { TaskFilters } from "@/components/TaskFilters";
import { TaskForm } from "@/components/TaskForm";
import { TaskList } from "@/components/TaskList";
import { parseFilters } from "@/lib/tasks/queries";
import { createTask } from "./actions";

export const metadata: Metadata = { title: "Your tasks" };

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <>
      <div className="page-head">
        <h1>Your tasks</h1>
        <p className="muted">Plan, prioritise and tick off what matters.</p>
      </div>
      <details className="card add-task" open>
        <summary>
          <span className="summary-icon" aria-hidden="true">
            <PlusIcon />
          </span>
          Add a task
        </summary>
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
    <section aria-label="Task list" className="task-panel">
      <div className="toolbar">
        <Suspense key={`${filters.q}|${filters.priority}`} fallback={<StatusTabsSkeleton />}>
          <StatusTabs filters={filters} />
        </Suspense>
        <TaskFilters filters={filters} />
      </div>
      <Suspense key={JSON.stringify(filters)} fallback={<TaskListSkeleton />}>
        <TaskList filters={filters} />
      </Suspense>
    </section>
  );
}

function TaskListSkeleton() {
  return (
    <div role="status" className="skeleton-list">
      <span className="sr-only">Loading tasks…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton-row" aria-hidden="true" />
      ))}
    </div>
  );
}

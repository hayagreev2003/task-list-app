import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { countLiveTasks, hasActiveFilters, LIST_LIMIT, listTasks, type TaskFilters } from "@/lib/tasks/queries";
import { TaskItem } from "./TaskItem";

export async function TaskList({ filters }: { filters: TaskFilters }) {
  const { supabase } = await requireUser();
  const { tasks, truncated } = await listTasks(supabase, filters);

  if (tasks.length === 0) {
    // Tell "nothing matches" apart from "nothing at all".
    const filtered = hasActiveFilters(filters) && (await countLiveTasks(supabase)) > 0;
    return filtered ? (
      <div className="empty">
        <p>No tasks match these filters.</p>
        <Link href="/tasks">Clear filters</Link>
      </div>
    ) : (
      <div className="empty">
        <p>No tasks yet.</p>
        <p>
          Add one above, or <Link href="/import">import a CSV file</Link>.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="muted">
        {truncated ? `Showing the first ${LIST_LIMIT} tasks.` : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
      </p>
      <ul className="tasks">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </ul>
    </>
  );
}

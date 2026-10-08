import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { countTasksByStatus, type TaskFilters } from "@/lib/tasks/queries";
import { STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "@/lib/tasks/validation";

const TABS: { status: TaskStatus | null; label: string }[] = [
  { status: null, label: "All" },
  ...TASK_STATUSES.map((status) => ({ status, label: STATUS_LABELS[status] })),
];

/** A status filter as tabs; links keep the search and priority filters. */
export async function StatusTabs({ filters }: { filters: TaskFilters }) {
  const { supabase } = await requireUser();
  const counts = await countTasksByStatus(supabase, filters);

  return (
    <nav aria-label="Filter by status" className="status-tabs">
      {TABS.map(({ status, label }) => {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (status) params.set("status", status);
        if (filters.priority) params.set("priority", String(filters.priority));
        const query = params.toString();
        return (
          <Link
            key={label}
            href={query ? `/tasks?${query}` : "/tasks"}
            className="status-tab"
            aria-current={filters.status === status ? "page" : undefined}
          >
            {label}
            <span className="count">{counts[status ?? "all"]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function StatusTabsSkeleton() {
  return (
    <div className="status-tabs" aria-hidden="true">
      {TABS.map(({ label }) => (
        <span key={label} className="status-tab">
          {label}
          <span className="count skeleton-text">0</span>
        </span>
      ))}
    </div>
  );
}

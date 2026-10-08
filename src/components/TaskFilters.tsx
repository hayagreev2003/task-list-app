import Form from "next/form";
import Link from "next/link";
import { hasActiveFilters, type TaskFilters as Filters } from "@/lib/tasks/queries";
import { STATUS_LABELS, TASK_STATUSES } from "@/lib/tasks/validation";

/** Filters live in the URL (GET form), so a filtered view can be bookmarked or shared. */
export function TaskFilters({ filters }: { filters: Filters }) {
  return (
    <Form key={JSON.stringify(filters)} action="/tasks" className="filters" role="search">
      <label className="grow">
        Search
        <input type="search" name="q" placeholder="Title or notes" defaultValue={filters.q} />
      </label>
      <label>
        Status
        <select name="status" defaultValue={filters.status ?? ""}>
          <option value="">Any</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Priority
        <select name="priority" defaultValue={filters.priority ?? ""}>
          <option value="">Any</option>
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <button type="submit">Apply</button>
      {hasActiveFilters(filters) ? <Link href="/tasks">Clear filters</Link> : null}
    </Form>
  );
}

import Form from "next/form";
import Link from "next/link";
import { hasActiveFilters, type TaskFilters as Filters } from "@/lib/tasks/queries";
import { SearchIcon } from "./icons";

/** Filters live in the URL (GET form), so a filtered view can be bookmarked or shared. */
export function TaskFilters({ filters }: { filters: Filters }) {
  return (
    <Form key={JSON.stringify(filters)} action="/tasks" className="filters" role="search">
      {/* The status tabs set status; keep it when searching. */}
      {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
      <label className="search-field grow">
        <span className="sr-only">Search</span>
        <SearchIcon className="search-icon" />
        <input type="search" name="q" placeholder="Search title or notes" defaultValue={filters.q} />
      </label>
      <label className="inline-label">
        <span className="sr-only">Priority</span>
        <select name="priority" defaultValue={filters.priority ?? ""}>
          <option value="">Any priority</option>
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>
              Priority {p}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="secondary">
        Apply
      </button>
      {hasActiveFilters(filters) ? (
        <Link href="/tasks" className="clear-link">
          Clear filters
        </Link>
      ) : null}
    </Form>
  );
}

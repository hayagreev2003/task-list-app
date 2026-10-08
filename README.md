# Task List with CSV Import

A small task-list web app where each signed-in user manages their own tasks and can bulk-import them from a CSV file. It's built with TypeScript, Next.js 16 (App Router), Node.js and PostgreSQL (local Supabase), and per-user isolation is enforced by Postgres row-level security.

> - Requirements: [`docs/brainstorms/2026-10-08-task-list-csv-import-requirements.md`](docs/brainstorms/2026-10-08-task-list-csv-import-requirements.md)
> - Implementation plan: [`docs/plans/2026-10-08-001-feat-task-list-csv-import-plan.md`](docs/plans/2026-10-08-001-feat-task-list-csv-import-plan.md)
> - Screen recording: _link to be added_

## What the app does

### Accounts and privacy
- Sign up and sign in with email and password.
- Every user sees **only their own tasks**. This is enforced in the database with row-level security, not only in application code, so a bug in the UI or API can't leak another user's data.

### Tasks
- Each task has a **title** (required, up to 200 characters), **notes** (up to 2,000 characters), **due date**, **priority** (1–5) and **status** (to do, in progress, done).
- Create, edit, mark complete (and reopen), and delete tasks.
- Deleting is a **soft delete**: the task disappears from your list but is kept in the database.

### Task list
- Search across titles and notes.
- Filter by status and priority. Filters live in the URL, so a filtered view can be bookmarked.
- Clear **loading**, **empty** ("no tasks yet" vs "no tasks match these filters") and **error** states.

### CSV import
- Upload a CSV with the columns `title, due_date, priority, notes`. Header names are matched case-insensitively and in any order. Extra columns are ignored.
- **The server validates every row.** A row is rejected if:
  - the title is missing or longer than 200 characters
  - the due date is missing or not a real `YYYY-MM-DD` date (e.g. `2026-02-30` is rejected)
  - the priority is missing or not a whole number from 1 to 5 (e.g. `high`, `2.5`, `0`)
- **Duplicates are detected** within the file and against your existing tasks. A duplicate is the same title (ignoring case and surrounding spaces) with the same due date. The first occurrence in a file is kept, and deleted tasks don't count.
- **Valid rows are imported in a single transaction.** Either all of them are saved or none are.
- **Rejected rows are listed** with their spreadsheet row number and every reason they failed, and can be **downloaded as a CSV** to fix and re-upload.
- Robust to messy files: quoted fields containing commas, quotes or line breaks, Windows (CRLF) line endings, a UTF-8 byte-order mark, and blank rows. Blank rows are skipped and counted, not treated as errors.
- Oversized, empty or malformed files produce a clear message, never a crash.

### Tests (`npm test`)
- Validation rules and CSV parsing edge cases (unit tests, no database needed).
- Duplicate handling within a file and against the account.
- Cross-user isolation: one user can't read, edit or delete another user's tasks (integration tests against local Supabase).

## Tech stack
- Next.js 16 (App Router, Server Actions, Proxy) and TypeScript
- Supabase (local, via Docker): PostgreSQL, Auth, row-level security
- Vitest

## How to run

### Prerequisites
- **Node.js 22+** (`.nvmrc` pins 22; `@supabase/supabase-js` needs Node's native WebSocket)
- **Docker** (running), for local Supabase

### Setup
```bash
npm install
npm run db:start                 # npx supabase start: Postgres, Auth and the API in Docker; applies migrations
cp .env.example .env.local
npx supabase status -o env       # copy API_URL, PUBLISHABLE_KEY and SECRET_KEY into .env.local
npm run dev                      # http://localhost:3000
```

The first `db:start` downloads the Supabase images and takes a few minutes. Email confirmation is off locally, so "Create account" signs you straight in.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run db:reset` | Rebuild the local database from `supabase/migrations/` |
| `npm run db:stop` | Stop the local Supabase containers |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` from the local schema |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |

## Tests

```bash
npm test
```

Local Supabase must be running (`npm run db:start`) with `.env.local` filled in. The integration tests fail with a clear message rather than silently skipping if it isn't.

| File | Covers |
| --- | --- |
| `tests/unit/validation.test.ts` | Title, `YYYY-MM-DD` date (format and real-calendar checks, leap years) and priority rules; all reasons reported together |
| `tests/unit/csv-parse.test.ts` | Quoted commas, escaped quotes, quoted newlines, CRLF/LF/mixed endings, BOM, blank rows, header order/case, missing columns, unclosed quotes, row numbering |
| `tests/unit/dedupe.test.ts`, `plan-import.test.ts` | In-file duplicates (first wins), invalid rows excluded from dedupe, 5,000-row limit |
| `tests/unit/rejects.test.ts` | Rejects CSV escaping and round-trip through the parser |
| `tests/integration/rls.test.ts` | Cross-user isolation through the database API: user B can't list, read, update, soft-delete, insert as, or reassign user A's tasks; signed-out access; no hard delete |
| `tests/integration/import.test.ts` | The edge-case file end to end, duplicates against existing tasks, soft-deleted tasks, re-import, all-or-nothing transaction |
| `tests/integration/tasks-queries.test.ts` | Search (including `%`, `_`, commas, quotes, brackets taken literally) and combined filters |

**How the isolation test was validated:** with RLS switched off on `public.tasks` (`alter table public.tasks disable row level security;`), four tests in `rls.test.ts` fail (list, read by id, update, soft delete). Re-enabling RLS makes them pass again.

## Sample CSV files

- [`samples/edge-case.csv`](samples/edge-case.csv) (CRLF line endings) imports **4** rows, rejects **5** and skips **1** blank row:

  | Row | Content | Result |
  | --- | --- | --- |
  | 2 | `"Buy milk, eggs"` (quoted comma) | imported |
  | 3 | Call the plumber | imported |
  | 4 | `"  BUY MILK, EGGS "`, same date as row 2 | rejected: duplicate of row 2 |
  | 5 | `,,,` | skipped as blank |
  | 6 | priority `high` | rejected: priority must be a whole number from 1 to 5 |
  | 7 | 201-character title | rejected: title must be 200 characters or fewer |
  | 8 | due date `05/01/2026` | rejected: due_date must be a real date in YYYY-MM-DD format |
  | 9 | due date `2026-02-30` | rejected: due_date must be a real date in YYYY-MM-DD format |
  | 10 | quoted `""Q4""` in the title and a line break in the notes | imported |
  | 11 | Team lunch, empty notes | imported |

  Row 10 spans two physical lines, so row 11 is on line 12. Row numbers follow records, which is what a spreadsheet shows.
- [`samples/valid.csv`](samples/valid.csv): four clean rows.

## Design decisions

- **Isolation is enforced by Postgres.** The app only talks to Supabase as the signed-in user (publishable key plus session cookies). RLS policies check `user_id = auth.uid()`. Column-level grants stop clients writing `user_id`, `id` or timestamps, and there is no `DELETE` grant, so tasks can only be soft-deleted. The secret key is used only by the test helper that creates test users.
- **Duplicates are guaranteed by the database as well as the app:** a partial unique index on `(user_id, lower(title), due_date) where deleted_at is null`. Titles are stored trimmed.
- **Import = pure TypeScript core + one Postgres function.** Parsing (papaparse plus our own BOM, blank-row and row-number handling), validation and in-file dedupe are pure and unit-tested. The `import_tasks` function (`SECURITY INVOKER`, so RLS applies) inserts every valid row in one statement with `on conflict do nothing` and returns the rows that clashed with existing tasks. One call is one transaction: any failure means nothing is saved.
- **One set of validation rules** (`src/lib/tasks/validation.ts`) serves both the form and the import. The form uses `<input type="date">`, which always submits `YYYY-MM-DD`.
- **Next.js 16:** `src/proxy.ts` (formerly middleware) refreshes the session and redirects signed-out users, but it is only an optimistic check. `requireUser()` runs in every Server Action and data read. Cache Components stays on: session reads sit behind `<Suspense>`, and no task data is cached.
- **The rejects file is built in the browser** from the import result, so nothing is stored on the server.

## Known limitations

- Duplicate matching ignores case and surrounding spaces only. Internal spacing (`Buy  milk` vs `Buy milk`) counts as different.
- The list shows at most 500 tasks (no pagination).
- Imports are synchronous and capped at 1 MB / 5,000 rows.
- In the rejects download, cells starting with `=`, `+`, `-` or `@` get a leading `'` so spreadsheets don't run them as formulae. Re-uploading that file without removing the `'` keeps it in the value.
- Duplicate matching lower-cases titles in TypeScript and in Postgres. For rare Unicode characters where the two disagree, a duplicate inside one file can be reported as "already exists in your tasks" instead of "duplicate of row N". The counts stay correct.
- There is no per-user cap on the number of tasks.
- In search, `*` behaves as a wildcard (PostgREST treats it like `%`).

## What I'd do next

- An import preview and confirm step
- Restoring deleted tasks
- Pagination or infinite scroll for long lists
- A due-date filter (overdue, today, upcoming)
- End-to-end tests (Playwright) for the edge-case upload flow
- CI that runs Supabase in GitHub Actions
- A hosted deploy (Vercel plus Supabase, using the connection pooler)
- Streaming parse for larger files
- Locale-aware date display

## AI usage

This project is built with AI assistance (Claude Code). Planning artefacts are in `docs/`. Session transcripts are not included yet: they will be added to `ai-log/` after a privacy check.

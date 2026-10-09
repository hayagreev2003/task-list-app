# Task List with CSV Import

A small task-list web app where each signed-in user manages their own tasks and can bulk-import them from a CSV file. It's built with TypeScript, Next.js 16 (App Router), Node.js and PostgreSQL (local Supabase), and per-user isolation is enforced by Postgres row-level security.

> - Requirements: [`docs/brainstorms/2026-10-08-task-list-csv-import-requirements.md`](docs/brainstorms/2026-10-08-task-list-csv-import-requirements.md)
> - Implementation plan: [`docs/plans/2026-10-08-001-feat-task-list-csv-import-plan.md`](docs/plans/2026-10-08-001-feat-task-list-csv-import-plan.md)
> - Screen recording: _link to be added_

## What the app does

### Accounts and privacy
- Create an account in steps: enter your email, follow the link we email you (valid for 1 hour), then set and confirm a password and sign in with it. The "check your email" screen can resend the link or go back to change the address.
- Passwords must be 8 to 72 characters (bcrypt, which Supabase Auth uses, reads only the first 72 bytes).
- Until the password is set, the account can only reach `/set-password`.
- Sign in with email and password. A wrong email or password gives one generic message.
- The header shows **Tasks** and **Import CSV** tabs and an account menu (initials avatar) with the signed-in email and **Sign out**.
- Every user sees **only their own tasks**. This is enforced in the database with row-level security, not only in application code, so a bug in the UI or API can't leak another user's data.

### Tasks
- Each task has a **title** (required, up to 200 characters), **notes** (up to 2,000 characters), **due date**, **priority** (1–5) and **status** (to do, in progress, done).
- Create tasks from the **Add a task** panel; edit them inline, tick the checkbox to mark them done (untick to reopen), and delete them after an inline "Delete this task?" confirmation.
- Deleting is a **soft delete**: the task disappears from your list but is kept in the database.
- Adding or editing a task to match the title and due date of another live task is refused with "A task with this title and due date already exists."

### Task list
- Sorted by due date, then priority (1 is highest), then creation time.
- Each task shows its due date with a relative label ("Due today", "Due tomorrow", "In 3 days", "2 days overdue") for tasks that aren't done, plus priority and status pills.
- Search across titles and notes (case-insensitive; `%`, `_`, `*` and other special characters are matched literally).
- Filter by status using tabs (All, To do, In progress, Done) that show how many tasks each would list, and by priority from a drop-down. Filters live in the URL, so a filtered view can be bookmarked.
- Clear **loading**, **empty** ("no tasks yet" vs "no tasks match these filters") and **error** states.

### CSV import
- Upload a CSV whose first row is a header with the columns `title`, `due_date` and `priority`, and optionally `notes`. Header names are matched case-insensitively and in any order. Extra columns are ignored; a missing required column is reported by name.
- **The server validates every row.** A row is rejected if:
  - the title is missing or longer than 200 characters
  - the due date is missing or not a real `YYYY-MM-DD` date (e.g. `2026-02-30` is rejected)
  - the priority is missing or not a whole number from 1 to 5 (e.g. `high`, `2.5`, `0`)
  - the notes are longer than 2,000 characters
- **Duplicates are detected** within the file ("duplicate of row 2") and against your existing tasks ("already exists in your tasks"). A duplicate is the same title (ignoring case and surrounding spaces) with the same due date. The first occurrence in a file is kept, and deleted tasks don't count.
- **Valid rows are imported in a single transaction.** Either all of them are saved or none are.
- The result shows how many rows were imported, rejected and skipped as blank.
- **Rejected rows are listed** with their spreadsheet row number and every reason they failed, and can be **downloaded as a CSV** (`<file>-rejected.csv`, with `row_number` and `reason` columns added) to fix and re-upload.
- The file must be comma-separated, UTF-8 and named `.csv`.
- Robust to messy files: quoted fields containing commas, quotes or line breaks, Windows (CRLF) line endings, a UTF-8 byte-order mark, and blank rows. Blank rows are skipped and counted, not treated as errors.
- Oversized (over 1 MB or 5,000 rows), empty, non-UTF-8 or binary files, and files with an unclosed quote, produce a clear message, never a crash.

### Tests (`npm test`)
- Validation rules, sign-up input checks and CSV parsing edge cases (unit tests, no database needed).
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
npx supabase status -o env       # see the table below for where each value goes
npm run dev                      # http://localhost:3000
```

| `supabase status` value | `.env.local` variable |
| --- | --- |
| `API_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `PUBLISHABLE_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `SECRET_KEY` | `SUPABASE_SECRET_KEY` (tests only; never read by the app) |

The first `db:start` downloads the Supabase images and takes a few minutes. Locally, sign-up emails aren't really sent: open Mailpit at http://127.0.0.1:54324 to find the verification link. If Supabase Auth rate-limits the emails, sign-up shows "Too many emails requested. Wait a minute and try again." If port 3000 is taken, `npx next dev -p <port>` works: the allowed redirect URLs accept any local port for `/auth/confirm`.

### Try it

1. Go to `/signup`, enter an email, then open the link from Mailpit. You land on `/set-password`.
2. Set a password. You are signed out and sent to `/login` with "Your password is set"; sign in.
3. Add a task, tick it done, edit it, search for it, and filter by status tab and priority.
4. Open **Import CSV** and upload `samples/edge-case.csv`: 4 imported, 5 rejected, 1 blank row skipped (see below). Upload it again and every valid row is reported as "already exists in your tasks".
5. Download the rejected rows, fix them, and upload that file.
6. For a fuller demo, upload `samples/demo.csv` (10 imported, 13 rejected, 2 blank rows skipped; see below).

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

Local Supabase must be running (`npm run db:start`) with `.env.local` filled in. The integration tests fail with a clear message rather than silently skipping if it isn't. Run them on Node 22+: on older Node, `supabase-js` fails with "Node.js detected but native WebSocket not found".

The suite has 143 tests in 8 files:

| File | Covers |
| --- | --- |
| `tests/unit/credentials.test.ts` | Sign-up email check, new-password rules (8 characters minimum, 72-byte maximum, confirmation match), accepted email-link types |
| `tests/unit/validation.test.ts` | Title, `YYYY-MM-DD` date (format and real-calendar checks, leap years) and priority rules; all reasons reported together |
| `tests/unit/csv-parse.test.ts` | Quoted commas, escaped quotes, quoted newlines, CRLF/LF/mixed endings, BOM, blank rows, header order/case, missing columns, unclosed quotes, row numbering, comma-only delimiter |
| `tests/unit/plan-import.test.ts` | Valid/invalid split, every reason kept, 5,000-row limit |
| `tests/unit/rejects.test.ts` | Rejects CSV escaping, round-trip through the parser, formula guard removed on re-import |
| `tests/integration/rls.test.ts` | Cross-user isolation through the database API: user B can't list, read, update, soft-delete, insert as, or reassign user A's tasks; signed-out access; no hard delete |
| `tests/integration/import.test.ts` | The edge-case file end to end, in-file duplicates (first wins) vs duplicates of existing tasks, soft-deleted tasks, re-import, all-or-nothing transaction |
| `tests/integration/tasks-queries.test.ts` | Search (including `%`, `_`, `*`, regex characters, commas, quotes, brackets taken literally) and combined filters |

**How the isolation test was validated:** with RLS switched off on `public.tasks` (`alter table public.tasks disable row level security;`), four tests in `rls.test.ts` fail (list, read by id, update, soft delete). Re-enabling RLS makes them pass again.

## Project layout

```
src/
  proxy.ts                 Session refresh and optimistic redirects (Next.js 16 "Proxy", formerly middleware)
  app/
    login/ signup/         Sign-in and step 1 of sign-up (pages + Server Actions)
    auth/confirm/route.ts  Landing route for the emailed link
    set-password/          Final sign-up step
    tasks/                 Task list page, Server Actions, error boundary
    import/                CSV import page and Server Action
  components/              UI (task form/list/item, filters, status tabs, import form, header menus)
  lib/
    auth.ts                getCurrentUser / requireUser
    credentials.ts         Email and password rules for sign-up
    tasks/                 Shared validation rules and list/count queries
    csv/                   Parsing, import planning, rejects export
    supabase/              Server client, env checks, generated database types
supabase/
  migrations/              Table, RLS policies, grants, import_tasks function
  templates/               Sign-up email templates
  config.toml              Local Supabase settings
tests/unit/, tests/integration/
samples/                   Example CSV files
docs/                      Requirements and implementation plan
```

| Route | Who | What |
| --- | --- | --- |
| `/` | anyone | Redirects to `/tasks` |
| `/login`, `/signup` | signed out | Signed-in users are sent on to `/tasks` (or `/set-password`) |
| `/auth/confirm` | anyone | Exchanges the email link for a session; bad or expired links go back to `/signup` with an error |
| `/set-password` | signed in, no password yet | Users who still need a password can't reach any other page |
| `/tasks`, `/import` | signed in | Signed-out users are sent to `/login` |

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
- [`samples/demo.csv`](samples/demo.csv) is a fuller file for demos, mixing fair rows with every row-level problem. It starts with a UTF-8 byte-order mark and uses CRLF line endings. Its header is `Priority,Title,Due_Date,Notes,Owner`: the columns are in a different order and case, and `Owner` is an extra column that is ignored. It imports **10** rows, rejects **13** and skips **2** blank rows:

  | Row | Content | Result |
  | --- | --- | --- |
  | 2 | Submit quarterly report | imported |
  | 3 | `"Buy milk, eggs and bread"` (quoted commas in title and notes) | imported |
  | 4 | `"Prepare ""Q4"" slides"` (escaped quotes), empty notes | imported |
  | 5 | Plan team offsite, notes with a line break | imported |
  | 6 | due date `2028-02-29` (leap day) | imported |
  | 7 | `Café supplies ☕` (non-English characters and emoji) | imported |
  | 8 | notes starting with `=SUM(…)` | imported, stored as text |
  | 9 | `"  Water the plants  "` | imported with the spaces trimmed |
  | 10 | `"  BUY MILK, EGGS AND BREAD "`, same date as row 3 | rejected: duplicate of row 3 |
  | 11 | same title as row 3 on a different date | imported (not a duplicate) |
  | 12 | `,,,,` | skipped as blank |
  | 13 | priority `high` | rejected: priority must be a whole number from 1 to 5 |
  | 14 | priority `2.5` | rejected: priority must be a whole number from 1 to 5 |
  | 15 | priority `0` | rejected: priority must be a whole number from 1 to 5 |
  | 16 | priority `6` | rejected: priority must be a whole number from 1 to 5 |
  | 17 | empty title | rejected: title is required |
  | 18 | empty due date | rejected: due_date is required |
  | 19 | due date `05/01/2026` | rejected: due_date must be a real date in YYYY-MM-DD format |
  | 20 | due date `2026-02-30` | rejected: due_date must be a real date in YYYY-MM-DD format |
  | 21 | due date `2027-02-29` (not a leap year) | rejected: due_date must be a real date in YYYY-MM-DD format |
  | 22 | 201-character title | rejected: title must be 200 characters or fewer |
  | 23 | 2,001-character notes | rejected: notes must be 2000 characters or fewer |
  | 24 | no title, due date `13/13/2026`, priority `urgent` | rejected with all three reasons |
  | 25 | cells containing only spaces | skipped as blank |
  | 26 | Tidy the shared drive | imported |

  Uploading it a second time imports nothing: the 10 valid rows are reported as "already exists in your tasks", and row 10 is still a duplicate of row 3.
- [`samples/valid.csv`](samples/valid.csv): four clean rows.

## Design decisions

- **Isolation is enforced by Postgres.** The app only talks to Supabase as the signed-in user (publishable key plus session cookies). RLS policies check `user_id = auth.uid()`. Column-level grants stop clients writing `user_id`, `id` or timestamps, and there is no `DELETE` grant, so tasks can only be soft-deleted. The secret key is used only by the test helper that creates test users.
- **Duplicates are guaranteed by the database as well as the app:** a partial unique index on `(user_id, lower(title), due_date) where deleted_at is null`. Titles are stored trimmed.
- **Import = pure TypeScript core + one Postgres function.** Parsing (papaparse plus our own BOM, blank-row and row-number handling) and validation are pure and unit-tested. The `import_tasks` function (`SECURITY INVOKER`, so RLS applies) inserts every valid row in one statement with `on conflict do nothing` and returns which rows repeated an earlier row in the file and which clashed with existing tasks. Postgres's `lower()` is the only definition of "same title", so the app and the database can't disagree about duplicates. One call is one transaction: any failure means nothing is saved.
- **One set of validation rules** (`src/lib/tasks/validation.ts`) serves both the form and the import. The form uses `<input type="date">`, which always submits `YYYY-MM-DD`.
- **Next.js 16:** `src/proxy.ts` (formerly middleware) refreshes the session and redirects signed-out users, but it is only an optimistic check. Before sending a signed-in user away from `/login` or `/signup` it confirms the session with the auth server, so a revoked session can't loop between `/login` and `/tasks`. `requireUser()` runs in every Server Action and data read. Cache Components stays on: session reads sit behind `<Suspense>`, and no task data is cached.
- **Account creation verifies the email before any password exists.** `/signup` calls `signInWithOtp` (creating the user with `needs_password: true` in their metadata), the emailed link lands on `/auth/confirm`, which exchanges it for a session, and the proxy keeps that user on `/set-password` until they save a password. They are then signed out and sign in with the new password. Signing up with an email that already has an account gives the same response (no account enumeration); its link simply signs the user in.
- **Email templates** (`supabase/templates/`) link to `/auth/confirm?token_hash=…`, so the link works even when opened in a different browser. The hosted project's default templates send a PKCE `?code=` link instead, which `/auth/confirm` also accepts but only in the browser that asked for it. For production, copy the templates into the dashboard (Authentication → Email Templates: Magic Link and Confirm signup) and add `https://<your-domain>/auth/confirm` to the redirect URLs.
- **The rejects file is built in the browser** from the import result, so nothing is stored on the server.

## Known limitations

- Duplicate matching ignores case and surrounding spaces only. Internal spacing (`Buy  milk` vs `Buy milk`) counts as different.
- The list shows at most 500 tasks (no pagination).
- Imports are synchronous and capped at 1 MB / 5,000 rows.
- In the rejects download, cells starting with `=`, `+`, `-` or `@` get a leading `'` so spreadsheets don't run them as formulae. The importer strips a `'` before those characters, so a value that really starts with `'=` loses the `'`.
- There is no per-user cap on the number of tasks.

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

# Task List with CSV Import

A small task-list web app where each signed-in user manages their own tasks and can bulk-import them from a CSV file. It's built with TypeScript, Next.js 16 (App Router), Node.js and PostgreSQL (local Supabase), and per-user isolation is enforced by Postgres row-level security.

> **Status:** planning complete, implementation in progress. This README describes the intended capabilities. Run instructions, test instructions, the screen recording link and "what I'd do next" will be filled in as the build lands.
>
> - Requirements: [`docs/brainstorms/2026-10-08-task-list-csv-import-requirements.md`](docs/brainstorms/2026-10-08-task-list-csv-import-requirements.md)
> - Implementation plan: [`docs/plans/2026-10-08-001-feat-task-list-csv-import-plan.md`](docs/plans/2026-10-08-001-feat-task-list-csv-import-plan.md)

## What the app does

### Accounts and privacy
- Sign up and sign in with email and password.
- Every user sees **only their own tasks**. This is enforced in the database with row-level security, not only in application code, so a bug in the UI or API can't leak another user's data.

### Tasks
- Each task has a **title** (required, up to 200 characters), **notes**, **due date**, **priority** (1–5) and **status** (to do, in progress, done).
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

_Coming with the implementation._ Prerequisites will be Node.js 20+ and Docker.

## AI usage

This project is built with AI assistance (Claude Code). Planning artefacts are in `docs/`, and session transcripts will be added to `ai-log/`.

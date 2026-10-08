---
title: "feat: Task list app with auth, RLS and CSV import"
type: feat
status: completed
date: 2026-10-08
origin: docs/brainstorms/2026-10-08-task-list-csv-import-requirements.md
---

# feat: Task list app with auth, RLS and CSV import

## Overview

Build a single-user-scoped task manager on the existing Next 16 scaffold. It uses local Supabase for Postgres and auth, with row-level security for isolation, and has a server-validated CSV import with duplicate detection and a downloadable rejects file. The exercise is time-boxed to about 3 hours, so units are ordered so that a submittable app exists early and polish comes last.

## Problem Frame

Take-home exercise. Reviewers judge correctness of validation and duplicate handling, database-enforced isolation, robustness against a messy CSV (the required edge-case file), and the AI working process (ai-log). See origin: `docs/brainstorms/2026-10-08-task-list-csv-import-requirements.md`.

## Requirements Trace

- R1–R2 Auth and RLS isolation → Units 2, 3, 8
- R3–R6 Task model, CRUD, soft delete, shared validation → Units 2, 4, 5
- R7–R8 Search, filters, loading/empty/error states → Unit 5
- R9–R13 CSV parsing, validation, blank rows, duplicates → Units 4, 6
- R14–R17 Transactional server import, results, rejects download, limits → Units 6, 7
- R18 Tests → Units 4, 6, 8
- R19–R20 README, ai-log, sample CSV → Unit 9
- Success criterion "isolation test fails if RLS off" → Unit 8

## Scope Boundaries

Carried from origin: no OAuth, magic link or password reset; no email confirmation locally; no restore-deleted UI; no sharing; no background import; no preview-then-confirm step; plain styling only.

## Context & Research

### Relevant Code and Patterns

- Fresh `create-next-app` scaffold: `src/app/layout.tsx`, `src/app/page.tsx`, the `@/*` → `src/*` alias, and `next.config.ts` with `cacheComponents: true` and `partialPrefetching: true`.
- `AGENTS.md`: Next 16 differs from training data, so consult `node_modules/next/dist/docs/` before writing framework code.
- No tests, DB or auth exist yet. No `docs/solutions/`.
- Not yet its own git repo. The folder sits inside the home-directory repo.

### External References (bundled Next 16 docs)

- `01-app/01-getting-started/16-proxy.md`: Middleware is renamed to **Proxy** (`src/proxy.ts`), Node runtime by default, for optimistic checks only (not authorisation).
- `01-app/02-guides/authentication-with-cache-components.md`: with Cache Components, a session/cookie read must sit behind `<Suspense>` (a read outside it is a build error). `export const instant = false` is an escape hatch. Never use plain `use cache` for request-scoped data.
- `01-app/02-guides/server-actions.md`: Server Action bodies are capped at **1 MB** by default. `serverActions.bodySizeLimit` raises it.

## Key Technical Decisions

- **Local Supabase via `npx supabase` (CLI as a devDependency)** (see origin). The schema lives in versioned migrations under `supabase/migrations/`, so `supabase start` / `db reset` reproduces it.
- **Every DB call from the app uses the user's session (anon/publishable key + cookies). The service-role key is never used in app code.** RLS is the real boundary. Server-side checks are only UX. The service-role key appears only in the test helper that creates test users.
- **RLS policies check ownership only (`user_id = auth.uid()`), not `deleted_at`.** If the SELECT policy filtered soft-deleted rows, the soft-delete UPDATE could fail RLS. Deleted rows are hidden in queries instead.
- **`user_id` defaults to `auth.uid()`, with WITH CHECK on insert/update**, so a client can't assign or reassign ownership.
- **DB-level duplicate guarantee: a partial unique index on (user_id, lower(title), due_date) where not deleted.** Titles are stored trimmed. Combined with the import RPC's conflict handling, this is race-safe and matches the origin's normalised-match decision.
- **The import splits into a pure TS core plus one Postgres function.** Parsing, validation and in-file dedupe are pure functions (fast unit tests). Account-level dedupe and the insert happen in a single `SECURITY INVOKER` Postgres function that inserts all valid rows with conflict-do-nothing on the unique index and returns which input rows were skipped as existing. One function call = one transaction, RLS still applies, and the "already exists" check can't race.
- **CSV parsing with papaparse**, a mature parser that handles quotes, embedded newlines and CRLF. Blank-row skipping and BOM stripping are done in our own layer so row numbering stays under our control.
- **Row number = record index + 1 (header is row 1)**, counted over all records including blank ones. That matches what a spreadsheet shows even when a quoted cell spans lines.
- **Upload through a Server Action** with `useActionState`, the body limit raised to about 2 MB, and the 1 MB / 5,000-row app limit enforced inside the action for a friendly error.
- **The rejects CSV is generated client-side** from the action result (papaparse unparse → Blob download). No server storage, and it's escaped correctly.
- **Cache Components stays on. No `use cache` anywhere for task data.** Session-reading sections sit under `<Suspense>`, which also gives the loading state. Fallback if it costs more than about 15 minutes: set `instant = false` on the affected routes, or turn `cacheComponents` off, and record that in the README.
- **Vitest for `npm test`.** Unit tests run with no DB. Integration tests (RLS, import RPC) need local Supabase running and fail with a clear "run `npx supabase start`" message rather than silently skipping.
- **Search uses case-insensitive substring matching** on title and notes, with `%`/`_` escaped. Filters live in the URL search params, so state is shareable and the server-rendered list stays simple.

## Open Questions

### Resolved During Planning

- Isolation test approach → two real users created via the admin API, each signed in with the anon key, run against local Supabase (Unit 8).
- Parser → papaparse, plus our own blank/BOM/row-number layer.
- Transactional insert → a single Postgres function call with conflict-do-nothing on the partial unique index.
- Next 16 auth wiring → `src/proxy.ts` for session refresh and redirects, Suspense-wrapped session reads, a server-side `getUser` check in the data layer.

### Deferred to Implementation

- Exact `@supabase/ssr` cookie adapter shape for the Next 16 Proxy, and whether local CLI keys are `anon` JWTs or `sb_publishable_…`. Check the current Supabase docs/CLI output while wiring.
- Exact conflict-target syntax for inferring a partial expression index in `ON CONFLICT`. Verify against real Postgres. Fallback: an explicit `NOT EXISTS` filter inside the same function (still one transaction, with the index as backstop).
- Whether papaparse strips the BOM itself. Strip it defensively either way.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```mermaid
sequenceDiagram
  participant U as Browser (import form)
  participant A as Server Action importCsv
  participant C as Pure core (lib/csv)
  participant DB as Postgres (RLS, as user)
  U->>A: FormData(file)
  A->>A: auth check, size/type limits
  A->>C: parse → records with row numbers
  C->>C: skip blank rows, validate each row (all reasons)
  C->>C: in-file dedupe (first wins, "duplicate of row N")
  A->>DB: rpc import_tasks(valid rows) — one transaction
  DB-->>A: inserted rows + rows skipped as "already exists"
  A-->>U: {imported, rejected[{row, values, reasons}], blankSkipped}
  U->>U: render table; build rejects CSV client-side on demand
```

## Implementation Units

- [x] **Unit 1: Project setup and tooling**

**Goal:** A clean repo with Supabase local, Vitest and env wiring.

**Requirements:** R18, R19 (foundation)

**Dependencies:** None

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `.env.example`, `vitest.config.ts`, `tests/setup/env.ts`
- Modify: `package.json` (scripts: `test`, `db:start`, `db:reset`; deps: `@supabase/supabase-js`, `@supabase/ssr`, `papaparse`; dev: `supabase`, `vitest`, `@types/papaparse`), `next.config.ts` (`serverActions.bodySizeLimit`), `.gitignore`

**Approach:**
- `git init` inside `task-list-app` so the project is its own repo, not part of the home-directory repo.
- Email confirmations off in local auth config.
- Tests load `.env.local`. `.env.example` documents which values come from `supabase status`.

**Verification:** `npx supabase start` comes up. `npm test` runs (zero tests) and exits 0.

- [x] **Unit 2: Schema, RLS and import function (migration)**

**Goal:** A `tasks` table with ownership RLS, the duplicate index, and a transactional import function.

**Requirements:** R2, R3, R5, R13, R14

**Dependencies:** Unit 1

**Files:**
- Create: `supabase/migrations/<timestamp>_tasks.sql`

**Approach:**
- Columns: id, user_id (default `auth.uid()`, references auth users), title (check: trimmed length 1–200), notes, due_date (date, not null), priority (smallint, check 1–5), status (check in `todo|in_progress|done`, default `todo`), created_at, updated_at, deleted_at.
- RLS enabled and forced. Separate select/insert/update policies, ownership only, for the `authenticated` role. No delete policy (soft delete only), so hard delete is impossible from the client.
- Partial unique index on (user_id, lower(title), due_date) where deleted_at is null. Index for listing by user.
- `import_tasks(rows jsonb)`, SECURITY INVOKER: inserts all rows with conflict-do-nothing, returns the client row numbers that conflicted. Runs as the caller, so RLS applies.
- An updated_at trigger.

**Patterns to follow:** Supabase RLS docs conventions (`(select auth.uid())` form for performance).

**Test scenarios:** Covered by Unit 8 integration tests.

**Verification:** `supabase db reset` applies cleanly. The table shows RLS enabled.

- [x] **Unit 3: Auth (Supabase SSR clients, Proxy, sign-in/up/out)**

**Goal:** Users can sign up, sign in and sign out. Protected routes redirect.

**Requirements:** R1

**Dependencies:** Units 1–2

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts` (only if needed), `src/proxy.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/lib/auth.ts` (`requireUser` helper)
- Modify: `src/app/layout.tsx` (header with user email and sign-out inside Suspense), `src/app/page.tsx` (redirect to `/tasks`)

**Approach:**
- The Proxy refreshes the session cookie and does an optimistic redirect of signed-out users to `/login`. The real check is `requireUser()` (server `getUser`) in every action and data read.
- The login page is one form with sign-in and sign-up submit buttons, both Server Actions. Errors show inline.
- Read `node_modules/next/dist/docs` proxy and auth guides and current `@supabase/ssr` docs before wiring.

**Test scenarios:** Manual: sign up → lands on `/tasks`; sign out → `/tasks` redirects to `/login`; wrong password → inline error.

**Verification:** Two browsers with two accounts each see their own empty list.

- [x] **Unit 4: Shared validation and CSV core (pure)**

**Goal:** One source of truth for task field rules, CSV parsing, blank-row handling, in-file dedupe and rejects export.

**Requirements:** R6, R9–R13, R16

**Dependencies:** Unit 1

**Files:**
- Create: `src/lib/tasks/validation.ts`, `src/lib/csv/parse.ts`, `src/lib/csv/dedupe.ts`, `src/lib/csv/rejects.ts`, `src/lib/csv/types.ts`
- Test: `tests/unit/validation.test.ts`, `tests/unit/csv-parse.test.ts`, `tests/unit/dedupe.test.ts`, `tests/unit/rejects.test.ts`

**Approach:**
- `validateTaskInput` returns normalised values or a list of reasons (all reasons, not first-fail). The date check (R12) accepts only `YYYY-MM-DD`: trim, match `^\d{4}-\d{2}-\d{2}$`, then a real-calendar check (round-trip through UTC date parts). Any failure gives one reason that names the format: "due_date must be a real date in YYYY-MM-DD format". The value stored is the trimmed string, passed to Postgres as a `date`. The priority check is a strict integer regex `^[1-5]$` after trim.
- The parse layer handles BOM strip, case-insensitive header mapping, missing-required-column → file-level error, blank detection (all cells empty after trim), and row numbers.
- The dedupe key is lower(trim(title)) + due_date. The first occurrence wins, and later ones get "Duplicate of row N".

**Execution note:** Test-first. These are the graded rules and they're pure.

**Test scenarios:**
- Title: missing, whitespace-only, exactly 200 (ok), 201 (rejected), trimmed before measuring.
- Date accepted: `2026-01-05`, ` 2026-01-05 ` (trimmed), `2024-02-29` (leap year).
- Date rejected, wrong format: `05-01-2026`, `05/01/2026`, `2026/01/05`, `26-01-05`, `2026-1-5`, `2026-01-05T00:00`.
- Date rejected, not on the calendar: `2026-02-30`, `2025-02-29`, `2026-13-01`, `2026-00-10`.
- Date empty → "due_date is required". Each rejection's reason names the YYYY-MM-DD format.
- Priority: `high`, `2.5`, `0`, `6`, `-1`, `01` (rejected: strict single digit), `3.0` (rejected), empty (required), ` 3 ` ok.
- Multiple failures on one row → all reasons listed.
- Parse: quoted comma `"Buy milk, eggs"` stays one field; escaped quotes; quoted newline; CRLF file; BOM file; trailing newline doesn't add a row; `,,,` and empty lines counted as blank and skipped but still advance row numbers; header in different order/case; missing `priority` header → file error; extra column ignored.
- Dedupe: same title different case/spacing + same date → duplicate of first row number; same title different date → both valid; invalid rows don't participate in dedupe.
- Rejects export: round-trips through the parser, keeps commas/quotes, includes `row_number,reason`.

**Verification:** All unit tests pass with no DB running.

- [x] **Unit 5: Task list, CRUD and states**

**Goal:** A usable task UI with search, filters, create/edit/complete/soft-delete, and loading/empty/error states.

**Requirements:** R3–R8

**Dependencies:** Units 3, 4

**Files:**
- Create: `src/app/tasks/page.tsx`, `src/app/tasks/loading.tsx`, `src/app/tasks/error.tsx`, `src/app/tasks/actions.ts`, `src/lib/tasks/queries.ts`, `src/components/TaskForm.tsx`, `src/components/TaskList.tsx`, `src/components/TaskFilters.tsx`
- Modify: `src/app/globals.css` (minimal plain styles)

**Approach:**
- The list is a server component reading `searchParams` (q, status, priority) inside Suspense. The query always filters `deleted_at is null` and orders by due date then priority.
- Actions: create, update, toggle complete, soft delete (set `deleted_at`). All go through `validateTaskInput`, then `revalidatePath`. Unique-index violation on create/edit → friendly "A task with this title and due date already exists".
- The form's due date uses `<input type="date">`, which submits `YYYY-MM-DD` whatever the browser's display locale, so form and CSV share the same R12 date rule.
- Empty states: no tasks at all (CTA: add or import) vs no results for the filters (clear filters link). Error: `error.tsx` with retry, plus an inline action error for form failures.
- Delete asks for confirmation through an inline UI pattern, not `window.confirm`.

**Test scenarios:** Manual walkthrough in the recording. Validation logic is already covered in Unit 4. Isolation is covered in Unit 8.

**Verification:** Every CRUD path works. Filters combine. Each state is visible (empty account, filter with no matches, simulated error).

- [x] **Unit 6: CSV import action and RPC integration**

**Goal:** A server-side import that returns imported count, rejected rows with reasons, and blank count.

**Requirements:** R12–R15, R17

**Dependencies:** Units 2, 4

**Files:**
- Create: `src/app/import/actions.ts`, `src/lib/csv/import.ts` (orchestrates parse → validate → dedupe → RPC → merge results)
- Test: `tests/integration/import.test.ts`

**Approach:**
- The action enforces auth, file presence, size ≤ 1 MB, ≤ 5,000 data rows, and a .csv/text type. Every failure path returns a typed error result. Nothing throws to the client.
- Rows the RPC reports as conflicting become "Already exists in your tasks". RPC failure → nothing imported (transaction) plus an error message.

**Test scenarios (integration, real DB as a real user):**
- Edge-case file: the right rows are imported, each bad row has the right row number and reason, and the blank row is counted.
- Account duplicate: a pre-existing task (different case/whitespace) → the row is rejected as already existing and the existing task is unchanged.
- A soft-deleted task with the same title/date → the import succeeds.
- Re-importing the same file → 0 imported, all rejected as existing.
- Atomicity: force a DB failure mid-batch (e.g. a row that passes TS validation but violates a DB check, injected directly via the RPC) → zero rows inserted.

**Verification:** Integration tests pass against local Supabase.

- [x] **Unit 7: Import UI and rejects download**

**Goal:** An upload page showing results and offering the rejects CSV.

**Requirements:** R15, R16, R17

**Dependencies:** Unit 6

**Files:**
- Create: `src/app/import/page.tsx`, `src/components/ImportForm.tsx` (client, `useActionState`)

**Approach:** Pending state while uploading. A summary line (imported / rejected / blank skipped). A rejected-rows table (row #, title preview, reasons). A "Download rejected rows" button builds the CSV from the result. A file-level error shows as a banner. A link back to `/tasks`.

**Verification:** The edge-case file shows the expected table. The downloaded file opens correctly in a spreadsheet.

- [x] **Unit 8: RLS isolation tests**

**Goal:** Prove one user can't read or modify another user's tasks at the database layer.

**Requirements:** R2, R18, success criterion

**Dependencies:** Unit 2

**Files:**
- Create: `tests/integration/helpers.ts` (create/sign-in test users via the admin API with unique emails; cleanup), `tests/integration/rls.test.ts`

**Test scenarios:**
- A creates a task. B's select returns no rows, including by A's task id.
- B's update and soft-delete on A's task affect 0 rows, and A's task is unchanged.
- B inserting with `user_id = A` is rejected.
- The anon (signed-out) client reads 0 rows.
- B calling `import_tasks` doesn't see A's tasks as duplicates (B can import the same title/date).
- A hard delete by the owner is rejected (no delete policy).

**Verification:** Tests pass. Manually disabling RLS on the table makes them fail (noted in the README as how the test was validated).

- [x] **Unit 9: Docs, sample data and deliverables**

**Goal:** A submittable repo.

**Requirements:** R19, R20

**Dependencies:** All

**Files:**
- Create: `samples/edge-case.csv`, `samples/valid.csv`, `ai-log/` (session transcripts plus a short index README)
- Modify: `README.md`

**Approach:**
- The README covers prerequisites (Node 20, Docker), setup (`npm i`, `npx supabase start`, copy keys into `.env.local`, `npm run dev`), tests, design decisions (brief), known limitations, what I'd do next, and the recording link.
- `edge-case.csv` contains: a valid row with a quoted comma, a duplicate of it, an empty row, priority `high`, a 201-character title, a CRLF line ending, a wrong-format date (`05/01/2026`) and an impossible date (`2026-02-30`).
- ai-log: export the Claude Code session JSONL transcripts unedited (see the risk below).

**Verification:** A fresh clone, following only the README, reaches a working app and a green `npm test`.

## System-Wide Impact

- **Error propagation:** DB/RPC errors → typed action results → inline UI messages. Unexpected render errors → `error.tsx`. The import never throws to the client.
- **State lifecycle:** Soft-deleted rows stay but are excluded from the list and the unique index, so recreating them is allowed. The import is all-or-nothing for valid rows.
- **Integration coverage:** RLS and RPC behaviour can only be proven against real Postgres, hence the integration tests and the requirement for local Supabase during `npm test`.

## Risks & Dependencies

- **Next 16 + Cache Components friction** (Suspense requirements, Proxy naming): mitigated by reading the bundled docs first. Fallback described in Key Technical Decisions.
- **Supabase local first start** pulls large Docker images. Start it in Unit 1 so it downloads while other work happens.
- **`npm test` needs Docker/Supabase running.** Documented, with a clear failure message.
- **ai-log privacy (needs a user decision before publishing):** the current session transcript includes the auto-attached home-directory git status, which lists personal filenames (e.g. bills and a tax-ID-like upload filename), plus the user's email. The brief demands *unedited* logs in a *public* repo. Options: start future sessions from inside `task-list-app` so new transcripts are clean, and decide whether to publish this planning session as-is, or with a clearly disclosed redaction of personal identifiers only. Don't publish until the user confirms.
- **Time box:** if time runs short, cut in this order: due-date filter (stretch), edit-in-place polish, the atomicity integration test (keep RLS and dedupe tests). Never cut the edge-case demo, RLS tests or README.

## Suggested Time Budget (~3h)

| Block | Units | Time |
|---|---|---|
| Setup + schema | 1, 2 | 25 min |
| Validation/CSV core, test-first | 4 | 35 min |
| Auth | 3 | 25 min |
| Task UI | 5 | 35 min |
| Import action + UI + integration tests | 6, 7, 8 | 40 min |
| README, samples, recording, ai-log | 9 | 20 min |

## Documentation / Operational Notes

- The README's "What I'd do next" list: import preview/confirm step, restore deleted tasks, pagination, e2e tests (Playwright) for the edge-case flow, CI with Supabase in GitHub Actions, hosted deploy (Vercel + Supabase), streaming parse for large files, i18n of dates.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-10-08-task-list-csv-import-requirements.md](../brainstorms/2026-10-08-task-list-csv-import-requirements.md)
- Next 16 bundled docs: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, `01-app/02-guides/authentication-with-cache-components.md`, `01-app/02-guides/server-actions.md`

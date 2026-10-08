---
date: 2026-10-08
topic: task-list-csv-import
---

# Task List App with CSV Import

## Problem Frame
Take-home exercise, time-boxed to about 3 hours. A signed-in user manages their own tasks and bulk-loads them from a CSV file. Reviewers judge correctness (validation, duplicates, data isolation), robustness on a messy file, and how the work was done with AI. Anything that doesn't serve those goes to "what I'd do next".

## Requirements

**Auth and isolation**
- R1. Users sign up and sign in with email and password. Signed-out users are redirected to sign-in.
- R2. Each user can only read and write their own tasks. This is enforced in the database with row-level security, not only in app code.

**Tasks**
- R3. A task has a title (required, 1–200 characters after trimming), notes (optional), due date (required), priority (required, whole number 1–5) and status (`todo`, `in_progress`, `done`).
- R4. Users can create, edit, complete (one-click toggle to `done`, and back) and delete tasks.
- R5. Delete is a soft delete. Deleted tasks disappear from the list and from duplicate checks, but stay in the database.
- R6. The same validation rules apply to the task form and to CSV import.

**List**
- R7. The task list has text search (title and notes) and filters for status and priority. A due-date filter (overdue, today, upcoming) is a stretch goal.
- R8. The list has distinct loading, empty ("no tasks yet" vs "no matches for these filters") and error states. Plain styling.

**CSV import**
- R9. Expected columns are `title, due_date, priority, notes`. A header row is required. Header names are case-insensitive and can come in any order. Unknown columns are ignored. If a required column is missing, the whole file is rejected with a clear message.
- R10. The parser handles quoted fields that contain commas, quotes or newlines, CRLF and LF line endings, and a UTF-8 BOM.
- R11. Fully blank rows (including rows that are only commas) are skipped, not rejected. The summary shows how many were skipped.
- R12. A row is invalid if: the title is missing or over 200 characters, the due_date is missing or not a real `YYYY-MM-DD` date (so 2026-02-30 is rejected), or the priority is missing or not a whole number 1–5 (so `high`, `2.5` and `0` are rejected). All reasons for a row are reported together.
- R13. Duplicate = same title (trimmed, case-insensitive) and same due date as a task already in the account (not deleted) or an earlier row in the same file. The first occurrence in the file wins. Later copies are rejected with "duplicate of row N" or "already exists in your tasks".
- R14. Validation happens on the server. All valid rows are inserted in one transaction: if the insert fails, nothing is imported and the user sees an error.
- R15. The result screen shows how many rows were imported, rejected and blank-skipped, plus a table of rejected rows with row number and reason(s). Row numbers match what a spreadsheet shows (header = row 1).
- R16. Rejected rows can be downloaded as a CSV: the original columns plus `row_number` and `reason`, correctly escaped.
- R17. Files are limited (about 1 MB / 5,000 rows). An oversized, empty or non-CSV file produces a friendly error, never a crash.

**Quality and deliverables**
- R18. `npm test` runs tests covering validation rules, CSV parsing edge cases, duplicate handling (in-file and against the account), and cross-user isolation (user B cannot read or modify user A's tasks through the database API).
- R19. The README covers setup and run commands, how to run tests, the sample edge-case CSV, the screen recording link, and "what I'd do next".
- R20. The repo includes `ai-log/` with the unedited AI session transcripts and a sample `edge-case.csv` matching the required demo.

## Success Criteria
- Uploading the edge-case file (duplicate, empty row, priority `high`, a 201+ character title, a quoted field with a comma) imports the valid rows, lists each bad row with its reason, skips the blank row, and doesn't crash.
- The isolation test fails if row-level security is switched off.
- A fresh clone runs with the documented commands only.

## Scope Boundaries
- No OAuth, magic link or password reset. No email confirmation locally.
- No restoring deleted tasks in the UI, no pagination beyond a sane limit, no sharing or collaboration.
- No async or background import. Synchronous is enough at this file size.
- No preview-then-confirm import step (noted under "next").
- No styling work beyond clean defaults.

## Key Decisions
- Local Supabase (CLI in Docker): native `auth.uid()` row-level security, real auth, and reproducible tests against a real database.
- Normalised duplicate matching, ignoring soft-deleted tasks: matches what a user means by a duplicate, and delete-then-reimport works.
- due_date and priority are required in both the CSV and the form: a stricter reading of the spec with simpler rules.
- Blank rows are skipped, not rejected: they're formatting noise, not user intent. They're counted so nothing is silent.
- The database also guarantees uniqueness, not only the app check, so two imports running at once can't create duplicates.

## Outstanding Questions

### Deferred to Planning
- [Affects R2, R18][Technical] Isolation test approach: two users signed in through supabase-js with the anon key, against local Supabase.
- [Affects R10][Technical] CSV parser library choice (e.g. papaparse) versus hand-rolled.
- [Affects R14][Technical] Transactional insert: a Postgres function (RPC) under the user's row-level security context, or a single multi-row insert.
- [Affects R1][Needs research] Next 16 conventions for middleware/proxy and the Server Actions + `@supabase/ssr` setup. Read `node_modules/next/dist/docs` per AGENTS.md.

## Next Steps
→ `/ce:plan` for structured implementation planning

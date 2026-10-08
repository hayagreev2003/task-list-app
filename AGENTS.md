<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository layout

This project is a **planned monorepo**. Today it is a single Next.js app at the repo root; it will move to a workspace layout as it grows. Target layout:

```
apps/web/        Next.js app (UI, route handlers, server actions)
packages/*       Shared code (types, validation, utilities)
supabase/        Supabase CLI project: migrations, RLS policies and their tests (stays at the repo root)
```

- Until the move happens, follow the current single-app layout; don't create workspace folders unless the task asks for it.
- After the move, install packages in the workspace that uses them, not at the root. Resolve `next` and its bundled docs from `apps/web/node_modules`, since it may not be visible from the root.
- `next dev` writes its managed block into the `AGENTS.md` next to the Next.js app. After the move, keep repo-wide rules here and expect that block in `apps/web/AGENTS.md`.

## Required skills

Load the matching skill(s) **before** writing or changing code in each area. If a task spans several areas, load every skill that applies.

| Area | Skills to load | Applies to |
| --- | --- | --- |
| Frontend / UI | `vercel-react-best-practices`, `vercel-composition-patterns` | React components, pages, layouts, client/server components, hooks, state, data fetching in the UI, styling |
| Backend (Node.js) | `nodejs-backend-patterns` | Route handlers, server actions, API design, middleware, auth, error handling, validation, service/data-access layers |
| Database (PostgreSQL) | `supabase-postgres-best-practices` | Schema design, column types, migrations, RLS policies, indexes, triggers, functions, queries, connection handling, query performance |
| Testing (frontend and backend) | `javascript-testing-patterns` | Unit, integration and end-to-end tests, test setup, mocks and fixtures |

### Database

- PostgreSQL is hosted on **Supabase** (free tier) for deployment. Postgres in Docker may be used for local development; keep schema and migrations compatible with both.
- Migrations use the **Supabase CLI** (`npx supabase`, a devDependency) as plain-SQL files in `supabase/migrations/`. Do not add Alembic, Prisma Migrate, Drizzle Kit or any other migration tool.
  - New migration: `npx supabase migration new <name>`, then write the SQL.
  - Rebuild local DB from migrations: `npx supabase db reset`.
  - Deploy to the hosted project: `npx supabase db push`.
- Every schema change goes through a migration; never change the hosted database by hand or edit a migration that has already been pushed.
- Enable Row Level Security on every table exposed through Supabase, and cover policies with tests.
- Never commit Supabase keys or connection strings. Read them from environment variables (`.env.local`, which is gitignored). The `service_role` key is server-only and must never reach client code.
- Mind free-tier limits (connections, storage, project pausing on inactivity): use the Supabase connection pooler for serverless/runtime connections.

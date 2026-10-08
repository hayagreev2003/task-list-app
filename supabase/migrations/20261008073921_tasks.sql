-- Tasks: one row per task, owned by a single user. Isolation is enforced by RLS.

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  notes       text,
  due_date    date not null,
  priority    smallint not null,
  status      text not null default 'todo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint tasks_title_trimmed_length check (
    title = btrim(title) and char_length(title) between 1 and 200
  ),
  constraint tasks_priority_range check (priority between 1 and 5),
  constraint tasks_status_valid check (status in ('todo', 'in_progress', 'done'))
);

comment on table public.tasks is 'User tasks. Soft-deleted rows have deleted_at set.';

-- Duplicate guarantee: same title (case-insensitive; titles are stored trimmed) and due date
-- per user, ignoring soft-deleted rows. Also serves lookups by user_id.
create unique index tasks_user_title_due_unique
  on public.tasks (user_id, lower(title), due_date)
  where deleted_at is null;

-- Default list order: live tasks by due date, then priority.
create index tasks_user_due_priority_idx
  on public.tasks (user_id, due_date, priority)
  where deleted_at is null;

-- updated_at maintenance
create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Privileges: least privilege on top of RLS.
-- No DELETE for clients (soft delete only). user_id, id and timestamps can't be written directly.
revoke all on table public.tasks from anon, authenticated;
grant select on table public.tasks to authenticated;
grant insert (title, notes, due_date, priority, status) on table public.tasks to authenticated;
grant update (title, notes, due_date, priority, status, deleted_at) on table public.tasks to authenticated;

-- Row-level security: ownership only. Soft-deleted rows are filtered by queries, not policies,
-- so the soft-delete UPDATE itself still passes the policy check.
alter table public.tasks enable row level security;
alter table public.tasks force row level security;

create policy "Users can read their own tasks"
  on public.tasks for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own tasks"
  on public.tasks for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own tasks"
  on public.tasks for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- CSV import: inserts all rows in one statement (one transaction) as the calling user, so RLS
-- applies. Rows that collide with an existing live task, or with an earlier row in the same
-- batch, are skipped. Returns the inserted count and the client row numbers that were skipped.
--
-- rows: [{ "row_number": int, "title": text, "due_date": "YYYY-MM-DD", "priority": int, "notes": text|null }]
create function public.import_tasks(rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer;
  skipped integer[];
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(rows) is distinct from 'array' then
    raise exception 'rows must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(rows) > 5000 then
    raise exception 'too many rows (max 5000)' using errcode = '22023';
  end if;

  with input as (
    select r.row_number, r.title, r.due_date, r.priority, r.notes
    from jsonb_to_recordset(rows)
      as r (row_number integer, title text, due_date date, priority smallint, notes text)
  ),
  inserted as (
    insert into public.tasks (title, due_date, priority, notes)
    select title, due_date, priority, notes
    from input
    order by row_number
    on conflict (user_id, lower(title), due_date) where deleted_at is null
    do nothing
    returning lower(title) as title_key, due_date
  ),
  ranked as (
    select i.row_number, lower(i.title) as title_key, i.due_date,
           row_number() over (partition by lower(i.title), i.due_date order by i.row_number) as rank
    from input i
  )
  select
    (select count(*) from inserted),
    coalesce(array_agg(r.row_number order by r.row_number) filter (
      where r.rank > 1
         or not exists (
           select 1 from inserted ins
           where ins.title_key = r.title_key and ins.due_date = r.due_date
         )
    ), '{}')
  into inserted_count, skipped
  from ranked r;

  return jsonb_build_object('inserted', inserted_count, 'skipped_row_numbers', to_jsonb(skipped));
end;
$$;

revoke execute on function public.import_tasks(jsonb) from public, anon;
grant execute on function public.import_tasks(jsonb) to authenticated;

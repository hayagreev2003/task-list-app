-- import_tasks now also reports which skipped rows repeat an earlier row in the same batch, and
-- which row that was. The app used to work this out in TypeScript, but JS toLowerCase() and
-- Postgres lower() can fold non-ASCII text differently, so the database is now the only judge.
--
-- Returns:
--   inserted             number of rows inserted
--   skipped_row_numbers  every skipped row (kept for compatibility)
--   duplicates           [{ row_number, first_row_number }] for rows that repeat an earlier row
--                        in the batch; any other skipped row clashed with an existing live task
create or replace function public.import_tasks(rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer;
  skipped integer[];
  duplicates jsonb;
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
           row_number() over w as rank,
           first_value(i.row_number) over w as first_row_number
    from input i
    window w as (partition by lower(i.title), i.due_date order by i.row_number)
  )
  select
    (select count(*) from inserted),
    coalesce(array_agg(r.row_number order by r.row_number) filter (
      where r.rank > 1
         or not exists (
           select 1 from inserted ins
           where ins.title_key = r.title_key and ins.due_date = r.due_date
         )
    ), '{}'),
    coalesce(jsonb_agg(
      jsonb_build_object('row_number', r.row_number, 'first_row_number', r.first_row_number)
      order by r.row_number
    ) filter (where r.rank > 1), '[]')
  into inserted_count, skipped, duplicates
  from ranked r;

  return jsonb_build_object(
    'inserted', inserted_count,
    'skipped_row_numbers', to_jsonb(skipped),
    'duplicates', duplicates
  );
end;
$$;

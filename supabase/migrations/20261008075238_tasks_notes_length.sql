-- Cap notes length in the database too, so direct API calls can't store unbounded text.
-- Matches NOTES_MAX_LENGTH in src/lib/tasks/validation.ts.
alter table public.tasks
  add constraint tasks_notes_length check (notes is null or char_length(notes) <= 2000);

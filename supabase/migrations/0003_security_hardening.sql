-- Phase 7 — L1: prevent direct client writes to public.users.email and
-- public.users.evaluations_count.
--
-- The existing "users update own" policy (0001_init.sql) lets a signed-in
-- user UPDATE their own row, and the guard_plan_change trigger already stops
-- them from touching `plan`. This migration closes the same gap for the two
-- other columns nothing in the app is meant to let a user edit directly:
--   - email should only ever mirror auth.users.email (set once at signup by
--     handle_new_user()).
--   - evaluations_count is not currently read by the app (evaluationStore.js
--     counts rows in public.evaluations directly), so leaving it writable
--     would be a silent trap for any future code that trusts it.
--
-- Run in the Supabase SQL editor (or `supabase db push`) after 0002_payments.sql.

create or replace function public.guard_user_columns()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Prevent direct writes to email and evaluations_count
  if new.email <> old.email then
    raise exception 'email cannot be changed directly';
  end if;
  if new.evaluations_count <> old.evaluations_count then
    raise exception 'evaluations_count cannot be changed directly';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_user_columns_trigger on public.users;
create trigger guard_user_columns_trigger
  before update on public.users
  for each row execute function public.guard_user_columns();

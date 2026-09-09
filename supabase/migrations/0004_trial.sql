-- Phase 7 — H3: 7-day free trial for Pro/Team, no credit card required.
-- Run in the Supabase SQL editor (or `supabase db push`) after 0003_security_hardening.sql.
--
-- trial_ends_at / trial_plan are deliberately added WITHOUT a default value.
-- `alter table ... add column ... default X` backfills X onto every existing
-- row, not just future ones — a bare default here would hand every existing
-- free user (including ones who signed up years ago) a brand-new 7-day Pro
-- trial the moment this migration runs. Only handle_new_user() sets these
-- columns, so only genuinely new signups get a trial; existing rows stay
-- NULL (= no trial, resolves to "free").

alter table public.users
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_plan text check (trial_plan in ('pro', 'team'));

-- Every new user gets a 7-day Pro trial automatically at signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, trial_ends_at, trial_plan)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      ''
    ),
    now() + interval '7 days',
    'pro'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The "users update own" policy (0001) lets a signed-in user UPDATE their own
-- row, and guard_user_columns() (0003) already stops them from touching
-- email/evaluations_count directly. Extend it so a user can't grant
-- themselves (or extend) a trial by writing trial_ends_at/trial_plan
-- straight from the client — only handle_new_user()'s initial insert (which
-- this UPDATE trigger doesn't run for) or the service role may set them.
create or replace function public.guard_user_columns()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.email <> old.email then
    raise exception 'email cannot be changed directly';
  end if;
  if new.evaluations_count <> old.evaluations_count then
    raise exception 'evaluations_count cannot be changed directly';
  end if;
  if coalesce(auth.role(), '') <> 'service_role' then
    if new.trial_ends_at is distinct from old.trial_ends_at then
      raise exception 'trial_ends_at cannot be changed directly';
    end if;
    if new.trial_plan is distinct from old.trial_plan then
      raise exception 'trial_plan cannot be changed directly';
    end if;
  end if;
  return new;
end;
$$;

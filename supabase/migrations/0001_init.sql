-- Phase 7 — auth + plans schema for RFQ Evaluator.
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.

-- ─────────────────────────────────────────────────────────────────────────────
-- users: 1:1 profile row for each auth.users record
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  name              text,
  plan              text not null default 'free' check (plan in ('free', 'pro', 'team')),
  evaluations_count integer not null default 0,
  created_at        timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "users read own" on public.users;
create policy "users read own"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "users update own" on public.users;
create policy "users update own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- The plan column is billing-controlled: only the service role (the payment
-- webhook in the Cloudflare Worker, Phase 7b) may change it. A user updating
-- their own name/row cannot escalate their plan.
create or replace function public.guard_plan_change()
returns trigger
language plpgsql
as $$
begin
  if new.plan is distinct from old.plan and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'plan can only be changed by the billing service';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_plan on public.users;
create trigger guard_plan
  before update on public.users
  for each row execute function public.guard_plan_change();

-- Auto-provision a profile row when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- evaluations: one row per saved evaluation, full payload in `data`
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.evaluations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists evaluations_user_created
  on public.evaluations (user_id, created_at desc);

alter table public.evaluations enable row level security;

drop policy if exists "eval read own" on public.evaluations;
create policy "eval read own"
  on public.evaluations for select
  using (auth.uid() = user_id);

drop policy if exists "eval insert own" on public.evaluations;
create policy "eval insert own"
  on public.evaluations for insert
  with check (auth.uid() = user_id);

drop policy if exists "eval update own" on public.evaluations;
create policy "eval update own"
  on public.evaluations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "eval delete own" on public.evaluations;
create policy "eval delete own"
  on public.evaluations for delete
  using (auth.uid() = user_id);

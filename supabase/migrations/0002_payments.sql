-- Phase 7 — H2: payment audit trail + idempotency.
-- Run in the Supabase SQL editor (or `supabase db push`) after 0001_init.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- payments: one row per provider payment we've acted on. The UNIQUE
-- (provider, provider_payment_id) constraint is the idempotency key — a Stripe
-- session can be verified (or re-delivered by webhook) any number of times and
-- only ever upgrades the account once.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users (id) on delete cascade,
  provider            text not null check (provider in ('stripe')),
  provider_payment_id text not null,
  amount              integer not null,
  currency            text not null default 'SAR',
  plan                text not null check (plan in ('pro', 'team')),
  status              text not null check (status in ('pending', 'completed', 'failed')),
  created_at          timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create index if not exists payments_user_created
  on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

-- Users can see their own payment history; nothing else is exposed.
drop policy if exists "users read own payments" on public.payments;
create policy "users read own payments"
  on public.payments for select
  using (auth.uid() = user_id);

-- Writes come only from the billing service (the Cloudflare Worker) using the
-- service-role key, which bypasses RLS. This policy is scoped to that role so a
-- logged-in user can't forge a payment row (which would poison the idempotency
-- check or the audit trail). There is deliberately no UPDATE/DELETE policy —
-- only the service role may change a row.
drop policy if exists "service role insert payments" on public.payments;
create policy "service role insert payments"
  on public.payments for insert
  with check (coalesce(auth.role(), '') = 'service_role');

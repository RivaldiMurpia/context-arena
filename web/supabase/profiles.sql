-- Context Arena — wallet identity (profiles)
-- Run this in the Supabase SQL editor (one time).
--
-- Design:
--   * `wallet` is the lowercase 0x address (primary key).
--   * `username` is unique case-insensitively (username_lower).
--   * Row Level Security: anyone can read; only the service_role key
--     (used by our Next.js API route, never shipped to browsers) can write.
--     The API route verifies a wallet signature before every write.

create table if not exists public.profiles (
  wallet text primary key check (wallet ~ '^0x[0-9a-f]{40}$'),
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  username_lower text
    generated always as (lower(username)) stored
    unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read"
  on public.profiles for select
  using (true);

-- No insert/update/delete policies on purpose: only service_role bypasses
-- RLS, and service_role is only used server-side after signature checks.

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Context Arena: user profiles (Supabase / Postgres)
-- Run this once in the Supabase SQL editor after creating a free project.
--
-- What it creates:
--   profiles(wallet_address PK, username UNIQUE, created_at, updated_at)
--   - wallet_address is stored lowercase, e.g. 0x6af5...
--   - username: 3-20 chars, letters/numbers/underscore, enforced in DB
--   - public can READ profiles (usernames are public identity)
--   - NOBODY can write directly: all writes go through the Next.js
--     API route, which verifies a wallet signature and uses the
--     service_role key server-side.

create table if not exists profiles (
  wallet_address text primary key,
  username text not null unique
    constraint username_format check (username ~ '^[a-zA-Z0-9_]{3,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Public read: usernames are public identity (leaderboard, bet history, etc.)
drop policy if exists "profiles are publicly readable" on profiles;
create policy "profiles are publicly readable"
  on profiles for select
  using (true);

-- No insert/update/delete policies on purpose: writes happen only via the
-- Next.js API route with the service_role key after signature verification.

create index if not exists profiles_username_idx on profiles (username);

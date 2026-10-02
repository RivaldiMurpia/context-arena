-- Context Arena — profiles v2: single username change + bio
-- Run this in the Supabase SQL editor (one time, after profiles.sql).
--
--   * username_changes: how many renames have been used. The API allows
--     exactly one rename per wallet, then the name is locked forever.
--   * bio: free-form profile text, editable anytime (160 chars max).

alter table public.profiles
  add column if not exists username_changes smallint not null default 0
    check (username_changes >= 0 and username_changes <= 1),
  add column if not exists bio text not null default ''
    check (char_length(bio) <= 160);

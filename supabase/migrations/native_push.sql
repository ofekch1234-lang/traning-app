-- Installed app device tokens (applied 2026-10-25, migration native_push_tokens). APNs now, FCM later.
create table if not exists public.native_push (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios','android')),
  env text not null default 'production' check (env in ('production','sandbox')),
  updated_at timestamptz not null default now()
);
create index if not exists native_push_user on public.native_push(user_id);
alter table public.native_push enable row level security;
-- policy native_push_own: a signed-in user reads / deletes only their own rows
-- native_push_register(token, platform, env): security definer upsert; a device that changes hands moves to the new user
-- Sender: supabase/functions/rest-push (secret APNS_KEY_P8, key id N4H9UH778U, team 9KC26568TD)

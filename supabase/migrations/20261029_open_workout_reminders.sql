-- applied 2026-10-29: a push 2 hours after a workout started if it is still open (once per workout, up to 12 hours)
create table if not exists public.workout_open_nudges (user_id uuid not null, start bigint not null, sent_at timestamptz not null default now(), primary key (user_id, start));
alter table public.workout_open_nudges enable row level security;
-- function public.open_workout_reminders(dry boolean) and cron 'nextrep-open-workout' (*/15 * * * *): see the migration of the same name in the project

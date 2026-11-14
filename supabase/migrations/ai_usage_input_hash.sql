alter table public.ai_usage add column if not exists input_hash text;
create index if not exists ai_usage_user_kind_time on public.ai_usage (user_id, kind, created_at desc);

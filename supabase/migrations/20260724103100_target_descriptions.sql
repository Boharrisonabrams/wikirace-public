alter table public.daily_challenges
  add column if not exists start_description text,
  add column if not exists end_description text;

alter table public.friend_challenges
  add column if not exists start_description text,
  add column if not exists end_description text;

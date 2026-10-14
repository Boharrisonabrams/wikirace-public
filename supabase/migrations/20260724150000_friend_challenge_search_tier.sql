alter table public.friend_challenges
  add column if not exists search_tier text not null default 'find'
  check (search_tier in ('find', 'palette'));

-- WikiPath core schema (canonical).
-- Idempotent: safe on a fresh database AND on a project that previously ran
-- supabase-schema.sql (it upgrades that schema in place).
--
-- Design: the game is SERVER-AUTHORITATIVE. Clients never write game rows
-- directly; the API server (service role) is the only writer for
-- game_sessions / game_moves / daily_challenges. RLS write policies for
-- clients are therefore dropped, and leaderboards are exposed via
-- security-definer RPCs.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- FRIEND CODE GENERATOR
-- ─────────────────────────────────────────────
create or replace function public.generate_friend_code()
returns text
language sql
volatile
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 31))::int + 1, 1), '')
  from generate_series(1, 6)
$$;

-- ─────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists friend_code text;

update public.profiles set friend_code = public.generate_friend_code() where friend_code is null;
create unique index if not exists profiles_friend_code_key on public.profiles (friend_code);

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- ─────────────────────────────────────────────
-- USER STATS
-- ─────────────────────────────────────────────
create table if not exists public.user_stats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique not null,
  games_played integer default 0 not null,
  games_won integer default 0 not null,
  total_time_seconds integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.user_stats add column if not exists total_clicks integer default 0 not null;
alter table public.user_stats add column if not exists current_streak integer default 0 not null;
alter table public.user_stats add column if not exists longest_streak integer default 0 not null;
alter table public.user_stats add column if not exists last_daily_completed date;
alter table public.user_stats add column if not exists best_daily_rank integer;

alter table public.user_stats enable row level security;

-- Stats are shown on profiles and leaderboards → world-readable.
drop policy if exists "Users can view their own stats" on public.user_stats;
drop policy if exists "Stats are viewable by everyone" on public.user_stats;
create policy "Stats are viewable by everyone"
  on public.user_stats for select using (true);

-- Writes go through the API server (service role); no client write policies.
drop policy if exists "Users can update their own stats" on public.user_stats;
drop policy if exists "Users can insert their own stats" on public.user_stats;

-- Backfill stats rows for any existing users.
insert into public.user_stats (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ─────────────────────────────────────────────
-- PROFILE + STATS BOOTSTRAP ON SIGNUP
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_code text;
begin
  v_username := nullif(trim(new.raw_user_meta_data->>'username'), '');
  if v_username is null then
    v_username := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_username := v_username || substr(replace(gen_random_uuid()::text, '-', ''), 1, 3);
  end loop;

  v_code := public.generate_friend_code();
  while exists (select 1 from public.profiles where friend_code = v_code) loop
    v_code := public.generate_friend_code();
  end loop;

  insert into public.profiles (id, username, display_name, friend_code)
  values (new.id, v_username, nullif(trim(new.raw_user_meta_data->>'display_name'), ''), v_code);

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- DAILY CHALLENGES
-- ─────────────────────────────────────────────
create table if not exists public.daily_challenges (
  id uuid default gen_random_uuid() primary key,
  challenge_date date unique not null,
  start_article text not null,
  end_article text not null,
  start_article_title text not null,
  end_article_title text not null,
  created_at timestamptz default now() not null
);

alter table public.daily_challenges enable row level security;

drop policy if exists "Daily challenges are viewable by everyone" on public.daily_challenges;
create policy "Daily challenges are viewable by everyone"
  on public.daily_challenges for select using (true);

-- The old policy was `with check (true)` (any client could insert). Server-only now.
drop policy if exists "Only service role can insert daily challenges" on public.daily_challenges;
create policy "Only service role can insert daily challenges"
  on public.daily_challenges for insert to service_role with check (true);

-- ─────────────────────────────────────────────
-- FRIEND CHALLENGES (head-to-head via share link)
-- ─────────────────────────────────────────────
create table if not exists public.friend_challenges (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references auth.users(id) on delete cascade not null,
  start_article text not null,
  end_article text not null,
  start_article_title text not null,
  end_article_title text not null,
  created_at timestamptz default now() not null
);

alter table public.friend_challenges enable row level security;

drop policy if exists "Friend challenges are viewable by everyone" on public.friend_challenges;
create policy "Friend challenges are viewable by everyone"
  on public.friend_challenges for select using (true);

-- Created via the API server (service role) so article titles are validated.

-- ─────────────────────────────────────────────
-- GAME SESSIONS
-- ─────────────────────────────────────────────
create table if not exists public.game_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  challenge_type text not null check (challenge_type in ('daily', 'practice', 'friend')),
  challenge_id uuid references public.daily_challenges(id) on delete set null,
  start_article text not null,
  end_article text not null,
  path text[] default '{}' not null,
  clicks integer default 0 not null,
  completed boolean default false not null,
  won boolean default false not null,
  gave_up boolean default false not null,
  time_seconds integer,
  completed_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.game_sessions add column if not exists friend_challenge_id uuid references public.friend_challenges(id) on delete set null;

create index if not exists game_sessions_user_idx on public.game_sessions (user_id);
create index if not exists game_sessions_daily_leaderboard_idx
  on public.game_sessions (challenge_id, won, clicks, time_seconds)
  where won = true and challenge_id is not null;
create index if not exists game_sessions_friend_challenge_idx
  on public.game_sessions (friend_challenge_id)
  where friend_challenge_id is not null;

alter table public.game_sessions enable row level security;

drop policy if exists "Users can view their own sessions" on public.game_sessions;
create policy "Users can view their own sessions"
  on public.game_sessions for select using (auth.uid() = user_id);

-- Server-authoritative: clients may no longer write sessions directly.
drop policy if exists "Users can insert their own sessions" on public.game_sessions;
drop policy if exists "Users can update their own sessions" on public.game_sessions;

-- ─────────────────────────────────────────────
-- GAME MOVES (audit trail; one row per validated click)
-- ─────────────────────────────────────────────
create table if not exists public.game_moves (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  move_number integer not null,
  from_article text not null,
  to_article text not null,
  created_at timestamptz default now() not null,
  unique (session_id, move_number)
);

create index if not exists game_moves_session_idx on public.game_moves (session_id, move_number);

alter table public.game_moves enable row level security;

drop policy if exists "Users can read their own game moves" on public.game_moves;
create policy "Users can read their own game moves"
  on public.game_moves for select
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = game_moves.session_id and gs.user_id = auth.uid()
    )
  );

drop policy if exists "Service role inserts game moves" on public.game_moves;
create policy "Service role inserts game moves"
  on public.game_moves for insert to service_role with check (true);

-- ─────────────────────────────────────────────
-- FRIENDSHIPS
-- ─────────────────────────────────────────────
create table if not exists public.friendships (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  friend_id uuid references auth.users(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz default now() not null,
  unique(user_id, friend_id)
);

alter table public.friendships enable row level security;

drop policy if exists "Users can view their own friendships" on public.friendships;
create policy "Users can view their own friendships"
  on public.friendships for select using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "Users can manage their own friendships" on public.friendships;
create policy "Users can create friend requests"
  on public.friendships for insert with check (auth.uid() = user_id);
create policy "Users can delete their own friendships"
  on public.friendships for delete using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "Recipients can respond to friend requests"
  on public.friendships for update using (auth.uid() = friend_id);

-- ─────────────────────────────────────────────
-- LEADERBOARD RPCs
-- ─────────────────────────────────────────────
drop function if exists public.get_daily_leaderboard(uuid, integer, integer);
drop function if exists public.get_daily_leaderboard(uuid, integer, integer, boolean);

create function public.get_daily_leaderboard(
  p_challenge_id uuid,
  p_limit integer default 50,
  p_offset integer default 0,
  p_friends_only boolean default false
)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  clicks integer,
  time_seconds integer,
  completed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over (order by gs.clicks asc, gs.time_seconds asc, gs.completed_at asc) as rank,
    gs.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    gs.clicks,
    gs.time_seconds,
    gs.completed_at
  from public.game_sessions gs
  left join public.profiles p on p.id = gs.user_id
  where gs.challenge_id = p_challenge_id
    and gs.won = true
    and gs.completed = true
    and (
      not p_friends_only
      or gs.user_id = auth.uid()
      or exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.user_id = auth.uid() and f.friend_id = gs.user_id)
            or (f.friend_id = auth.uid() and f.user_id = gs.user_id))
      )
    )
  order by gs.clicks asc, gs.time_seconds asc, gs.completed_at asc
  limit p_limit
  offset p_offset;
$$;

grant execute on function public.get_daily_leaderboard(uuid, integer, integer, boolean) to anon, authenticated;

drop function if exists public.get_challenge_results(uuid);

create function public.get_challenge_results(p_challenge_id uuid)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  clicks integer,
  time_seconds integer,
  won boolean,
  gave_up boolean,
  path text[],
  completed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    row_number() over (order by gs.won desc, gs.clicks asc, gs.time_seconds asc, gs.completed_at asc) as rank,
    gs.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    gs.clicks,
    gs.time_seconds,
    gs.won,
    gs.gave_up,
    gs.path,
    gs.completed_at
  from public.game_sessions gs
  left join public.profiles p on p.id = gs.user_id
  where gs.friend_challenge_id = p_challenge_id
    and gs.completed = true
  order by gs.won desc, gs.clicks asc, gs.time_seconds asc, gs.completed_at asc;
$$;

grant execute on function public.get_challenge_results(uuid) to anon, authenticated;

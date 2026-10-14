-- Daily Ritual database foundation.
--
-- Adds official/replay identity, fair active-play timing, claimed profiles,
-- controlled challenge metadata, and separate Shortest/Fastest leaderboards.

-- ─────────────────────────────────────────────
-- DAILY CHALLENGE METADATA
-- ─────────────────────────────────────────────
alter table public.daily_challenges
  add column if not exists difficulty text not null default 'medium'
    check (difficulty in ('easy', 'medium', 'hard')),
  add column if not exists difficulty_source text not null default 'provisional',
  add column if not exists generator_version integer not null default 1,
  add column if not exists generator_seed text,
  add column if not exists start_topic text,
  add column if not exists end_topic text,
  add column if not exists start_recognition text,
  add column if not exists end_recognition text;

-- ─────────────────────────────────────────────
-- OFFICIAL ATTEMPTS, REPLAYS, AND ACTIVE TIMING
-- ─────────────────────────────────────────────
alter table public.game_sessions
  add column if not exists attempt_number integer not null default 1,
  add column if not exists is_official boolean not null default true,
  add column if not exists local_date date,
  add column if not exists timezone_at_start text,
  add column if not exists active_time_ms bigint not null default 0,
  add column if not exists active_started_at timestamptz,
  add column if not exists timing_version integer not null default 1;

-- Sessions completed before active timing existed only have the legacy
-- duration projection. Preserve that known duration so they cannot appear as
-- zero-millisecond winners on the Fastest board after this migration.
update public.game_sessions
set active_time_ms = greatest(time_seconds, 0)::bigint * 1000
where completed
  and active_time_ms = 0
  and time_seconds is not null;

-- Existing schemas allowed more than one Daily session per user/challenge.
-- Prefer a completed attempt, then deterministically preserve the oldest row as
-- official so the partial unique index can be added without losing any rows.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, challenge_id
      order by completed desc, created_at asc, id asc
    ) as attempt_number
  from public.game_sessions
  where challenge_id is not null
)
update public.game_sessions gs
set attempt_number = ranked.attempt_number,
    is_official = (ranked.attempt_number = 1)
from ranked
where gs.id = ranked.id;

alter table public.game_sessions
  drop constraint if exists game_sessions_official_attempt_number_check;

alter table public.game_sessions
  add constraint game_sessions_official_attempt_number_check
  check (
    (is_official and attempt_number = 1)
    or (not is_official and attempt_number > 1)
  );

create unique index if not exists game_sessions_unique_daily_attempt_number
  on public.game_sessions (user_id, challenge_id, attempt_number)
  where challenge_id is not null;

create unique index if not exists game_sessions_one_official_daily
  on public.game_sessions (user_id, challenge_id)
  where is_official and challenge_id is not null;

-- The partial unique index enforces at most one official attempt. This deferred
-- final-state check supplies the other half of the invariant: every nonempty
-- user/challenge group must retain one official attempt. Deferral permits an
-- official and replay to be inserted together, while a zero-row final state
-- keeps whole-group and auth-user cascade deletion valid.
create or replace function public.enforce_daily_session_official_group()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_total bigint;
  v_official bigint;
begin
  if tg_op = 'DELETE'
    or (
      tg_op = 'UPDATE'
      and (
        old.user_id is distinct from new.user_id
        or old.challenge_id is distinct from new.challenge_id
      )
    )
  then
    if old.challenge_id is not null then
      select
        count(*),
        count(*) filter (where gs.is_official)
      into v_total, v_official
      from public.game_sessions gs
      where gs.user_id = old.user_id
        and gs.challenge_id = old.challenge_id;

      if v_total > 0 and v_official <> 1 then
        raise exception
          'Daily session group (user_id %, challenge_id %) must contain exactly one official attempt',
          old.user_id,
          old.challenge_id
          using
            errcode = '23514',
            constraint = 'game_sessions_exactly_one_official_daily';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.challenge_id is not null then
      select
        count(*),
        count(*) filter (where gs.is_official)
      into v_total, v_official
      from public.game_sessions gs
      where gs.user_id = new.user_id
        and gs.challenge_id = new.challenge_id;

      if v_total > 0 and v_official <> 1 then
        raise exception
          'Daily session group (user_id %, challenge_id %) must contain exactly one official attempt',
          new.user_id,
          new.challenge_id
          using
            errcode = '23514',
            constraint = 'game_sessions_exactly_one_official_daily';
      end if;
    end if;
  end if;

  return null;
end;
$$;

revoke all on function public.enforce_daily_session_official_group()
  from public, anon, authenticated;

drop trigger if exists game_sessions_exactly_one_official_daily
  on public.game_sessions;

create constraint trigger game_sessions_exactly_one_official_daily
  after insert or update or delete on public.game_sessions
  deferrable initially deferred
  for each row
  execute function public.enforce_daily_session_official_group();

create index if not exists game_sessions_official_shortest_leaderboard_idx
  on public.game_sessions (challenge_id, clicks, active_time_ms, completed_at)
  where is_official and completed and won and challenge_id is not null;

create index if not exists game_sessions_official_fastest_leaderboard_idx
  on public.game_sessions (challenge_id, active_time_ms, clicks, completed_at)
  where is_official and completed and won and challenge_id is not null;

-- ─────────────────────────────────────────────
-- CLAIMED PROFILES
-- ─────────────────────────────────────────────
alter table public.profiles add column if not exists claimed_at timestamptz;

-- RLS chooses which profile row a user may edit; column privileges choose what
-- they may edit. Anonymous identities also use the authenticated database role,
-- so this keeps claimed_at (and other server-owned fields) out of both clients'
-- self-update surface without breaking display-name/avatar edits.
revoke update on table public.profiles from anon, authenticated;
revoke update (claimed_at) on table public.profiles from anon, authenticated;
grant update (username, display_name, avatar_url, updated_at)
  on table public.profiles to authenticated;
grant update on table public.profiles to service_role;

update public.profiles p
set claimed_at = coalesce(p.claimed_at, now())
where exists (
  select 1
  from auth.users u
  where u.id = p.id
    and not u.is_anonymous
);

-- Preserve the existing profile/stats bootstrap while keeping anonymous users
-- unclaimed. Account conversion later claims the same profile explicitly.
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

  insert into public.profiles (
    id,
    username,
    display_name,
    friend_code,
    claimed_at
  )
  values (
    new.id,
    v_username,
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    v_code,
    case when new.is_anonymous is false then now() else null end
  );

  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- IDEMPOTENT TIMING TRANSITIONS
-- ─────────────────────────────────────────────
create table if not exists public.game_timing_events (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  event_id uuid not null,
  action text not null check (action in ('resume', 'pause', 'heartbeat')),
  created_at timestamptz not null default now(),
  primary key (session_id, event_id)
);

alter table public.game_timing_events enable row level security;

drop function if exists public.transition_game_timing(uuid, uuid, text, uuid);

create function public.transition_game_timing(
  p_session_id uuid,
  p_user_id uuid,
  p_action text,
  p_event_id uuid
)
returns table (
  active_time_ms bigint,
  active_started_at timestamptz,
  timing_version integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.game_sessions%rowtype;
  v_event_rows integer;
  v_now timestamptz;
  v_elapsed_ms bigint;
begin
  if p_action is null or p_action not in ('resume', 'pause', 'heartbeat') then
    raise exception 'Invalid timing action: %', p_action
      using errcode = '22023';
  end if;

  -- Event inserts take a foreign-key key-share lock. Serialize per session so
  -- concurrent transitions cannot deadlock while upgrading to the row lock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_session_id::text, 0)
  );

  insert into public.game_timing_events (session_id, event_id, action)
  values (p_session_id, p_event_id, p_action)
  on conflict (session_id, event_id) do nothing;
  get diagnostics v_event_rows = row_count;

  select gs.*
  into v_session
  from public.game_sessions gs
  where gs.id = p_session_id
    and gs.user_id = p_user_id
    and not gs.completed
  for update;

  if not found then
    raise exception 'Owned incomplete game session not found'
      using errcode = 'P0002';
  end if;

  -- A repeated event returns the currently stored state without applying the
  -- transition twice.
  if v_event_rows = 1 then
    v_now := clock_timestamp();

    if v_session.active_started_at is not null then
      v_elapsed_ms := greatest(
        0::bigint,
        floor(extract(epoch from (v_now - v_session.active_started_at)) * 1000)::bigint
      );
    else
      v_elapsed_ms := 0;
    end if;

    if p_action = 'resume' and v_session.active_started_at is null then
      update public.game_sessions gs
      set active_started_at = v_now,
          updated_at = v_now
      where gs.id = p_session_id;
    elsif p_action = 'pause' and v_session.active_started_at is not null then
      update public.game_sessions gs
      set active_time_ms = gs.active_time_ms + v_elapsed_ms,
          active_started_at = null,
          updated_at = v_now
      where gs.id = p_session_id;
    elsif p_action = 'heartbeat' and v_session.active_started_at is not null then
      update public.game_sessions gs
      set active_time_ms = gs.active_time_ms + least(v_elapsed_ms, 15000::bigint),
          active_started_at = v_now,
          updated_at = v_now
      where gs.id = p_session_id;
    end if;
  end if;

  return query
  select
    gs.active_time_ms,
    gs.active_started_at,
    gs.timing_version
  from public.game_sessions gs
  where gs.id = p_session_id;
end;
$$;

revoke all on function public.transition_game_timing(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.transition_game_timing(uuid, uuid, text, uuid)
  to service_role;

-- ─────────────────────────────────────────────
-- SHORTEST AND FASTEST DAILY LEADERBOARDS
-- ─────────────────────────────────────────────
drop function if exists public.get_daily_leaderboard_v2(uuid, text, integer, integer, boolean);

create function public.get_daily_leaderboard_v2(
  p_challenge_id uuid,
  p_board text default 'shortest',
  p_limit integer default 50,
  p_offset integer default 0,
  p_friends_only boolean default false
)
returns table (
  rank bigint,
  shortest_rank bigint,
  fastest_rank bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  clicks integer,
  time_seconds integer,
  active_time_ms bigint,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_board is null or p_board not in ('shortest', 'fastest') then
    raise exception 'Invalid leaderboard board: %', p_board
      using errcode = '22023';
  end if;

  return query
  with eligible as (
    select
      gs.id,
      gs.user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      gs.clicks,
      gs.time_seconds,
      gs.active_time_ms,
      gs.completed_at
    from public.game_sessions gs
    join public.profiles p on p.id = gs.user_id
    where gs.challenge_id = p_challenge_id
      and gs.is_official
      and gs.completed
      and gs.won
      and p.claimed_at is not null
      and (
        not coalesce(p_friends_only, false)
        or gs.user_id = auth.uid()
        or exists (
          select 1
          from public.friendships f
          where f.status = 'accepted'
            and (
              (f.user_id = auth.uid() and f.friend_id = gs.user_id)
              or (f.friend_id = auth.uid() and f.user_id = gs.user_id)
            )
        )
      )
  ),
  ranked as (
    select
      e.*,
      row_number() over (
        order by e.clicks asc, e.active_time_ms asc, e.completed_at asc, e.id asc
      ) as shortest_rank,
      row_number() over (
        order by e.active_time_ms asc, e.clicks asc, e.completed_at asc, e.id asc
      ) as fastest_rank
    from eligible e
  )
  select
    case
      when p_board = 'shortest' then r.shortest_rank
      else r.fastest_rank
    end as rank,
    r.shortest_rank,
    r.fastest_rank,
    r.user_id,
    r.username,
    r.display_name,
    r.avatar_url,
    r.clicks,
    r.time_seconds,
    r.active_time_ms,
    r.completed_at
  from ranked r
  order by
    case when p_board = 'shortest' then r.shortest_rank end asc,
    case when p_board = 'fastest' then r.fastest_rank end asc
  limit p_limit
  offset p_offset;
end;
$$;

grant execute on function public.get_daily_leaderboard_v2(uuid, text, integer, integer, boolean)
  to anon, authenticated;

drop function if exists public.get_daily_player_ranks(uuid, uuid);

create function public.get_daily_player_ranks(
  p_challenge_id uuid,
  p_user_id uuid
)
returns table (
  shortest_rank bigint,
  fastest_rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select
      gs.id,
      gs.user_id,
      gs.clicks,
      gs.active_time_ms,
      gs.completed_at
    from public.game_sessions gs
    join public.profiles p on p.id = gs.user_id
    where gs.challenge_id = p_challenge_id
      and gs.is_official
      and gs.completed
      and gs.won
      and p.claimed_at is not null
  ),
  ranked as (
    select
      e.user_id,
      row_number() over (
        order by e.clicks asc, e.active_time_ms asc, e.completed_at asc, e.id asc
      ) as shortest_rank,
      row_number() over (
        order by e.active_time_ms asc, e.clicks asc, e.completed_at asc, e.id asc
      ) as fastest_rank
    from eligible e
  )
  select r.shortest_rank, r.fastest_rank
  from ranked r
  where r.user_id = p_user_id;
$$;

revoke all on function public.get_daily_player_ranks(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_daily_player_ranks(uuid, uuid)
  to service_role;

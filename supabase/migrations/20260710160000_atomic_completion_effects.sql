-- Make completion, Official Daily statistics/streaks, and private challenge
-- completion events one transaction. The rebuild repairs legacy counters that
-- were previously updated outside the completion transaction.

create or replace function public.rebuild_official_daily_stats(
  p_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_updated integer;
begin
  -- Completion v2 takes the matching shared lock. Run this only after all old
  -- API instances have drained so the rebuild sees a closed set of writers.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wikipath:completion-effects-rebuild', 0)
  );

  insert into public.user_stats (user_id)
  select u.id
  from auth.users u
  where p_user_id is null or u.id = p_user_id
  on conflict (user_id) do nothing;

  with official_totals as (
    select
      gs.user_id,
      count(*)::integer as games_played,
      count(*) filter (where gs.won)::integer as games_won,
      coalesce(sum(greatest(gs.clicks, 0)), 0)::integer as total_clicks,
      coalesce(
        sum(greatest(
          coalesce(gs.time_seconds, round(gs.active_time_ms / 1000.0)::integer, 0),
          0
        )),
        0
      )::integer as total_time_seconds
    from public.game_sessions gs
    where gs.completed
      and gs.challenge_type = 'daily'
      and gs.is_official
      and gs.challenge_id is not null
      and (p_user_id is null or gs.user_id = p_user_id)
    group by gs.user_id
  ),
  valid_winning_dates as (
    select distinct gs.user_id, dc.challenge_date
    from public.game_sessions gs
    join public.daily_challenges dc on dc.id = gs.challenge_id
    where gs.completed
      and gs.won
      and gs.challenge_type = 'daily'
      and gs.is_official
      and dc.challenge_date = coalesce(gs.local_date, dc.challenge_date)
      and dc.challenge_date = case
        when gs.timezone_at_start is not null
          and exists (
            select 1
            from pg_catalog.pg_timezone_names zone
            where zone.name = gs.timezone_at_start
          )
        then (
          coalesce(gs.completed_at, gs.updated_at)
            at time zone gs.timezone_at_start
        )::date
        else (
          coalesce(gs.completed_at, gs.updated_at)
            at time zone 'UTC'
        )::date
      end
      and (p_user_id is null or gs.user_id = p_user_id)
  ),
  numbered_wins as (
    select
      user_id,
      challenge_date,
      challenge_date - (
        row_number() over (partition by user_id order by challenge_date)
      )::integer as run_key
    from valid_winning_dates
  ),
  streak_runs as (
    select
      user_id,
      count(*)::integer as run_length,
      max(challenge_date) as run_end
    from numbered_wins
    group by user_id, run_key
  ),
  streak_totals as (
    select
      user_id,
      (array_agg(run_length order by run_end desc))[1]::integer as current_streak,
      max(run_length)::integer as longest_streak,
      max(run_end) as last_daily_completed
    from streak_runs
    group by user_id
  ),
  rebuilt as (
    select
      u.id as user_id,
      coalesce(t.games_played, 0) as games_played,
      coalesce(t.games_won, 0) as games_won,
      coalesce(t.total_clicks, 0) as total_clicks,
      coalesce(t.total_time_seconds, 0) as total_time_seconds,
      coalesce(s.current_streak, 0) as current_streak,
      coalesce(s.longest_streak, 0) as longest_streak,
      s.last_daily_completed
    from auth.users u
    left join official_totals t on t.user_id = u.id
    left join streak_totals s on s.user_id = u.id
    where p_user_id is null or u.id = p_user_id
  )
  update public.user_stats stats
  set
    games_played = rebuilt.games_played,
    games_won = rebuilt.games_won,
    total_clicks = rebuilt.total_clicks,
    total_time_seconds = rebuilt.total_time_seconds,
    current_streak = rebuilt.current_streak,
    longest_streak = rebuilt.longest_streak,
    last_daily_completed = rebuilt.last_daily_completed,
    updated_at = now()
  from rebuilt
  where stats.user_id = rebuilt.user_id;

  get diagnostics v_updated = row_count;

  insert into public.challenge_link_events (
    challenge_id,
    event_type,
    session_id,
    user_id,
    created_at
  )
  select
    gs.friend_challenge_id,
    'complete',
    gs.id,
    gs.user_id,
    coalesce(gs.completed_at, gs.updated_at, now())
  from public.game_sessions gs
  where gs.completed
    and gs.friend_challenge_id is not null
    and (p_user_id is null or gs.user_id = p_user_id)
  on conflict do nothing;

  return v_updated;
end;
$$;

revoke all on function public.rebuild_official_daily_stats(uuid)
  from public, anon, authenticated;
grant execute on function public.rebuild_official_daily_stats(uuid)
  to service_role;

-- Keep complete_game_session v1 intact while old API instances drain. After
-- the v2 API is fully deployed, invoke rebuild_official_daily_stats(null) once
-- through the service role to repair legacy counters and completion events.
drop function if exists public.complete_game_session_v2(uuid, uuid, boolean);

create function public.complete_game_session_v2(
  p_session_id uuid,
  p_user_id uuid,
  p_gave_up boolean
)
returns table (
  did_complete boolean,
  session jsonb,
  streak jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.game_sessions%rowtype;
  v_stats public.user_stats%rowtype;
  v_now timestamptz;
  v_elapsed_ms bigint;
  v_active_time_ms bigint;
  v_last_article text;
  v_turn_path text[];
  v_won boolean;
  v_challenge_date date;
  v_bound_date date;
  v_completion_date date;
  v_current_streak integer;
  v_longest_streak integer;
  v_last_daily_completed date;
  v_streak_extended boolean := false;
begin
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('wikipath:completion-effects-rebuild', 0)
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_session_id::text, 0)
  );

  select gs.*
  into v_session
  from public.game_sessions gs
  where gs.id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Session not found';
  end if;
  if v_session.user_id is distinct from p_user_id then
    raise exception using errcode = '42501', message = 'Forbidden';
  end if;

  select case
    when v_session.clicks <= 0
      or count(*) <> v_session.clicks
      or min(moves.move_number) <> 1
      or max(moves.move_number) <> v_session.clicks
    then null
    else array[v_session.start_article]
      || array_agg(moves.to_article order by moves.move_number)
  end
  into v_turn_path
  from public.game_moves moves
  where moves.session_id = p_session_id;

  insert into public.user_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  if v_session.completed then
    if v_session.friend_challenge_id is not null then
      insert into public.challenge_link_events (
        challenge_id,
        event_type,
        session_id,
        user_id
      ) values (
        v_session.friend_challenge_id,
        'complete',
        v_session.id,
        v_session.user_id
      )
      on conflict do nothing;
    end if;

    select stats.*
    into v_stats
    from public.user_stats stats
    where stats.user_id = p_user_id;

    return query select
      false,
      to_jsonb(v_session) || jsonb_build_object('turn_path', to_jsonb(v_turn_path)),
      jsonb_build_object(
        'current', v_stats.current_streak,
        'longest', v_stats.longest_streak,
        'extended', false
      );
    return;
  end if;

  v_now := clock_timestamp();
  if v_session.active_started_at is null then
    v_elapsed_ms := 0;
  else
    v_elapsed_ms := greatest(
      0::bigint,
      floor(extract(epoch from (v_now - v_session.active_started_at)) * 1000)::bigint
    );
  end if;
  v_active_time_ms := greatest(
    0::bigint,
    v_session.active_time_ms + v_elapsed_ms
  );
  v_last_article := v_session.path[array_length(v_session.path, 1)];
  v_won := not coalesce(p_gave_up, false)
    and lower(trim(replace(v_last_article, '_', ' ')))
      = lower(trim(replace(v_session.end_article, '_', ' ')));

  update public.game_sessions gs
  set
    completed = true,
    won = v_won,
    gave_up = coalesce(p_gave_up, false),
    active_time_ms = v_active_time_ms,
    active_started_at = null,
    time_seconds = round(v_active_time_ms / 1000.0)::integer,
    completed_at = v_now,
    updated_at = v_now
  where gs.id = p_session_id
  returning gs.* into v_session;

  select stats.*
  into v_stats
  from public.user_stats stats
  where stats.user_id = p_user_id
  for update;

  v_current_streak := v_stats.current_streak;
  v_longest_streak := v_stats.longest_streak;
  v_last_daily_completed := v_stats.last_daily_completed;

  if v_session.challenge_type = 'daily'
    and v_session.is_official
    and v_session.challenge_id is not null
  then
    if v_won then
      select dc.challenge_date
      into v_challenge_date
      from public.daily_challenges dc
      where dc.id = v_session.challenge_id;

      v_bound_date := coalesce(v_session.local_date, v_challenge_date);
      if v_session.timezone_at_start is not null
        and exists (
          select 1
          from pg_catalog.pg_timezone_names zone
          where zone.name = v_session.timezone_at_start
        )
      then
        v_completion_date := (v_now at time zone v_session.timezone_at_start)::date;
      else
        v_completion_date := (v_now at time zone 'UTC')::date;
      end if;

      if v_challenge_date = v_bound_date
        and v_bound_date = v_completion_date
      then
        if v_stats.last_daily_completed = v_challenge_date then
          v_streak_extended := false;
        elsif v_stats.last_daily_completed = v_challenge_date - 1 then
          v_current_streak := v_stats.current_streak + 1;
          v_longest_streak := greatest(v_stats.longest_streak, v_current_streak);
          v_last_daily_completed := v_challenge_date;
          v_streak_extended := true;
        else
          v_current_streak := 1;
          v_longest_streak := greatest(v_stats.longest_streak, 1);
          v_last_daily_completed := v_challenge_date;
          v_streak_extended := true;
        end if;
      end if;
    end if;

    update public.user_stats stats
    set
      games_played = stats.games_played + 1,
      games_won = stats.games_won + case when v_won then 1 else 0 end,
      total_clicks = stats.total_clicks + v_session.clicks,
      total_time_seconds = stats.total_time_seconds + v_session.time_seconds,
      current_streak = v_current_streak,
      longest_streak = v_longest_streak,
      last_daily_completed = v_last_daily_completed,
      updated_at = v_now
    where stats.user_id = p_user_id
    returning stats.* into v_stats;
  end if;

  if v_session.friend_challenge_id is not null then
    insert into public.challenge_link_events (
      challenge_id,
      event_type,
      session_id,
      user_id
    ) values (
      v_session.friend_challenge_id,
      'complete',
      v_session.id,
      v_session.user_id
    )
    on conflict do nothing;
  end if;

  return query select
    true,
    to_jsonb(v_session) || jsonb_build_object('turn_path', to_jsonb(v_turn_path)),
    jsonb_build_object(
      'current', v_stats.current_streak,
      'longest', v_stats.longest_streak,
      'extended', v_streak_extended
    );
end;
$$;

revoke all on function public.complete_game_session_v2(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.complete_game_session_v2(uuid, uuid, boolean)
  to service_role;

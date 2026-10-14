-- Keep shared challenges behind the API boundary and make move persistence
-- atomic with respect to completion.

drop policy if exists "Friend challenges are viewable by everyone"
  on public.friend_challenges;
revoke all on table public.friend_challenges from public, anon, authenticated;

revoke all on function public.get_challenge_results(uuid)
  from public, anon, authenticated;
grant execute on function public.get_challenge_results(uuid)
  to service_role;

-- Preserve every historical session but quarantine duplicate attempts from the
-- shared board before enforcing one attempt. The earliest row is canonical.
with ranked_shared_attempts as (
  select
    id,
    row_number() over (
      partition by user_id, friend_challenge_id
      order by created_at asc, id asc
    ) as attempt_order
  from public.game_sessions
  where friend_challenge_id is not null
)
update public.game_sessions gs
set friend_challenge_id = null,
    updated_at = now()
from ranked_shared_attempts ranked
where gs.id = ranked.id
  and ranked.attempt_order > 1;

create unique index if not exists game_sessions_one_shared_attempt_idx
  on public.game_sessions (user_id, friend_challenge_id)
  where friend_challenge_id is not null;

create or replace function public.record_game_move(
  p_session_id uuid,
  p_user_id uuid,
  p_move_number integer,
  p_from_article text,
  p_to_article text,
  p_new_path text[],
  p_won boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_completed boolean;
  v_clicks integer;
  v_path text[];
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_session_id::text, 0)
  );

  select user_id, completed, clicks, path
  into v_user_id, v_completed, v_clicks, v_path
  from public.game_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Session not found';
  end if;
  if v_user_id is distinct from p_user_id then
    raise exception using errcode = '42501', message = 'Forbidden';
  end if;
  if v_completed then
    raise exception using errcode = 'P0002', message = 'Game already completed';
  end if;
  if p_move_number <> v_clicks + 1
    or v_path[array_length(v_path, 1)] is distinct from p_from_article then
    raise exception using errcode = '23505', message = 'Move already recorded';
  end if;

  insert into public.game_moves (
    session_id,
    move_number,
    from_article,
    to_article
  ) values (
    p_session_id,
    p_move_number,
    p_from_article,
    p_to_article
  );

  update public.game_sessions
  set
    path = p_new_path,
    clicks = p_move_number,
    won = p_won,
    updated_at = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.record_game_move(
  uuid, uuid, integer, text, text, text[], boolean
) from public, anon, authenticated;
grant execute on function public.record_game_move(
  uuid, uuid, integer, text, text, text[], boolean
) to service_role;

create or replace function public.complete_game_session(
  p_session_id uuid,
  p_user_id uuid,
  p_gave_up boolean
)
returns table (
  did_complete boolean,
  session jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.game_sessions%rowtype;
  v_now timestamptz;
  v_elapsed_ms bigint;
  v_active_time_ms bigint;
  v_last_article text;
  v_won boolean;
begin
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
  if v_session.completed then
    return query select false, to_jsonb(v_session);
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

  return query select true, to_jsonb(v_session);
end;
$$;

revoke all on function public.complete_game_session(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.complete_game_session(uuid, uuid, boolean)
  to service_role;

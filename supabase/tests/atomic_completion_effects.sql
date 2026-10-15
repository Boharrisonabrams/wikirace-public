begin;

select plan(28);

select is(
  has_function_privilege(
    'anon',
    'public.rebuild_official_daily_stats(uuid)',
    'execute'
  ),
  false,
  'anonymous clients cannot invoke the authoritative stats rebuild'
);

select is(
  has_function_privilege(
    'service_role',
    'public.rebuild_official_daily_stats(uuid)',
    'execute'
  ),
  true,
  'the API service role can invoke the authoritative stats rebuild'
);

select is(
  has_function_privilege(
    'anon',
    'public.complete_game_session_v2(uuid,uuid,boolean)',
    'execute'
  ),
  false,
  'anonymous clients cannot execute atomic completion effects'
);

select is(
  has_function_privilege(
    'service_role',
    'public.complete_game_session_v2(uuid,uuid,boolean)',
    'execute'
  ),
  true,
  'the API service role can execute atomic completion effects'
);

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  is_anonymous,
  created_at,
  updated_at
) values
  ('30000000-0000-4000-8000-000000000001', 'repair@example.test', '{}'::jsonb, false, now(), now()),
  ('30000000-0000-4000-8000-000000000002', 'atomic@example.test', '{}'::jsonb, false, now(), now()),
  ('30000000-0000-4000-8000-000000000003', 'rollback@example.test', '{}'::jsonb, false, now(), now()),
  ('30000000-0000-4000-8000-000000000004', 'private@example.test', '{}'::jsonb, false, now(), now());

insert into public.daily_challenges (
  id,
  challenge_date,
  start_article,
  end_article,
  start_article_title,
  end_article_title
) values
  ('30000000-0000-4000-8000-000000000010', current_date - 1, 'Start', 'Target', 'Start', 'Target'),
  ('30000000-0000-4000-8000-000000000011', current_date, 'Start', 'Target', 'Start', 'Target');

-- Seed the repair user with two real Daily wins plus completed Practice and
-- Friend sessions. The deliberately polluted counters model the legacy API,
-- which incremented stats outside the completion transaction.
insert into public.friend_challenges (
  id,
  creator_id,
  start_article,
  end_article,
  start_article_title,
  end_article_title
) values (
  '30000000-0000-4000-8000-000000000020',
  '30000000-0000-4000-8000-000000000004',
  'Start',
  'Target',
  'Start',
  'Target'
);

insert into public.game_sessions (
  id,
  user_id,
  challenge_type,
  challenge_id,
  friend_challenge_id,
  start_article,
  end_article,
  path,
  clicks,
  completed,
  won,
  gave_up,
  time_seconds,
  active_time_ms,
  completed_at,
  local_date,
  timezone_at_start
) values
  (
    '30000000-0000-4000-8000-000000000101',
    '30000000-0000-4000-8000-000000000001',
    'daily',
    '30000000-0000-4000-8000-000000000010',
    null,
    'Start', 'Target', array['Start', 'Target'], 2,
    true, true, false, 7, 7000,
    (current_date - 1)::timestamp + interval '12 hours',
    current_date - 1,
    'UTC'
  ),
  (
    '30000000-0000-4000-8000-000000000102',
    '30000000-0000-4000-8000-000000000001',
    'daily',
    '30000000-0000-4000-8000-000000000011',
    null,
    'Start', 'Target', array['Start', 'Target'], 3,
    true, true, false, 8, 8000,
    current_date::timestamp + interval '12 hours',
    current_date,
    'UTC'
  ),
  (
    '30000000-0000-4000-8000-000000000103',
    '30000000-0000-4000-8000-000000000001',
    'practice',
    null,
    null,
    'Start', 'Target', array['Start', 'Target'], 40,
    true, true, false, 90, 90000, now(), null, null
  ),
  (
    '30000000-0000-4000-8000-000000000104',
    '30000000-0000-4000-8000-000000000001',
    'friend',
    null,
    '30000000-0000-4000-8000-000000000020',
    'Start', 'Target', array['Start'], 0,
    true, false, true, 11, 11000, now(), null, null
  );

update public.user_stats
set games_played = 99,
    games_won = 88,
    total_clicks = 777,
    total_time_seconds = 666,
    current_streak = 55,
    longest_streak = 55,
    last_daily_completed = current_date - 20
where user_id = '30000000-0000-4000-8000-000000000001';

select lives_ok(
  $$ select public.rebuild_official_daily_stats('30000000-0000-4000-8000-000000000001') $$,
  'official Daily statistics can be rebuilt from authoritative sessions'
);

select is(
  (
    select row(games_played, games_won, total_clicks, total_time_seconds)::text
    from public.user_stats
    where user_id = '30000000-0000-4000-8000-000000000001'
  ),
  row(2, 2, 5, 15)::text,
  'repair removes Practice and Friend pollution while restoring Daily totals'
);

select is(
  (
    select row(current_streak, longest_streak, last_daily_completed)::text
    from public.user_stats
    where user_id = '30000000-0000-4000-8000-000000000001'
  ),
  row(2, 2, current_date)::text,
  'repair reconstructs the current and longest Daily streak'
);

-- A first official Daily completion must commit the session and all effects
-- together. A retry returns the stored result without incrementing twice.
insert into public.game_sessions (
  id,
  user_id,
  challenge_type,
  challenge_id,
  start_article,
  end_article,
  path,
  clicks,
  active_time_ms,
  local_date,
  timezone_at_start
) values (
  '30000000-0000-4000-8000-000000000201',
  '30000000-0000-4000-8000-000000000002',
  'daily',
  '30000000-0000-4000-8000-000000000011',
  'Start',
  'Target',
  array['Start', 'Target'],
  2,
  3000,
  current_date,
  'UTC'
);

create temporary table first_completion as
select *
from public.complete_game_session_v2(
  '30000000-0000-4000-8000-000000000201',
  '30000000-0000-4000-8000-000000000002',
  false
);

select is((select did_complete from first_completion), true, 'first completion wins the guard');
select ok(
  (select (session->>'completed')::boolean and (session->>'won')::boolean from first_completion),
  'the winning session is committed'
);
select is(
  (select session->>'turn_path' from first_completion),
  null::text,
  'an incomplete legacy move audit falls back to the stored path'
);
select is(
  (select row(games_played, games_won, total_clicks, total_time_seconds)::text
   from public.user_stats where user_id = '30000000-0000-4000-8000-000000000002'),
  row(1, 1, 2, 3)::text,
  'official Daily counters commit with the session'
);
select is(
  (select streak->>'extended' from first_completion),
  'true',
  'the first result reports a streak extension'
);

create temporary table repeated_completion as
select *
from public.complete_game_session_v2(
  '30000000-0000-4000-8000-000000000201',
  '30000000-0000-4000-8000-000000000002',
  false
);

select is((select did_complete from repeated_completion), false, 'retry returns the stored completion');
select is(
  (select streak->>'extended' from repeated_completion),
  'false',
  'a retry does not claim another streak extension'
);
select is(
  (select row(games_played, games_won, total_clicks, total_time_seconds)::text
   from public.user_stats where user_id = '30000000-0000-4000-8000-000000000002'),
  row(1, 1, 2, 3)::text,
  'a completion retry does not double-count stats'
);

-- If an effect write fails, the transaction must leave the session incomplete
-- so the same request can be retried safely.
insert into public.game_sessions (
  id, user_id, challenge_type, challenge_id, start_article, end_article,
  path, clicks, active_time_ms, local_date, timezone_at_start
) values (
  '30000000-0000-4000-8000-000000000301',
  '30000000-0000-4000-8000-000000000003',
  'daily',
  '30000000-0000-4000-8000-000000000011',
  'Start', 'Target', array['Start', 'Target'], 1, 2000, current_date, 'UTC'
);

create function pg_temp.fail_atomic_stats_update()
returns trigger
language plpgsql
as $$
begin
  if new.user_id = '30000000-0000-4000-8000-000000000003' then
    raise exception using errcode = 'P9001', message = 'forced stats failure';
  end if;
  return new;
end;
$$;

create trigger fail_atomic_stats_update
before update on public.user_stats
for each row execute function pg_temp.fail_atomic_stats_update();

select throws_ok(
  $$ select * from public.complete_game_session_v2(
    '30000000-0000-4000-8000-000000000301',
    '30000000-0000-4000-8000-000000000003',
    false
  ) $$,
  'P9001',
  'forced stats failure',
  'a failed effect aborts completion'
);

select is(
  (select completed from public.game_sessions where id = '30000000-0000-4000-8000-000000000301'),
  false,
  'the failed effect rolls back the session completion'
);

drop trigger fail_atomic_stats_update on public.user_stats;

select lives_ok(
  $$ select * from public.complete_game_session_v2(
    '30000000-0000-4000-8000-000000000301',
    '30000000-0000-4000-8000-000000000003',
    false
  ) $$,
  'the rolled-back completion is retryable'
);

select is(
  (select row(completed, won)::text from public.game_sessions where id = '30000000-0000-4000-8000-000000000301'),
  row(true, true)::text,
  'the retry commits the winning session'
);
select is(
  (select row(games_played, games_won)::text from public.user_stats where user_id = '30000000-0000-4000-8000-000000000003'),
  row(1, 1)::text,
  'the retry applies official effects exactly once'
);

-- The alias case uses its own friend challenge.
-- game_sessions_one_shared_attempt_idx allows one session per player per
-- shared challenge, and session ...0401 below is this player's attempt at
-- challenge ...0020.
insert into public.friend_challenges (
  id,
  creator_id,
  start_article,
  end_article,
  start_article_title,
  end_article_title,
  end_article_aliases
) values (
  '30000000-0000-4000-8000-000000000021',
  '30000000-0000-4000-8000-000000000004',
  'Start',
  'Tiger',
  'Start',
  'Tiger',
  array['Tigers']
);

insert into public.game_sessions (
  id, user_id, challenge_type, friend_challenge_id, start_article, end_article,
  path, clicks, active_time_ms
) values (
  '30000000-0000-4000-8000-000000000402',
  '30000000-0000-4000-8000-000000000004',
  'friend',
  '30000000-0000-4000-8000-000000000021',
  'Start', 'Tiger', array['Start', 'Tigers'], 1, 3000
);

select is(
  (
    select (session->>'won')::boolean
    from public.complete_game_session_v2(
      '30000000-0000-4000-8000-000000000402',
      '30000000-0000-4000-8000-000000000004',
      false
    )
  ),
  true,
  'completion treats redirect aliases as wins'
);
select is(
  (select row(completed, won)::text from public.game_sessions where id = '30000000-0000-4000-8000-000000000402'),
  row(true, true)::text,
  'alias wins persist on the stored session'
);
select is(
  (select games_played from public.user_stats where user_id = '30000000-0000-4000-8000-000000000004'),
  0,
  'alias-based private wins still do not affect Official Daily statistics'
);

-- Private results generate their funnel completion event in the same RPC, but
-- never change Official Daily statistics. Retrying backfills/idempotently keeps
-- one event.
insert into public.game_sessions (
  id, user_id, challenge_type, friend_challenge_id, start_article, end_article,
  path, clicks, active_time_ms
) values (
  '30000000-0000-4000-8000-000000000401',
  '30000000-0000-4000-8000-000000000004',
  'friend',
  '30000000-0000-4000-8000-000000000020',
  'Start', 'Target', array['Start', 'Target'], 3, 9000
);

insert into public.game_moves (
  session_id,
  move_number,
  from_article,
  to_article
) values
  ('30000000-0000-4000-8000-000000000401', 1, 'Start', 'Detour'),
  ('30000000-0000-4000-8000-000000000401', 2, 'Detour', 'Start'),
  ('30000000-0000-4000-8000-000000000401', 3, 'Start', 'Target');

select lives_ok(
  $$ select * from public.complete_game_session_v2(
    '30000000-0000-4000-8000-000000000401',
    '30000000-0000-4000-8000-000000000004',
    false
  ) $$,
  'private completion succeeds'
);
select lives_ok(
  $$ select * from public.complete_game_session_v2(
    '30000000-0000-4000-8000-000000000401',
    '30000000-0000-4000-8000-000000000004',
    false
  ) $$,
  'private completion retry succeeds'
);
select is(
  (select count(*) from public.challenge_link_events
   where session_id = '30000000-0000-4000-8000-000000000401' and event_type = 'complete'),
  1::bigint,
  'private completion event is recorded exactly once'
);
select is(
  (
    select session->'turn_path'
    from public.complete_game_session_v2(
      '30000000-0000-4000-8000-000000000401',
      '30000000-0000-4000-8000-000000000004',
      false
    )
  ),
  '["Start", "Detour", "Start", "Target"]'::jsonb,
  'completion preserves every article turn, including Back detours'
);
select is(
  (select games_played from public.user_stats where user_id = '30000000-0000-4000-8000-000000000004'),
  0,
  'private completion does not affect Official Daily statistics'
);

select * from finish();

rollback;

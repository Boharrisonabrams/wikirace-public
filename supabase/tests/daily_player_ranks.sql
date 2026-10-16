begin;

select plan(7);

select has_function(
  'public',
  'get_daily_player_ranks',
  array['uuid', 'uuid'],
  'exact Daily player rank RPC exists'
);

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  is_anonymous,
  created_at,
  updated_at
)
select
  (lpad(to_hex(player_number), 8, '0') || '-0000-4000-8000-000000000000')::uuid,
  'rank-player-' || player_number || '@example.test',
  '{}'::jsonb,
  false,
  now(),
  now()
from generate_series(1, 1002) as players(player_number);

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  is_anonymous,
  created_at,
  updated_at
)
values (
  '00001000-0000-4000-8000-000000000000',
  'zero-active@example.test',
  '{}'::jsonb,
  false,
  now(),
  now()
);

-- The Daily row comes first: game_sessions.challenge_id is a plain
-- (not deferrable) foreign key to daily_challenges.
insert into public.daily_challenges (
  id,
  challenge_date,
  start_article,
  end_article,
  start_article_title,
  end_article_title
)
values (
  '10000000-0000-4000-8000-000000000001',
  '2026-07-10',
  'Start',
  'End',
  'Start',
  'End'
);

insert into public.game_sessions (
  user_id,
  challenge_type,
  challenge_id,
  start_article,
  end_article,
  path,
  clicks,
  completed,
  won,
  time_seconds,
  completed_at,
  active_time_ms,
  attempt_number,
  is_official
)
values (
  '00001000-0000-4000-8000-000000000000',
  'daily',
  '10000000-0000-4000-8000-000000000001',
  'Start',
  'End',
  array['Start', 'End'],
  1,
  true,
  true,
  0,
  '2026-07-10 12:00:01+00',
  0,
  1,
  true
);

insert into public.game_sessions (
  user_id,
  challenge_type,
  challenge_id,
  start_article,
  end_article,
  path,
  clicks,
  completed,
  won,
  time_seconds,
  completed_at,
  active_time_ms,
  attempt_number,
  is_official
)
select
  (lpad(to_hex(player_number), 8, '0') || '-0000-4000-8000-000000000000')::uuid,
  'daily',
  '10000000-0000-4000-8000-000000000001',
  'Start',
  'End',
  array['Start', 'End'],
  player_number,
  true,
  true,
  1003 - player_number,
  '2026-07-10 12:00:00+00',
  (1003 - player_number) * 1000,
  1,
  true
from generate_series(1, 1002) as players(player_number);

set constraints all immediate;

select is(
  (
    select count(*)
    from public.get_daily_player_ranks(
      '10000000-0000-4000-8000-000000000001',
      '000003ea-0000-4000-8000-000000000000'
    )
  ),
  1::bigint,
  'exact rank RPC returns one row beyond the API 1000-row cap'
);

-- Player 1002 has the most clicks of 1003 eligible winners. The zero-active
-- winner stays on Shortest (one click), so it ranks ahead of every player.
select is(
  (
    select shortest_rank
    from public.get_daily_player_ranks(
      '10000000-0000-4000-8000-000000000001',
      '000003ea-0000-4000-8000-000000000000'
    )
  ),
  1003::bigint,
  'shortest rank is exact beyond 1000 eligible players'
);

select is(
  (
    select fastest_rank
    from public.get_daily_player_ranks(
      '10000000-0000-4000-8000-000000000001',
      '000003ea-0000-4000-8000-000000000000'
    )
  ),
  1::bigint,
  'fastest rank is independently exact in the same row'
);

select is(
  (
    select eligible_count
    from public.get_daily_player_ranks(
      '10000000-0000-4000-8000-000000000001',
      '000003ea-0000-4000-8000-000000000000'
    )
  ),
  1003::bigint,
  'eligible count includes every claimed official Daily winner'
);

select is(
  (
    select fastest_rank
    from public.get_daily_player_ranks(
      '10000000-0000-4000-8000-000000000001',
      '00001000-0000-4000-8000-000000000000'
    )
  ),
  null::bigint,
  'a zero-active-time winner is excluded from the Fastest rank'
);

select is(
  (
    select count(*)
    from public.get_daily_leaderboard_v2(
      '10000000-0000-4000-8000-000000000001',
      'fastest',
      2000,
      0,
      false
    )
    where user_id = '00001000-0000-4000-8000-000000000000'
  ),
  0::bigint,
  'the Fastest board omits zero-active-time winners entirely'
);

select * from finish();

rollback;

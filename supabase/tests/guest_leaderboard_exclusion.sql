begin;

select plan(3);

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  is_anonymous,
  created_at,
  updated_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    'claimed-racer@example.test',
    '{"username":"claimed_racer"}'::jsonb,
    false,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'guest-racer@example.test',
    '{"username":"guest_racer"}'::jsonb,
    true,
    now(),
    now()
  );

insert into public.daily_challenges (
  id,
  challenge_date,
  start_article,
  end_article,
  start_article_title,
  end_article_title
)
values (
  '20000000-0000-4000-8000-000000000010',
  '2026-07-24',
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
values
  (
    '20000000-0000-4000-8000-000000000001',
    'daily',
    '20000000-0000-4000-8000-000000000010',
    'Start',
    'End',
    array['Start', 'End'],
    5,
    true,
    true,
    5,
    '2026-07-24 12:00:05+00',
    5000,
    1,
    true
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'daily',
    '20000000-0000-4000-8000-000000000010',
    'Start',
    'End',
    array['Start', 'End'],
    1,
    true,
    true,
    1,
    '2026-07-24 12:00:01+00',
    1000,
    1,
    true
  );

set constraints all immediate;

select is(
  (
    select eligible_count
    from public.get_daily_player_ranks(
      '20000000-0000-4000-8000-000000000010',
      '20000000-0000-4000-8000-000000000001'
    )
  ),
  1::bigint,
  'guest winners do not inflate claimed-player eligibility counts'
);

select is(
  (
    select count(*)
    from public.get_daily_leaderboard_v2(
      '20000000-0000-4000-8000-000000000010',
      'shortest',
      50,
      0,
      false
    )
    where user_id = '20000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'guest winners stay off the public Shortest board'
);

select is(
  (
    select count(*)
    from public.get_daily_leaderboard_v2(
      '20000000-0000-4000-8000-000000000010',
      'fastest',
      50,
      0,
      false
    )
    where user_id = '20000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'guest winners stay off the public Fastest board'
);

select * from finish();

rollback;

begin;

select plan(13);

select is(
  has_table_privilege('anon', 'public.friend_challenges', 'select'),
  false,
  'anonymous clients cannot enumerate private challenge rows'
);

select is(
  has_function_privilege('anon', 'public.get_challenge_results(uuid)', 'execute'),
  false,
  'anonymous clients cannot call the raw challenge-results RPC'
);

select is(
  has_function_privilege('authenticated', 'public.get_challenge_results(uuid)', 'execute'),
  false,
  'authenticated clients cannot bypass the challenge API response contract'
);

select is(
  has_function_privilege('service_role', 'public.get_challenge_results(uuid)', 'execute'),
  true,
  'the API service role can load challenge results'
);

select has_function(
  'public',
  'record_game_move',
  array['uuid', 'uuid', 'integer', 'text', 'text', 'text[]', 'boolean'],
  'atomic move RPC exists'
);

select has_function(
  'public',
  'complete_game_session',
  array['uuid', 'uuid', 'boolean'],
  'atomic completion RPC exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.record_game_move(uuid,uuid,integer,text,text,text[],boolean)',
    'execute'
  ),
  false,
  'anonymous clients cannot execute the atomic move RPC'
);

select is(
  has_function_privilege(
    'anon',
    'public.complete_game_session(uuid,uuid,boolean)',
    'execute'
  ),
  false,
  'anonymous clients cannot execute the atomic completion RPC'
);

insert into auth.users (
  id,
  email,
  raw_user_meta_data,
  is_anonymous,
  created_at,
  updated_at
) values (
  '20000000-0000-4000-8000-000000000001',
  'completed-move-race@example.test',
  '{}'::jsonb,
  false,
  now(),
  now()
);

insert into public.game_sessions (
  id,
  user_id,
  challenge_type,
  start_article,
  end_article,
  path,
  clicks,
  completed,
  won,
  gave_up,
  completed_at
) values (
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001',
  'practice',
  'Start',
  'Target',
  array['Start'],
  0,
  true,
  false,
  true,
  now()
);

select throws_ok(
  $$
    select public.record_game_move(
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001',
      1,
      'Start',
      'Target',
      array['Start', 'Target'],
      true
    )
  $$,
  'P0002',
  'Game already completed',
  'a late winning move cannot overwrite a completed Give up'
);

select is(
  (select count(*) from public.game_moves where session_id = '20000000-0000-4000-8000-000000000002'),
  0::bigint,
  'the rejected late move leaves no audit row'
);

select ok(
  (
    select completed and gave_up and not won and clicks = 0
    from public.game_sessions
    where id = '20000000-0000-4000-8000-000000000002'
  ),
  'the completed Give up outcome remains unchanged'
);

insert into public.game_sessions (
  id,
  user_id,
  challenge_type,
  start_article,
  end_article,
  path,
  clicks,
  completed,
  won,
  gave_up,
  active_time_ms
) values (
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000001',
  'practice',
  'Start',
  'Target',
  array['Start'],
  0,
  false,
  false,
  false,
  1000
);

select public.record_game_move(
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000001',
  1,
  'Start',
  'Target',
  array['Start', 'Target'],
  true
);

create temporary table completed_after_move as
select *
from public.complete_game_session(
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000001',
  false
);

select is(
  (select did_complete from completed_after_move),
  true,
  'completion succeeds after a serialized winning move'
);

select ok(
  (
    select
      (session->>'completed')::boolean
      and (session->>'won')::boolean
      and not (session->>'gave_up')::boolean
      and (session->>'clicks')::integer = 1
      and session->'path' = '["Start", "Target"]'::jsonb
    from completed_after_move
  ),
  'completion derives its result from the post-move locked session'
);

select * from finish();

rollback;

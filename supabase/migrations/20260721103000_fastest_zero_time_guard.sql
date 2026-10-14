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
  shortest_ranked as (
    select
      e.id,
      row_number() over (
        order by e.clicks asc, e.active_time_ms asc, e.completed_at asc, e.id asc
      ) as shortest_rank
    from eligible e
  ),
  fastest_ranked as (
    select
      e.id,
      row_number() over (
        order by e.active_time_ms asc, e.clicks asc, e.completed_at asc, e.id asc
      ) as fastest_rank
    from eligible e
    where e.active_time_ms > 0
  ),
  ranked as (
    select
      e.*,
      s.shortest_rank,
      f.fastest_rank
    from eligible e
    join shortest_ranked s on s.id = e.id
    left join fastest_ranked f on f.id = e.id
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
  where p_board = 'shortest' or r.fastest_rank is not null
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
  fastest_rank bigint,
  eligible_count bigint
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
  shortest_ranked as (
    select
      e.id,
      e.user_id,
      row_number() over (
        order by e.clicks asc, e.active_time_ms asc, e.completed_at asc, e.id asc
      ) as shortest_rank,
      count(*) over () as eligible_count
    from eligible e
  ),
  fastest_ranked as (
    select
      e.id,
      row_number() over (
        order by e.active_time_ms asc, e.clicks asc, e.completed_at asc, e.id asc
      ) as fastest_rank
    from eligible e
    where e.active_time_ms > 0
  )
  select s.shortest_rank, f.fastest_rank, s.eligible_count
  from shortest_ranked s
  left join fastest_ranked f on f.id = s.id
  where s.user_id = p_user_id;
$$;

revoke all on function public.get_daily_player_ranks(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_daily_player_ranks(uuid, uuid)
  to service_role;

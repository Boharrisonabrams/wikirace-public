-- Add the eligible field size needed to present an honest rank percentile.
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
  ranked as (
    select
      e.user_id,
      row_number() over (
        order by e.clicks asc, e.active_time_ms asc, e.completed_at asc, e.id asc
      ) as shortest_rank,
      row_number() over (
        order by e.active_time_ms asc, e.clicks asc, e.completed_at asc, e.id asc
      ) as fastest_rank,
      count(*) over () as eligible_count
    from eligible e
  )
  select r.shortest_rank, r.fastest_rank, r.eligible_count
  from ranked r
  where r.user_id = p_user_id;
$$;

revoke all on function public.get_daily_player_ranks(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_daily_player_ranks(uuid, uuid)
  to service_role;

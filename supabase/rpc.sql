create or replace function public.reset_streak(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin') then
    raise exception 'not authorized';
  end if;
  update public.profiles set streak = 0 where id = p_user_id;
end;
$$;

create or replace function public.reset_points(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin') then
    raise exception 'not authorized';
  end if;
  update public.profiles set points = 0 where id = p_user_id;
end;
$$;

create or replace function public.upsert_weekly_report(
  p_user_id uuid,
  p_week_start date,
  p_week_end date default null,
  p_summary text default null,
  p_achievements text[] default null,
  p_improvements text[] default null,
  p_points_gained int default null,
  p_goals_next_week text[] default null
)
returns uuid
language plpgsql
security definer
as $$
declare rid uuid;
begin
  if not exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin') then
    raise exception 'not authorized';
  end if;
  insert into public.weekly_reports as wr (
    user_id, week_start, week_end, summary, achievements, improvements, points_gained, goals_next_week, created_by
  ) values (
    p_user_id, p_week_start, p_week_end, p_summary, p_achievements, p_improvements, p_points_gained, p_goals_next_week, auth.uid()
  )
  on conflict (user_id, week_start)
  do update set
    week_end = excluded.week_end,
    summary = excluded.summary,
    achievements = excluded.achievements,
    improvements = excluded.improvements,
    points_gained = excluded.points_gained,
    goals_next_week = excluded.goals_next_week,
    created_by = excluded.created_by
  returning id into rid;
  return rid;
end;
$$;

create or replace function public.get_user_activity_summary()
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  streak int,
  points int,
  tasks_count int,
  logs_count int,
  posts_count int,
  messages_count int
)
language sql
as $$
  select p.id as user_id,
         p.username,
         p.avatar_url,
         coalesce(p.streak, 0) as streak,
         coalesce(p.points, 0) as points,
         coalesce(t.cnt, 0) as tasks_count,
         coalesce(l.cnt, 0) as logs_count,
         coalesce(b.cnt, 0) as posts_count,
         coalesce(m.cnt, 0) as messages_count
  from public.profiles p
  left join (
    select user_id, count(*) cnt from public.tasks group by user_id
  ) t on t.user_id = p.id
  left join (
    select user_id, count(*) cnt from public.daily_logs group by user_id
  ) l on l.user_id = p.id
  left join (
    select user_id, count(*) cnt from public.blog_posts group by user_id
  ) b on b.user_id = p.id
  left join (
    select user_id, count(*) cnt from public.messages group by user_id
  ) m on m.user_id = p.id
$$;

create or replace function public.user_activity_for_range(p_user_id uuid, p_start date, p_end date)
returns table (tasks_completed_count int, logs_count int, points_gained int)
language sql
as $$
  with tasks as (
    select count(*) cnt from public.tasks
    where user_id = p_user_id and created_at::date between p_start and p_end and status = 'completed'
  ), logs as (
    select count(*) cnt from public.daily_logs
    where user_id = p_user_id and created_at::date between p_start and p_end
  ), points as (
    select coalesce(max(points), 0) - coalesce(min(points), 0) as gained
    from (
      select points from public.profiles where id = p_user_id
    ) s
  )
  select coalesce(tasks.cnt,0), coalesce(logs.cnt,0), coalesce(points.gained,0)
  from tasks, logs, points
$$;
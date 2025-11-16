create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  week_end date,
  summary text,
  achievements text[],
  improvements text[],
  points_gained int,
  tasks_completed_count int,
  logs_count int,
  suggestions text[],
  goals_next_week text[],
  created_at timestamptz default now(),
  created_by uuid references public.profiles(id)
);

alter table public.weekly_reports enable row level security;

create unique index if not exists weekly_reports_user_week_idx on public.weekly_reports(user_id, week_start);
create index if not exists idx_tasks_user on public.tasks(user_id);
create index if not exists idx_daily_logs_user on public.daily_logs(user_id);
create index if not exists idx_blog_posts_user on public.blog_posts(user_id);
create index if not exists idx_messages_user on public.messages(user_id);

create policy weekly_reports_owner_read on public.weekly_reports for select
  using (auth.uid() = user_id);

create policy weekly_reports_admin_read on public.weekly_reports for select
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

create policy weekly_reports_admin_write on public.weekly_reports for insert
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

create policy weekly_reports_admin_update on public.weekly_reports for update
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );
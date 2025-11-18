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
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text not null,
  image_url text,
  pinned boolean default false,
  created_at timestamptz default now()
);

alter table public.announcements enable row level security;

create policy announcements_read_all on public.announcements for select using (true);
create policy announcements_admin_write on public.announcements for insert with check (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);
create policy announcements_admin_update on public.announcements for update using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
) with check (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start timestamptz not null,
  end timestamptz not null,
  all_day boolean default false,
  location text,
  created_by uuid references public.profiles(id),
  google_event_id text
);

alter table public.events enable row level security;

create policy events_read_all on public.events for select using (true);
create policy events_admin_write on public.events for insert with check (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);
create policy events_admin_update on public.events for update using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
) with check (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin')
);
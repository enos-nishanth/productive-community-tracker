alter table public.user_roles enable row level security;

create policy user_roles_owner_read on public.user_roles for select
  using (auth.uid() = user_id);

create policy user_roles_admin_read on public.user_roles for select
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

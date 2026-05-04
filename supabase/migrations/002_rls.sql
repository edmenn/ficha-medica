-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.surgical_records enable row level security;
alter table public.custom_field_templates enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;

-- Admin check function (security definer bypasses RLS to prevent infinite recursion)
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
    and role = 'admin'
  );
$$;

-- users: see own profile; admin sees all
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

drop policy if exists "users_select_admin" on public.users;
create policy "users_select_admin" on public.users
  for select using (public.is_admin());

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- surgical_records: see own; admin sees all
drop policy if exists "records_select_own" on public.surgical_records;
create policy "records_select_own" on public.surgical_records
  for select using (auth.uid() = user_id);

drop policy if exists "records_select_admin" on public.surgical_records;
create policy "records_select_admin" on public.surgical_records
  for select using (public.is_admin());

drop policy if exists "records_insert_own" on public.surgical_records;
create policy "records_insert_own" on public.surgical_records
  for insert with check (auth.uid() = user_id);

drop policy if exists "records_update_own" on public.surgical_records;
create policy "records_update_own" on public.surgical_records
  for update using (auth.uid() = user_id);

drop policy if exists "records_delete_own" on public.surgical_records;
create policy "records_delete_own" on public.surgical_records
  for delete using (auth.uid() = user_id);

-- custom_field_templates: own only
create policy "templates_own" on public.custom_field_templates
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- invitations: admin manages; anyone can read their own token
create policy "invitations_admin" on public.invitations
  for all using (public.is_admin());
create policy "invitations_accept" on public.invitations
  for select using (true);

-- audit_log: own entries; admin sees all
create policy "audit_select_own" on public.audit_log
  for select using (auth.uid() = user_id);
create policy "audit_select_admin" on public.audit_log
  for select using (public.is_admin());
create policy "audit_insert" on public.audit_log
  for insert with check (auth.uid() = user_id);

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.surgical_records enable row level security;
alter table public.record_fields enable row level security;
alter table public.custom_field_templates enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;

-- users: see own profile; admin sees all
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
create policy "users_select_admin" on public.users
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- surgical_records: see own; admin sees all
create policy "records_select_own" on public.surgical_records
  for select using (auth.uid() = user_id);
create policy "records_select_admin" on public.surgical_records
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy "records_insert_own" on public.surgical_records
  for insert with check (auth.uid() = user_id);
create policy "records_update_own" on public.surgical_records
  for update using (auth.uid() = user_id);
create policy "records_delete_own" on public.surgical_records
  for delete using (auth.uid() = user_id);

-- record_fields: follow parent record ownership
create policy "fields_select" on public.record_fields
  for select using (
    exists (
      select 1 from public.surgical_records r
      where r.id = record_id and (
        r.user_id = auth.uid() or
        exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
      )
    )
  );
create policy "fields_insert" on public.record_fields
  for insert with check (
    exists (
      select 1 from public.surgical_records r
      where r.id = record_id and r.user_id = auth.uid()
    )
  );
create policy "fields_update" on public.record_fields
  for update using (
    exists (
      select 1 from public.surgical_records r
      where r.id = record_id and r.user_id = auth.uid()
    )
  );

-- custom_field_templates: own only
create policy "templates_own" on public.custom_field_templates
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- invitations: admin manages; anyone can read their own token
create policy "invitations_admin" on public.invitations
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy "invitations_accept" on public.invitations
  for select using (true);

-- audit_log: own entries; admin sees all
create policy "audit_select_own" on public.audit_log
  for select using (auth.uid() = user_id);
create policy "audit_select_admin" on public.audit_log
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy "audit_insert" on public.audit_log
  for insert with check (auth.uid() = user_id);

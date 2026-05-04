-- Harden exposed functions.
create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

revoke execute on function public.update_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Admin API access uses the service role, so public RLS only needs self-service policies.
drop policy if exists "users_select_admin" on public.users;
drop policy if exists "records_select_admin" on public.surgical_records;
drop policy if exists "invitations_admin" on public.invitations;
drop policy if exists "invitations_accept" on public.invitations;
drop policy if exists "audit_select_admin" on public.audit_log;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  as permissive for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  as permissive for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "records_select_own" on public.surgical_records;
create policy "records_select_own" on public.surgical_records
  as permissive for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "records_insert_own" on public.surgical_records;
create policy "records_insert_own" on public.surgical_records
  as permissive for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "records_update_own" on public.surgical_records;
create policy "records_update_own" on public.surgical_records
  as permissive for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "records_delete_own" on public.surgical_records;
create policy "records_delete_own" on public.surgical_records
  as permissive for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "templates_own" on public.custom_field_templates;
create policy "templates_own" on public.custom_field_templates
  as permissive for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "audit_select_own" on public.audit_log;
create policy "audit_select_own" on public.audit_log
  as permissive for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "audit_insert" on public.audit_log;
create policy "audit_insert" on public.audit_log
  as permissive for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop function if exists public.is_admin();

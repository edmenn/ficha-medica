-- 011_user_sanatoriums.sql
-- Catalogo de sanatorios editable por usuario. Se usa para autocompletar el
-- formulario y como referencia para normalizar el sanatorio que detecta la IA.

create table public.user_sanatoriums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index idx_user_sanatoriums_user on public.user_sanatoriums (user_id, name);

alter table public.user_sanatoriums enable row level security;

drop policy if exists "user_sanatoriums_select_own" on public.user_sanatoriums;
create policy "user_sanatoriums_select_own" on public.user_sanatoriums
  for select using (auth.uid() = user_id);

drop policy if exists "user_sanatoriums_select_admin" on public.user_sanatoriums;
create policy "user_sanatoriums_select_admin" on public.user_sanatoriums
  for select using (public.is_admin());

drop policy if exists "user_sanatoriums_insert_own" on public.user_sanatoriums;
create policy "user_sanatoriums_insert_own" on public.user_sanatoriums
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_sanatoriums_delete_own" on public.user_sanatoriums;
create policy "user_sanatoriums_delete_own" on public.user_sanatoriums
  for delete using (auth.uid() = user_id);

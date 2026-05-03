-- Enums
create type user_role as enum ('admin', 'user');
create type record_status as enum ('draft', 'reviewed', 'final');
create type audit_action as enum ('created', 'edited', 'exported');
create type field_type as enum ('text', 'number', 'date', 'bool');

-- User profiles (extends Supabase auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null default 'user',
  openrouter_key text,
  preferred_model text default 'anthropic/claude-3.5-sonnet',
  created_at timestamptz not null default now()
);

-- Surgical records
create table public.surgical_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  image_path text not null,
  image_paths text[] not null default '{}',
  ai_raw_response jsonb,
  extracted_data jsonb not null default '{}',
  final_data jsonb not null default '{}',
  status record_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Custom field templates per user
create table public.custom_field_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  field_name text not null,
  field_type field_type not null default 'text',
  is_required boolean not null default false,
  display_order int not null default 0
);

-- Invite-only registration
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  invited_by uuid not null references public.users(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '72 hours')
);

-- Audit log
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  record_id uuid references public.surgical_records(id) on delete set null,
  action audit_action not null,
  diff jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger surgical_records_updated_at
  before update on public.surgical_records
  for each row execute function update_updated_at();

-- Full-text search index
create index surgical_records_fts on public.surgical_records
  using gin(to_tsvector('spanish', coalesce(final_data->>'paciente','') || ' ' ||
    coalesce(final_data->>'cirujano','') || ' ' ||
    coalesce(final_data->>'procedimiento','') || ' ' ||
    coalesce(final_data->>'sanatorio','')));

-- Auto-create user profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

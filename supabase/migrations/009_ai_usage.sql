-- 009_ai_usage.sql
-- Tabla de uso de IA por request (OpenRouter). Agregado derivado por registro
-- se calcula en consulta (SUM de cost_usd / COUNT), no se denormaliza.

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  record_id uuid references public.surgical_records(id) on delete cascade,
  model text not null,
  event_type text not null check (event_type in ('analyze', 'reanalyze')),
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  cost_usd numeric(12, 6),
  provider text,
  request_id text,
  created_at timestamptz not null default now()
);

create index idx_ai_usage_record on public.ai_usage (record_id);
create index idx_ai_usage_user on public.ai_usage (user_id, created_at desc);

-- RLS
alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage
  for select using (auth.uid() = user_id);

drop policy if exists "ai_usage_select_admin" on public.ai_usage;
create policy "ai_usage_select_admin" on public.ai_usage
  for select using (public.is_admin());

drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_insert_own" on public.ai_usage
  for insert with check (auth.uid() = user_id);

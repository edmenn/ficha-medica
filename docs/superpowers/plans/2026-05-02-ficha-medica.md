# Ficha Médica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first web app that lets medical teams photograph surgical documents, extract structured data via AI (OpenRouter), review/correct it, and manage/export records.

**Architecture:** Next.js 14 App Router on Vercel (free tier) + Supabase for auth/db/storage. AI extraction via `/api/analyze` API route that calls OpenRouter server-side using the user's AES-256-encrypted API key stored in the DB. Three-layer data traceability per record: raw AI response → parsed fields → user-corrected final data.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth + Storage), OpenRouter API, `openai` npm package (OpenAI-compatible client), `xlsx`, `@react-pdf/renderer`, `heic2any`, Vitest

---

## File Structure

```
app/
  (auth)/
    login/page.tsx                  # email/password login
    accept-invite/[token]/page.tsx  # accept invitation + set password
  (app)/
    layout.tsx                      # bottom nav shell
    records/
      page.tsx                      # list of records
      [id]/page.tsx                 # record detail + edit
    new/
      page.tsx                      # multi-step: capture → processing → review
    search/
      page.tsx                      # full-text search + filters
    reports/
      page.tsx                      # date-range reports + export
    settings/
      page.tsx                      # API key, model, custom fields
      users/page.tsx                # admin: invite + manage users
  api/
    analyze/route.ts                # POST: upload image → call OpenRouter → save record
    records/route.ts                # GET list, POST create
    records/[id]/route.ts           # GET one, PATCH update, DELETE
    search/route.ts                 # GET: full-text + filters
    export/route.ts                 # GET: xlsx or pdf
    invites/route.ts                # POST create, GET list, DELETE revoke

components/
  ui/
    Button.tsx
    Input.tsx
    Badge.tsx                       # confidence indicator color
    BottomNav.tsx
  records/
    RecordCard.tsx                  # list item
    RecordForm.tsx                  # review/edit form (all fields)
    FieldRow.tsx                    # single field: label + input + confidence badge
  capture/
    ImageCapture.tsx                # camera trigger + file upload
  reports/
    ReportFilters.tsx               # date range + stat cards

lib/
  supabase/
    client.ts                       # browser Supabase client (singleton)
    server.ts                       # server Supabase client (cookies)
  crypto.ts                         # AES-256-GCM encrypt/decrypt (Node crypto)
  openrouter.ts                     # build OpenAI client pointed at OpenRouter
  ai-parser.ts                      # parse raw LLM JSON → SurgicalFields
  export/
    excel.ts                        # workbook builder using xlsx
    pdf.ts                          # PDF document using @react-pdf/renderer

types/
  index.ts                          # all shared TypeScript types

supabase/
  migrations/
    001_schema.sql                  # all tables + enums
    002_rls.sql                     # Row Level Security policies

middleware.ts                       # protect (app) routes, redirect to /login
public/
  manifest.json                     # PWA manifest
```

---

## Sprint 1 — Base

### Task 1: Project scaffold + dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`

- [ ] **Step 1: Create Next.js app**

```bash
npx create-next-app@14 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
```

Expected: project scaffolded with `app/`, `public/`, `package.json`.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install \
  @supabase/supabase-js \
  @supabase/ssr \
  openai \
  heic2any \
  xlsx \
  @react-pdf/renderer
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

Create `vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Add env file**

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_KEY=
```

Create `.env.example` with the same keys but empty values.

Add `.env.local` to `.gitignore` (already there from create-next-app).

- [ ] **Step 6: Commit**

```bash
git init
git add -A
git commit -m "feat: initial project scaffold with Next.js 14 + dependencies"
```

---

### Task 2: TypeScript types

**Files:**
- Create: `types/index.ts`
- Create: `types/index.test.ts`

- [ ] **Step 1: Write the types**

Create `types/index.ts`:
```typescript
export type UserRole = 'admin' | 'user'
export type RecordStatus = 'draft' | 'reviewed' | 'final'
export type AuditAction = 'created' | 'edited' | 'exported'
export type FieldType = 'text' | 'number' | 'date' | 'bool'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  openrouter_key: string | null  // AES-256 encrypted ciphertext
  preferred_model: string | null
  created_at: string
}

export interface SurgicalFields {
  paciente: string | null
  fecha_cirugia: string | null
  hora_inicio: string | null
  hora_fin: string | null
  duracion: string | null
  diagnostico: string | null
  procedimiento: string | null
  cirujano: string | null
  ayudantes: string | null
  anestesiologo: string | null
  instrumentador: string | null
  sanatorio: string | null
  observaciones: string | null
  [key: string]: string | null  // custom fields
}

export interface RecordField {
  id: string
  record_id: string
  field_name: string
  ai_value: string | null
  final_value: string | null
  confidence: number  // 0–1
}

export interface SurgicalRecord {
  id: string
  user_id: string
  image_path: string
  ai_raw_response: unknown
  extracted_data: SurgicalFields
  final_data: SurgicalFields
  status: RecordStatus
  created_at: string
  updated_at: string
  record_fields?: RecordField[]
}

export interface CustomFieldTemplate {
  id: string
  user_id: string
  field_name: string
  field_type: FieldType
  is_required: boolean
  display_order: number
}

export interface Invitation {
  id: string
  email: string
  token: string
  invited_by: string
  accepted_at: string | null
  expires_at: string
}

export interface AuditEntry {
  id: string
  user_id: string
  record_id: string
  action: AuditAction
  diff: Partial<SurgicalFields>
  created_at: string
}

// API response shapes
export interface AnalyzeResponse {
  record_id: string
  extracted_data: SurgicalFields
  record_fields: RecordField[]
}

export interface ExportQuery {
  format: 'xlsx' | 'pdf'
  from: string   // ISO date
  to: string     // ISO date
}
```

- [ ] **Step 2: Write a smoke test to verify types compile**

Create `types/index.test.ts`:
```typescript
import { describe, it, expectTypeOf } from 'vitest'
import type { SurgicalRecord, UserProfile, RecordStatus } from './index'

describe('types', () => {
  it('SurgicalRecord has required fields', () => {
    expectTypeOf<SurgicalRecord>().toHaveProperty('id')
    expectTypeOf<SurgicalRecord>().toHaveProperty('extracted_data')
    expectTypeOf<SurgicalRecord>().toHaveProperty('final_data')
    expectTypeOf<SurgicalRecord>().toHaveProperty('status')
  })

  it('RecordStatus is a union', () => {
    const s: RecordStatus = 'final'
    expectTypeOf(s).toEqualTypeOf<RecordStatus>()
  })

  it('UserProfile has role', () => {
    expectTypeOf<UserProfile>().toHaveProperty('role')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: PASS (type-only test, always passes if types compile)

- [ ] **Step 4: Commit**

```bash
git add types/
git commit -m "feat: add shared TypeScript types"
```

---

### Task 3: Database migrations

**Files:**
- Create: `supabase/migrations/001_schema.sql`
- Create: `supabase/migrations/002_rls.sql`

- [ ] **Step 1: Create schema migration**

Create `supabase/migrations/001_schema.sql`:
```sql
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
  ai_raw_response jsonb,
  extracted_data jsonb not null default '{}',
  final_data jsonb not null default '{}',
  status record_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Per-field traceability
create table public.record_fields (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.surgical_records(id) on delete cascade,
  field_name text not null,
  ai_value text,
  final_value text,
  confidence float not null default 0
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
```

- [ ] **Step 2: Create RLS migration**

Create `supabase/migrations/002_rls.sql`:
```sql
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
  for select using (true);  -- token validation is done server-side

-- audit_log: own entries; admin sees all
create policy "audit_select_own" on public.audit_log
  for select using (auth.uid() = user_id);
create policy "audit_select_admin" on public.audit_log
  for select using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
create policy "audit_insert" on public.audit_log
  for insert with check (auth.uid() = user_id);
```

- [ ] **Step 3: Apply migrations**

In Supabase dashboard → SQL Editor, run `001_schema.sql` then `002_rls.sql`.

Or via Supabase CLI:
```bash
npx supabase db push
```

Expected: all tables and policies created with no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema and RLS policies"
```

---

### Task 4: Supabase client setup

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Write browser client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Write server client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export async function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
```

- [ ] **Step 3: Write auth middleware**

Create `middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/accept-invite')

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/records', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: add Supabase client and auth middleware"
```

---

### Task 5: AES-256 crypto utility

**Files:**
- Create: `lib/crypto.ts`
- Create: `lib/crypto.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/crypto.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from './crypto'

describe('crypto', () => {
  it('encrypt returns a non-empty string different from input', () => {
    const result = encrypt('sk-or-test-key-12345')
    expect(result).not.toBe('sk-or-test-key-12345')
    expect(result.length).toBeGreaterThan(0)
  })

  it('decrypt reverses encrypt', () => {
    const original = 'sk-or-v1-abc123xyz'
    const ciphertext = encrypt(original)
    expect(decrypt(ciphertext)).toBe(original)
  })

  it('two encryptions of the same value produce different ciphertexts (random IV)', () => {
    const a = encrypt('same-value')
    const b = encrypt('same-value')
    expect(a).not.toBe(b)
  })

  it('decrypt throws on tampered ciphertext', () => {
    expect(() => decrypt('invalid:tampered:garbage')).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef npm test lib/crypto.test.ts
```
Expected: FAIL — `encrypt` not defined.

- [ ] **Step 3: Implement crypto**

Create `lib/crypto.ts`:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY env var is not set')
  const buf = Buffer.from(raw, 'hex')
  if (buf.length !== KEY_LENGTH) throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)')
  return buf
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')
  const [ivHex, tagHex, encHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
```

- [ ] **Step 4: Run tests**

```bash
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef npm test lib/crypto.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/crypto.ts lib/crypto.test.ts
git commit -m "feat: add AES-256-GCM encrypt/decrypt utility"
```

---

### Task 6: Login page + auth flow

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/accept-invite/[token]/page.tsx`
- Create: `app/layout.tsx`
- Create: `app/(auth)/layout.tsx`

- [ ] **Step 1: Create root layout**

Create `app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ficha Médica',
  description: 'Gestión de registros quirúrgicos',
  manifest: '/manifest.json',
  themeColor: '#0f172a',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Create auth layout**

Create `app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: Create login page**

Create `app/(auth)/login/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }
    router.push('/records')
    router.refresh()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Ficha Médica</h1>
      <p className="text-slate-400 mb-8">Ingresá con tu cuenta</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Create accept-invite page**

Create `app/(auth)/accept-invite/[token]/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)

  useEffect(() => {
    async function validateToken() {
      const res = await fetch(`/api/invites?token=${token}`)
      if (!res.ok) {
        setError('Invitación inválida o vencida')
        setValidating(false)
        return
      }
      const data = await res.json()
      setEmail(data.email)
      setValidating(false)
    }
    validateToken()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Error al activar la cuenta')
      setLoading(false)
      return
    }
    const supabase = createClient()
    await supabase.auth.signInWithPassword({ email, password })
    router.push('/records')
  }

  if (validating) return <p className="text-slate-400">Verificando invitación...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Activar cuenta</h1>
      <p className="text-slate-400 mb-6">{email}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Elegí una contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={8}
            required
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg"
        >
          {loading ? 'Activando...' : 'Activar cuenta'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat: add login and accept-invite pages"
```

---

### Task 7: App shell + bottom navigation

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `components/ui/BottomNav.tsx`
- Create: `app/(app)/records/page.tsx` (placeholder)

- [ ] **Step 1: Create BottomNav component**

Create `components/ui/BottomNav.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/records', icon: '📋', label: 'Registros' },
  { href: '/search', icon: '🔍', label: 'Buscar' },
  { href: '/new', icon: '📷', label: 'Nueva', cta: true },
  { href: '/reports', icon: '📊', label: 'Reportes' },
  { href: '/settings', icon: '⚙️', label: 'Config' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {NAV_ITEMS.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 flex-1"
            >
              {item.cta ? (
                <span className="bg-blue-600 rounded-full w-10 h-10 flex items-center justify-center text-lg">
                  {item.icon}
                </span>
              ) : (
                <span className="text-xl">{item.icon}</span>
              )}
              <span className={`text-[10px] ${active ? 'text-blue-400' : 'text-slate-500'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create app layout**

Create `app/(app)/layout.tsx`:
```tsx
import BottomNav from '@/components/ui/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="pb-20 max-w-lg mx-auto px-4 pt-4">{children}</main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 3: Create placeholder pages for each nav item**

Create `app/(app)/records/page.tsx`:
```tsx
export default function RecordsPage() {
  return <h1 className="text-xl font-bold">Registros</h1>
}
```

Create `app/(app)/search/page.tsx`:
```tsx
export default function SearchPage() {
  return <h1 className="text-xl font-bold">Buscar</h1>
}
```

Create `app/(app)/new/page.tsx`:
```tsx
export default function NewRecordPage() {
  return <h1 className="text-xl font-bold">Nueva ficha</h1>
}
```

Create `app/(app)/reports/page.tsx`:
```tsx
export default function ReportsPage() {
  return <h1 className="text-xl font-bold">Reportes</h1>
}
```

Create `app/(app)/settings/page.tsx`:
```tsx
export default function SettingsPage() {
  return <h1 className="text-xl font-bold">Configuración</h1>
}
```

- [ ] **Step 4: Run dev server and verify navigation works**

```bash
npm run dev
```
Open http://localhost:3000 → should redirect to `/login`. Log in → should see bottom nav with 5 items. Tap each → placeholder pages load.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/ components/ui/BottomNav.tsx
git commit -m "feat: add app shell with bottom navigation"
```

---

### Task 8: Deploy to Vercel

- [ ] **Step 1: Create Vercel project**

```bash
npx vercel link
```
Follow prompts to create a new project.

- [ ] **Step 2: Set environment variables**

In Vercel dashboard → Settings → Environment Variables, add:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase project settings
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project settings
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings
- `ENCRYPTION_KEY` — generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

- [ ] **Step 3: Deploy**

```bash
npx vercel --prod
```
Expected: deployment URL printed. Visit it → redirect to `/login` works.

- [ ] **Step 4: Commit**

```bash
git add .vercel/
git commit -m "chore: add Vercel project config"
```

---

## Sprint 2 — Core IA

### Task 9: Image utilities (compress + HEIC→JPEG)

**Files:**
- Create: `lib/imageUtils.ts`
- Create: `lib/imageUtils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/imageUtils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { compressImage, needsHeicConversion } from './imageUtils'

describe('needsHeicConversion', () => {
  it('returns true for .heic files', () => {
    const file = new File([''], 'photo.heic', { type: 'image/heic' })
    expect(needsHeicConversion(file)).toBe(true)
  })

  it('returns true for .HEIC uppercase', () => {
    const file = new File([''], 'photo.HEIC', { type: '' })
    expect(needsHeicConversion(file)).toBe(true)
  })

  it('returns false for .jpg files', () => {
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' })
    expect(needsHeicConversion(file)).toBe(false)
  })
})

describe('compressImage', () => {
  it('returns a Blob', async () => {
    // Create a minimal 1x1 PNG
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'))
    const file = new File([blob], 'test.png', { type: 'image/png' })
    const result = await compressImage(file)
    expect(result).toBeInstanceOf(Blob)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test lib/imageUtils.test.ts
```
Expected: FAIL — `needsHeicConversion` not defined.

- [ ] **Step 3: Implement**

Create `lib/imageUtils.ts`:
```typescript
const MAX_SIZE_BYTES = 500 * 1024  // 500KB
const MAX_DIMENSION = 1920

export function needsHeicConversion(file: File): boolean {
  return file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 }) as Blob
  return new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' })
}

export async function compressImage(file: File, maxBytes = MAX_SIZE_BYTES): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      let quality = 0.85
      const tryCompress = () => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return }
          if (blob.size <= maxBytes || quality <= 0.3) { resolve(blob); return }
          quality -= 0.1
          tryCompress()
        }, 'image/jpeg', quality)
      }
      tryCompress()
    }
    img.onerror = reject
    img.src = url
  })
}

export async function prepareImageForUpload(file: File): Promise<File> {
  let processed: File = file
  if (needsHeicConversion(file)) {
    processed = await convertHeicToJpeg(file)
  }
  const compressed = await compressImage(processed)
  return new File([compressed], processed.name, { type: 'image/jpeg' })
}
```

- [ ] **Step 4: Run tests**

```bash
npm test lib/imageUtils.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/imageUtils.ts lib/imageUtils.test.ts
git commit -m "feat: add image compression and HEIC conversion utilities"
```

---

### Task 10: OpenRouter client + AI parser

**Files:**
- Create: `lib/openrouter.ts`
- Create: `lib/ai-parser.ts`
- Create: `lib/ai-parser.test.ts`

- [ ] **Step 1: Write failing tests for AI parser**

Create `lib/ai-parser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseAIResponse } from './ai-parser'
import type { SurgicalFields } from '@/types'

const SAMPLE_VALID = {
  paciente: 'García, Juan Carlos',
  fecha_cirugia: '2025-04-12',
  hora_inicio: '08:30',
  hora_fin: '10:15',
  duracion: '1h 45min',
  diagnostico: 'Apendicitis aguda',
  procedimiento: 'Apendicectomía laparoscópica',
  cirujano: 'Dr. Osvaldo Pérez',
  ayudantes: 'Dr. Martínez',
  anestesiologo: 'Dra. López',
  instrumentador: 'Enf. Rodríguez',
  sanatorio: 'Sanatorio San Lucas',
  observaciones: null,
}

describe('parseAIResponse', () => {
  it('parses a valid JSON string response', () => {
    const raw = `\`\`\`json\n${JSON.stringify(SAMPLE_VALID)}\n\`\`\``
    const result = parseAIResponse(raw)
    expect(result.fields.paciente).toBe('García, Juan Carlos')
    expect(result.fields.procedimiento).toBe('Apendicectomía laparoscópica')
  })

  it('parses a plain JSON response without code fences', () => {
    const raw = JSON.stringify(SAMPLE_VALID)
    const result = parseAIResponse(raw)
    expect(result.fields.cirujano).toBe('Dr. Osvaldo Pérez')
  })

  it('returns null for missing fields, not invented values', () => {
    const partial = { paciente: 'Test', procedimiento: null }
    const result = parseAIResponse(JSON.stringify(partial))
    expect(result.fields.diagnostico).toBeNull()
    expect(result.fields.paciente).toBe('Test')
  })

  it('assigns confidence 1.0 to present fields and 0 to null fields', () => {
    const raw = JSON.stringify(SAMPLE_VALID)
    const result = parseAIResponse(raw)
    const pacienteField = result.record_fields.find(f => f.field_name === 'paciente')
    const obsField = result.record_fields.find(f => f.field_name === 'observaciones')
    expect(pacienteField?.confidence).toBe(1)
    expect(obsField?.confidence).toBe(0)
  })

  it('returns empty fields on unparseable response', () => {
    const result = parseAIResponse('I could not extract the data from this image.')
    expect(result.fields.paciente).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test lib/ai-parser.test.ts
```
Expected: FAIL — `parseAIResponse` not defined.

- [ ] **Step 3: Implement OpenRouter client**

Create `lib/openrouter.ts`:
```typescript
import OpenAI from 'openai'

export function createOpenRouterClient(apiKey: string) {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      'X-Title': 'Ficha Médica',
    },
  })
}

export const EXTRACTION_PROMPT = `Analizá la imagen de este documento médico/quirúrgico y extraé los datos en formato JSON.

Devolvé SOLO el JSON con estos campos (usá null para los que no encuentres, nunca inventes):
{
  "paciente": string | null,
  "fecha_cirugia": string | null,
  "hora_inicio": string | null,
  "hora_fin": string | null,
  "duracion": string | null,
  "diagnostico": string | null,
  "procedimiento": string | null,
  "cirujano": string | null,
  "ayudantes": string | null,
  "anestesiologo": string | null,
  "instrumentador": string | null,
  "sanatorio": string | null,
  "observaciones": string | null
}

Reglas:
- No inventes información que no esté en el documento
- Fechas en formato YYYY-MM-DD si es posible
- Horas en formato HH:MM
- Si hay múltiples ayudantes, separarlos con coma`
```

- [ ] **Step 4: Implement AI parser**

Create `lib/ai-parser.ts`:
```typescript
import type { SurgicalFields, RecordField } from '@/types'

const STANDARD_FIELDS: (keyof SurgicalFields)[] = [
  'paciente', 'fecha_cirugia', 'hora_inicio', 'hora_fin', 'duracion',
  'diagnostico', 'procedimiento', 'cirujano', 'ayudantes',
  'anestesiologo', 'instrumentador', 'sanatorio', 'observaciones',
]

function extractJSON(raw: string): unknown {
  // Strip markdown code fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw.trim()
  return JSON.parse(jsonStr)
}

export function parseAIResponse(raw: string): {
  fields: SurgicalFields
  record_fields: Omit<RecordField, 'id' | 'record_id'>[]
} {
  const empty: SurgicalFields = Object.fromEntries(
    STANDARD_FIELDS.map(k => [k, null])
  ) as SurgicalFields

  let parsed: Record<string, unknown>
  try {
    parsed = extractJSON(raw) as Record<string, unknown>
  } catch {
    return {
      fields: empty,
      record_fields: STANDARD_FIELDS.map(field_name => ({
        field_name,
        ai_value: null,
        final_value: null,
        confidence: 0,
      })),
    }
  }

  const fields: SurgicalFields = { ...empty }
  for (const key of STANDARD_FIELDS) {
    const val = parsed[key]
    fields[key] = (typeof val === 'string' && val.trim() !== '') ? val.trim() : null
  }

  const record_fields = STANDARD_FIELDS.map(field_name => ({
    field_name,
    ai_value: fields[field_name],
    final_value: fields[field_name],
    confidence: fields[field_name] !== null ? 1 : 0,
  }))

  return { fields, record_fields }
}
```

- [ ] **Step 5: Run tests**

```bash
npm test lib/ai-parser.test.ts
```
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/openrouter.ts lib/ai-parser.ts lib/ai-parser.test.ts
git commit -m "feat: add OpenRouter client and AI response parser"
```

---

### Task 11: /api/analyze route

**Files:**
- Create: `app/api/analyze/route.ts`

- [ ] **Step 1: Implement the route**

Create `app/api/analyze/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { createOpenRouterClient, EXTRACTION_PROMPT } from '@/lib/openrouter'
import { parseAIResponse } from '@/lib/ai-parser'
import type { AnalyzeResponse } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const imageFile = formData.get('image') as File | null
  if (!imageFile) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  // Get user's OpenRouter key
  const { data: profile } = await supabase
    .from('users')
    .select('openrouter_key, preferred_model')
    .eq('id', user.id)
    .single()

  if (!profile?.openrouter_key) {
    return NextResponse.json({ error: 'Configure tu API key de OpenRouter en Configuración' }, { status: 422 })
  }

  let apiKey: string
  try {
    apiKey = decrypt(profile.openrouter_key)
  } catch {
    return NextResponse.json({ error: 'API key inválida, reconfigurala en Configuración' }, { status: 422 })
  }

  // Upload image to Supabase Storage
  const service = await createServiceClient()
  const imagePath = `${user.id}/${Date.now()}-${imageFile.name}`
  const imageBuffer = await imageFile.arrayBuffer()
  const { error: uploadError } = await service.storage
    .from('surgical-images')
    .upload(imagePath, imageBuffer, { contentType: imageFile.type })

  if (uploadError) {
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
  }

  // Get signed URL for OpenRouter (expires in 5 minutes)
  const { data: { signedUrl } } = await service.storage
    .from('surgical-images')
    .createSignedUrl(imagePath, 300)

  // Call OpenRouter
  const client = createOpenRouterClient(apiKey)
  const model = profile.preferred_model ?? 'anthropic/claude-3.5-sonnet'

  let rawResponse: string
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          { type: 'image_url', image_url: { url: signedUrl! } },
        ],
      }],
      max_tokens: 1000,
    })
    rawResponse = completion.choices[0]?.message?.content ?? ''
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al analizar imagen'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const { fields, record_fields } = parseAIResponse(rawResponse)

  // Create record in DB
  const { data: record, error: recordError } = await supabase
    .from('surgical_records')
    .insert({
      user_id: user.id,
      image_path: imagePath,
      ai_raw_response: rawResponse,
      extracted_data: fields,
      final_data: fields,
      status: 'draft',
    })
    .select()
    .single()

  if (recordError || !record) {
    return NextResponse.json({ error: 'Error al guardar registro' }, { status: 500 })
  }

  // Insert record_fields
  await supabase.from('record_fields').insert(
    record_fields.map(f => ({ ...f, record_id: record.id }))
  )

  // Audit log
  await supabase.from('audit_log').insert({
    user_id: user.id,
    record_id: record.id,
    action: 'created',
    diff: fields,
  })

  const response: AnalyzeResponse = {
    record_id: record.id,
    extracted_data: fields,
    record_fields: record_fields.map((f, i) => ({ ...f, id: `tmp-${i}`, record_id: record.id })),
  }

  return NextResponse.json(response)
}
```

- [ ] **Step 2: Create Supabase Storage bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `surgical-images`
- Private: yes (no public access)

- [ ] **Step 3: Commit**

```bash
git add app/api/analyze/
git commit -m "feat: add /api/analyze route for image extraction via OpenRouter"
```

---

### Task 12: ImageCapture component + New record page

**Files:**
- Create: `components/capture/ImageCapture.tsx`
- Create: `components/records/FieldRow.tsx`
- Create: `components/records/RecordForm.tsx`
- Modify: `app/(app)/new/page.tsx`

- [ ] **Step 1: Create ImageCapture component**

Create `components/capture/ImageCapture.tsx`:
```tsx
'use client'

import { useRef } from 'react'

interface Props {
  onImageSelected: (file: File) => void
  disabled?: boolean
}

export default function ImageCapture({ onImageSelected, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onImageSelected(file)
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => cameraInputRef.current?.click()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-4 rounded-xl flex items-center justify-center gap-3 text-lg"
      >
        📷 Tomar foto
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2"
      >
        🖼️ Subir imagen existente
      </button>
      <p className="text-center text-xs text-slate-500">JPG · PNG · HEIC · PDF</p>

      {/* Camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {/* File picker input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create FieldRow component**

Create `components/records/FieldRow.tsx`:
```tsx
'use client'

const FIELD_LABELS: Record<string, string> = {
  paciente: 'Paciente',
  fecha_cirugia: 'Fecha de cirugía',
  hora_inicio: 'Hora inicio',
  hora_fin: 'Hora fin',
  duracion: 'Duración',
  diagnostico: 'Diagnóstico',
  procedimiento: 'Procedimiento',
  cirujano: 'Cirujano',
  ayudantes: 'Ayudantes',
  anestesiologo: 'Anestesiólogo',
  instrumentador: 'Instrumentador',
  sanatorio: 'Sanatorio / Hospital',
  observaciones: 'Observaciones',
}

interface Props {
  fieldName: string
  value: string
  aiValue: string | null
  confidence: number
  onChange: (value: string) => void
}

export default function FieldRow({ fieldName, value, aiValue, confidence, onChange }: Props) {
  const label = FIELD_LABELS[fieldName] ?? fieldName
  const isLowConfidence = confidence < 0.5
  const wasModified = value !== aiValue

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm text-slate-400">{label}</label>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isLowConfidence
            ? 'bg-amber-900/50 text-amber-300'
            : wasModified
              ? 'bg-blue-900/50 text-blue-300'
              : 'bg-slate-800 text-slate-500'
        }`}>
          {isLowConfidence ? '⚠️ revisar' : wasModified ? '✏️ editado' : ''}
        </span>
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className={`w-full bg-slate-800 text-white rounded-lg px-3 py-2.5 border ${
          isLowConfidence ? 'border-amber-600' : 'border-slate-700'
        } focus:outline-none focus:border-blue-500 text-sm`}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create RecordForm component**

Create `components/records/RecordForm.tsx`:
```tsx
'use client'

import FieldRow from './FieldRow'
import type { RecordField, SurgicalFields } from '@/types'

interface Props {
  fields: SurgicalFields
  recordFields: RecordField[]
  onChange: (updated: SurgicalFields) => void
  onSave: () => void
  saving?: boolean
}

const FIELD_ORDER: (keyof SurgicalFields)[] = [
  'paciente', 'fecha_cirugia', 'hora_inicio', 'hora_fin', 'duracion',
  'diagnostico', 'procedimiento', 'cirujano', 'ayudantes',
  'anestesiologo', 'instrumentador', 'sanatorio', 'observaciones',
]

export default function RecordForm({ fields, recordFields, onChange, onSave, saving }: Props) {
  function handleChange(key: string, value: string) {
    onChange({ ...fields, [key]: value || null })
  }

  return (
    <div>
      {FIELD_ORDER.map(key => {
        const rf = recordFields.find(f => f.field_name === key)
        return (
          <FieldRow
            key={key}
            fieldName={key}
            value={fields[key] ?? ''}
            aiValue={rf?.ai_value ?? null}
            confidence={rf?.confidence ?? 1}
            onChange={v => handleChange(key, v)}
          />
        )
      })}
      <button
        onClick={onSave}
        disabled={saving}
        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl mt-2"
      >
        {saving ? 'Guardando...' : '✓ Guardar registro'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Build the New record page (multi-step)**

Replace `app/(app)/new/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageCapture from '@/components/capture/ImageCapture'
import RecordForm from '@/components/records/RecordForm'
import { prepareImageForUpload } from '@/lib/imageUtils'
import type { AnalyzeResponse, SurgicalFields } from '@/types'

type Step = 'capture' | 'processing' | 'review'

export default function NewRecordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('capture')
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzeData, setAnalyzeData] = useState<AnalyzeResponse | null>(null)
  const [fields, setFields] = useState<SurgicalFields | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleImageSelected(file: File) {
    setStep('processing')
    setError(null)
    setPreview(URL.createObjectURL(file))

    let prepared: File
    try {
      prepared = await prepareImageForUpload(file)
    } catch {
      setError('Error al procesar la imagen')
      setStep('capture')
      return
    }

    const form = new FormData()
    form.append('image', prepared)

    const res = await fetch('/api/analyze', { method: 'POST', body: form })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Error al analizar imagen')
      setStep('capture')
      return
    }

    setAnalyzeData(data)
    setFields(data.extracted_data)
    setStep('review')
  }

  async function handleSave() {
    if (!analyzeData || !fields) return
    setSaving(true)
    const res = await fetch(`/api/records/${analyzeData.record_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_data: fields, status: 'final' }),
    })
    if (res.ok) {
      router.push('/records')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-slate-400">←</button>
        <h1 className="text-xl font-bold">
          {step === 'capture' && 'Nueva ficha'}
          {step === 'processing' && 'Analizando...'}
          {step === 'review' && 'Revisar datos'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {step === 'capture' && (
        <ImageCapture onImageSelected={handleImageSelected} />
      )}

      {step === 'processing' && (
        <div className="text-center py-12">
          {preview && (
            <img src={preview} alt="Documento" className="w-full rounded-xl mb-6 max-h-64 object-contain" />
          )}
          <div className="animate-pulse text-blue-400 text-lg mb-2">🤖 Extrayendo datos con IA...</div>
          <p className="text-slate-500 text-sm">Esto puede tardar unos segundos</p>
        </div>
      )}

      {step === 'review' && analyzeData && fields && (
        <>
          {preview && (
            <img src={preview} alt="Documento" className="w-full rounded-xl mb-6 max-h-48 object-contain" />
          )}
          <RecordForm
            fields={fields}
            recordFields={analyzeData.record_fields}
            onChange={setFields}
            onSave={handleSave}
            saving={saving}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/ app/(app)/new/
git commit -m "feat: add image capture, field review form, and new record flow"
```

---

### Task 13: /api/records CRUD routes

**Files:**
- Create: `app/api/records/route.ts`
- Create: `app/api/records/[id]/route.ts`

- [ ] **Step 1: Create records list + create route**

Create `app/api/records/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('surgical_records')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ records: data, total: count, page })
}
```

- [ ] **Step 2: Create record detail + update + delete route**

Create `app/api/records/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SurgicalFields, RecordStatus } from '@/types'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('surgical_records')
    .select('*, record_fields(*)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { final_data?: SurgicalFields; status?: RecordStatus }

  // Get current record for diff
  const { data: current } = await supabase
    .from('surgical_records')
    .select('final_data')
    .eq('id', params.id)
    .single()

  const { data, error } = await supabase
    .from('surgical_records')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update record_fields final_value if final_data changed
  if (body.final_data) {
    const updates = Object.entries(body.final_data).map(([field_name, final_value]) =>
      supabase.from('record_fields')
        .update({ final_value: final_value ?? null })
        .eq('record_id', params.id)
        .eq('field_name', field_name)
    )
    await Promise.all(updates)

    // Audit diff
    const diff: Partial<SurgicalFields> = {}
    if (current?.final_data) {
      for (const key of Object.keys(body.final_data) as (keyof SurgicalFields)[]) {
        if (body.final_data[key] !== (current.final_data as SurgicalFields)[key]) {
          diff[key] = body.final_data[key]
        }
      }
    }
    if (Object.keys(diff).length > 0) {
      await supabase.from('audit_log').insert({
        user_id: user.id,
        record_id: params.id,
        action: 'edited',
        diff,
      })
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('surgical_records')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/records/
git commit -m "feat: add /api/records CRUD routes"
```

---

## Sprint 3 — Gestión

### Task 14: Records list page

**Files:**
- Create: `components/records/RecordCard.tsx`
- Modify: `app/(app)/records/page.tsx`
- Create: `app/(app)/records/[id]/page.tsx`

- [ ] **Step 1: Create RecordCard**

Create `components/records/RecordCard.tsx`:
```tsx
import Link from 'next/link'
import type { SurgicalRecord } from '@/types'

interface Props { record: SurgicalRecord }

export default function RecordCard({ record }: Props) {
  const f = record.final_data
  const date = f.fecha_cirugia
    ? new Date(f.fecha_cirugia).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date(record.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <Link href={`/records/${record.id}`}>
      <div className="bg-slate-800 rounded-xl p-4 mb-3 active:opacity-70">
        <div className="flex justify-between items-start mb-1">
          <span className="font-semibold text-white">{f.paciente ?? 'Sin nombre'}</span>
          <span className="text-xs text-slate-400">{date}</span>
        </div>
        <p className="text-sm text-slate-400 truncate">{f.procedimiento ?? f.diagnostico ?? '—'}</p>
        {f.sanatorio && <p className="text-xs text-slate-500 mt-1">{f.sanatorio}</p>}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Build records list page**

Replace `app/(app)/records/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import RecordCard from '@/components/records/RecordCard'
import type { SurgicalRecord } from '@/types'

export default function RecordsPage() {
  const [records, setRecords] = useState<SurgicalRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/records')
      .then(r => r.json())
      .then(d => { setRecords(d.records ?? []); setLoading(false) })
  }, [])

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Registros</h1>
      {loading && <p className="text-slate-400 text-center py-8">Cargando...</p>}
      {!loading && records.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">No hay registros aún</p>
          <p className="text-slate-500 text-sm">Tocá 📷 para crear el primero</p>
        </div>
      )}
      {records.map(r => <RecordCard key={r.id} record={r} />)}
    </div>
  )
}
```

- [ ] **Step 3: Build record detail page**

Create `app/(app)/records/[id]/page.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import RecordForm from '@/components/records/RecordForm'
import type { SurgicalRecord, SurgicalFields } from '@/types'

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [record, setRecord] = useState<SurgicalRecord | null>(null)
  const [fields, setFields] = useState<SurgicalFields | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/records/${id}`)
      .then(r => r.json())
      .then(d => { setRecord(d); setFields(d.final_data); setLoading(false) })
  }, [id])

  async function handleSave() {
    if (!fields) return
    setSaving(true)
    await fetch(`/api/records/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_data: fields, status: 'final' }),
    })
    setSaving(false)
    router.push('/records')
  }

  if (loading) return <p className="text-slate-400 text-center py-12">Cargando...</p>
  if (!record || !fields) return <p className="text-red-400 text-center py-12">Registro no encontrado</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-slate-400">←</button>
        <h1 className="text-xl font-bold">Detalle</h1>
      </div>
      <RecordForm
        fields={fields}
        recordFields={record.record_fields ?? []}
        onChange={setFields}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/records/RecordCard.tsx app/(app)/records/
git commit -m "feat: add records list and detail pages"
```

---

### Task 15: Search + filters

**Files:**
- Create: `app/api/search/route.ts`
- Modify: `app/(app)/search/page.tsx`

- [ ] **Step 1: Create search API route**

Create `app/api/search/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const cirujano = searchParams.get('cirujano')
  const sanatorio = searchParams.get('sanatorio')

  let query = supabase
    .from('surgical_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (q.trim()) {
    query = query.or(
      `final_data->>'paciente'.ilike.%${q}%,` +
      `final_data->>'cirujano'.ilike.%${q}%,` +
      `final_data->>'procedimiento'.ilike.%${q}%,` +
      `final_data->>'diagnostico'.ilike.%${q}%`
    )
  }
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59Z')
  if (cirujano) query = query.ilike("final_data->>'cirujano'", `%${cirujano}%`)
  if (sanatorio) query = query.ilike("final_data->>'sanatorio'", `%${sanatorio}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ records: data })
}
```

- [ ] **Step 2: Build search page**

Replace `app/(app)/search/page.tsx`:
```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import RecordCard from '@/components/records/RecordCard'
import type { SurgicalRecord } from '@/types'

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [records, setRecords] = useState<SurgicalRecord[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const res = await fetch(`/api/search?${params}`)
    const data = await res.json()
    setRecords(data.records ?? [])
    setLoading(false)
  }, [q, from, to])

  useEffect(() => { search() }, [search])

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Buscar</h1>
      <input
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Paciente, procedimiento, diagnóstico..."
        className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 border border-slate-700 mb-3 focus:outline-none focus:border-blue-500"
      />
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Desde</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
        </div>
      </div>
      {loading && <p className="text-slate-400 text-center py-4">Buscando...</p>}
      {!loading && records.length === 0 && q && (
        <p className="text-slate-500 text-center py-8">Sin resultados</p>
      )}
      {records.map(r => <RecordCard key={r.id} record={r} />)}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/search/ app/(app)/search/
git commit -m "feat: add search API route and search page with filters"
```

---

### Task 16: Settings page (API key + custom fields)

**Files:**
- Modify: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Build settings page**

Replace `app/(app)/settings/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const MODELS = [
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'google/gemini-2.0-flash-001',
]

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(MODELS[0])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('preferred_model')
        .eq('id', user.id)
        .single()
      if (data?.preferred_model) setModel(data.preferred_model)
      setLoading(false)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openrouter_key: apiKey || undefined, preferred_model: model }),
    })
    setSaving(false)
    setSaved(true)
    setApiKey('')
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <p className="text-slate-400 text-center py-12">Cargando...</p>

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Configuración</h1>
      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm text-slate-400 mb-1">OpenRouter API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-or-v1-... (dejá vacío para no cambiar)"
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">Se guarda encriptada. Obtené tu key en openrouter.ai</p>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Modelo preferido</label>
          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 border border-slate-700 focus:outline-none focus:border-blue-500"
          >
            {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl"
        >
          {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Create /api/settings route**

Create `app/api/settings/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { openrouter_key?: string; preferred_model?: string }
  const update: Record<string, string> = {}

  if (body.openrouter_key?.trim()) {
    update.openrouter_key = encrypt(body.openrouter_key.trim())
  }
  if (body.preferred_model) {
    update.preferred_model = body.preferred_model
  }

  const { error } = await supabase.from('users').update(update).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/settings/ app/api/settings/
git commit -m "feat: add settings page for API key and model configuration"
```

---

### Task 17: Invitations API + admin users page

**Files:**
- Create: `app/api/invites/route.ts`
- Create: `app/(app)/settings/users/page.tsx`

- [ ] **Step 1: Create invitations route**

Create `app/api/invites/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET: validate token (used by accept-invite page)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('invitations')
    .select('email, expires_at, accepted_at')
    .eq('token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (data.accepted_at) return NextResponse.json({ error: 'Invitation already used' }, { status: 410 })
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ error: 'Invitation expired' }, { status: 410 })

  return NextResponse.json({ email: data.email })
}

// POST: either create invite (admin) or accept invite (public with token+password)
export async function POST(req: NextRequest) {
  const body = await req.json() as { email?: string; token?: string; password?: string }

  if (body.token && body.password) {
    // Accept invitation flow
    const service = await createServiceClient()
    const { data: invite } = await service
      .from('invitations')
      .select('*')
      .eq('token', body.token)
      .single()

    if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitación inválida o vencida' }, { status: 410 })
    }

    const { error: signupError } = await service.auth.admin.createUser({
      email: invite.email,
      password: body.password,
      email_confirm: true,
    })
    if (signupError) return NextResponse.json({ error: signupError.message }, { status: 400 })

    await service.from('invitations').update({ accepted_at: new Date().toISOString() }).eq('token', body.token)
    return NextResponse.json({ ok: true })
  }

  if (body.email) {
    // Create invitation flow — admin only
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: invite, error } = await supabase
      .from('invitations')
      .insert({ email: body.email, invited_by: user.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const inviteUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'vercel.app') ?? ''}/accept-invite/${invite.token}`
    return NextResponse.json({ token: invite.token, url: inviteUrl })
  }

  return NextResponse.json({ error: 'Bad request' }, { status: 400 })
}
```

- [ ] **Step 2: Create admin users page**

Create `app/(app)/settings/users/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import type { UserProfile, Invitation } from '@/types'

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [invites, setInvites] = useState<Invitation[]>([])
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users ?? []))
    fetch('/api/invites/list').then(r => r.json()).then(d => setInvites(d.invites ?? []))
  }, [])

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    setInviteUrl(data.url)
    setEmail('')
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Usuarios</h1>

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Activos</h2>
        {users.map(u => (
          <div key={u.id} className="bg-slate-800 rounded-xl p-3 mb-2 flex justify-between items-center">
            <div>
              <p className="text-white text-sm">{u.email}</p>
              <p className="text-xs text-slate-500">{u.role}</p>
            </div>
            <span className="text-xs text-green-400">● activo</span>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Invitar usuario</h2>
        <form onSubmit={sendInvite} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            required
            className="flex-1 bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
          >
            {loading ? '...' : 'Invitar'}
          </button>
        </form>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        {inviteUrl && (
          <div className="mt-3 bg-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Link de invitación:</p>
            <p className="text-xs text-blue-400 break-all">{inviteUrl}</p>
            <button
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
              className="text-xs text-slate-500 mt-1"
            >
              📋 Copiar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create /api/users route (admin)**

Create `app/api/users/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, created_at')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/invites/ app/api/users/ app/(app)/settings/users/
git commit -m "feat: add invitations system and admin users page"
```

---

### Task 17b: Custom field templates CRUD + /api/invites/list

**Files:**
- Create: `app/api/custom-fields/route.ts`
- Create: `app/api/custom-fields/[id]/route.ts`
- Create: `app/api/invites/list/route.ts`
- Modify: `app/(app)/settings/page.tsx` (add custom fields section)

- [ ] **Step 1: Create custom fields API**

Create `app/api/custom-fields/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { FieldType } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('custom_field_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('display_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fields: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { field_name: string; field_type: FieldType; is_required?: boolean }
  if (!body.field_name?.trim()) return NextResponse.json({ error: 'field_name required' }, { status: 400 })

  const { count } = await supabase
    .from('custom_field_templates')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { data, error } = await supabase
    .from('custom_field_templates')
    .insert({
      user_id: user.id,
      field_name: body.field_name.trim(),
      field_type: body.field_type ?? 'text',
      is_required: body.is_required ?? false,
      display_order: (count ?? 0) + 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

Create `app/api/custom-fields/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('custom_field_templates')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create /api/invites/list route**

Create `app/api/invites/list/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, accepted_at, expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invites: data })
}
```

- [ ] **Step 3: Add custom fields section to settings page**

Add this section to `app/(app)/settings/page.tsx` after the save button:
```tsx
// Add these imports at top:
// import { useEffect, useState } from 'react' (already imported)
// Add after the </form> closing tag:

const [customFields, setCustomFields] = useState<CustomFieldTemplate[]>([])
const [newFieldName, setNewFieldName] = useState('')

useEffect(() => {
  fetch('/api/custom-fields').then(r => r.json()).then(d => setCustomFields(d.fields ?? []))
}, [])

async function addField() {
  if (!newFieldName.trim()) return
  const res = await fetch('/api/custom-fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field_name: newFieldName.trim(), field_type: 'text' }),
  })
  if (res.ok) {
    const data = await res.json()
    setCustomFields(prev => [...prev, data])
    setNewFieldName('')
  }
}

async function removeField(id: string) {
  await fetch(`/api/custom-fields/${id}`, { method: 'DELETE' })
  setCustomFields(prev => prev.filter(f => f.id !== id))
}

// In JSX, add after </form>:
<div className="mt-8">
  <h2 className="text-sm font-semibold text-slate-400 mb-3">Campos personalizados</h2>
  {customFields.map(f => (
    <div key={f.id} className="flex justify-between items-center bg-slate-800 rounded-lg px-3 py-2.5 mb-2">
      <span className="text-sm text-white">{f.field_name}</span>
      <button onClick={() => removeField(f.id)} className="text-red-400 text-sm">✕</button>
    </div>
  ))}
  <div className="flex gap-2 mt-2">
    <input
      type="text"
      value={newFieldName}
      onChange={e => setNewFieldName(e.target.value)}
      placeholder="Nombre del campo"
      className="flex-1 bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
      onKeyDown={e => e.key === 'Enter' && addField()}
    />
    <button onClick={addField} className="bg-slate-700 hover:bg-slate-600 text-white px-4 rounded-lg text-sm">+ Agregar</button>
  </div>
</div>
```

Note: add `import type { CustomFieldTemplate } from '@/types'` at top of the file.

- [ ] **Step 4: Commit**

```bash
git add app/api/custom-fields/ app/api/invites/list/ app/(app)/settings/
git commit -m "feat: add custom field templates CRUD and invites list endpoint"
```

---

## Sprint 4 — Reportes + Pulido

### Task 18: Export utilities (Excel + PDF)

**Files:**
- Create: `lib/export/excel.ts`
- Create: `lib/export/excel.test.ts`
- Create: `lib/export/pdf.ts`
- Create: `app/api/export/route.ts`

- [ ] **Step 1: Write failing test for Excel export**

Create `lib/export/excel.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { buildWorkbook } from './excel'
import type { SurgicalRecord } from '@/types'

const SAMPLE_RECORDS: SurgicalRecord[] = [
  {
    id: '1',
    user_id: 'u1',
    image_path: 'img/1.jpg',
    ai_raw_response: null,
    extracted_data: {} as never,
    final_data: {
      paciente: 'García, Juan',
      fecha_cirugia: '2025-04-12',
      hora_inicio: '08:30',
      hora_fin: '10:15',
      duracion: '1h 45min',
      diagnostico: 'Apendicitis',
      procedimiento: 'Apendicectomía',
      cirujano: 'Dr. Pérez',
      ayudantes: null,
      anestesiologo: 'Dra. López',
      instrumentador: null,
      sanatorio: 'Sanatorio Central',
      observaciones: null,
    },
    status: 'final',
    created_at: '2025-04-12T08:00:00Z',
    updated_at: '2025-04-12T10:30:00Z',
  },
]

describe('buildWorkbook', () => {
  it('returns a Buffer', () => {
    const buf = buildWorkbook(SAMPLE_RECORDS)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('produces valid xlsx magic bytes', () => {
    const buf = buildWorkbook(SAMPLE_RECORDS)
    // XLSX files start with PK (zip format)
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test lib/export/excel.test.ts
```
Expected: FAIL — `buildWorkbook` not defined.

- [ ] **Step 3: Implement Excel builder**

Create `lib/export/excel.ts`:
```typescript
import * as XLSX from 'xlsx'
import type { SurgicalRecord } from '@/types'

const HEADERS = [
  'Paciente', 'Fecha Cirugía', 'Hora Inicio', 'Hora Fin', 'Duración',
  'Diagnóstico', 'Procedimiento', 'Cirujano', 'Ayudantes',
  'Anestesiólogo', 'Instrumentador', 'Sanatorio', 'Observaciones', 'Creado',
]

export function buildWorkbook(records: SurgicalRecord[]): Buffer {
  const rows = records.map(r => {
    const f = r.final_data
    return [
      f.paciente, f.fecha_cirugia, f.hora_inicio, f.hora_fin, f.duracion,
      f.diagnostico, f.procedimiento, f.cirujano, f.ayudantes,
      f.anestesiologo, f.instrumentador, f.sanatorio, f.observaciones,
      new Date(r.created_at).toLocaleDateString('es-AR'),
    ]
  })

  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows])
  ws['!cols'] = HEADERS.map((_, i) => ({ wch: i === 0 ? 25 : 18 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Registros quirúrgicos')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
```

- [ ] **Step 4: Run Excel tests**

```bash
npm test lib/export/excel.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: Implement PDF builder**

Create `lib/export/pdf.ts`:
```typescript
import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer, Font
} from '@react-pdf/renderer'
import type { SurgicalRecord } from '@/types'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1e293b' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#64748b', marginBottom: 20 },
  table: { width: '100%' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#e2e8f0', paddingVertical: 6 },
  headerRow: { flexDirection: 'row', backgroundColor: '#1e40af', paddingVertical: 6, marginBottom: 2 },
  cell: { flex: 1, paddingHorizontal: 4, fontSize: 9 },
  headerCell: { flex: 1, paddingHorizontal: 4, fontSize: 9, color: 'white', fontFamily: 'Helvetica-Bold' },
  recordTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 4 },
  fieldRow: { flexDirection: 'row', marginBottom: 3 },
  fieldLabel: { width: 110, color: '#64748b', fontSize: 9 },
  fieldValue: { flex: 1, fontSize: 9 },
})

function RecordBlock({ record }: { record: SurgicalRecord }) {
  const f = record.final_data
  const pairs: [string, string | null][] = [
    ['Paciente', f.paciente], ['Fecha', f.fecha_cirugia],
    ['Hora inicio', f.hora_inicio], ['Hora fin', f.hora_fin],
    ['Duración', f.duracion], ['Diagnóstico', f.diagnostico],
    ['Procedimiento', f.procedimiento], ['Cirujano', f.cirujano],
    ['Ayudantes', f.ayudantes], ['Anestesiólogo', f.anestesiologo],
    ['Instrumentador', f.instrumentador], ['Sanatorio', f.sanatorio],
    ['Observaciones', f.observaciones],
  ]
  return (
    <View wrap={false}>
      <Text style={styles.recordTitle}>{f.paciente ?? 'Sin nombre'}</Text>
      {pairs.filter(([, v]) => v).map(([label, value]) => (
        <View key={label} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

function ReportDocument({ records, from, to }: {
  records: SurgicalRecord[]
  from: string
  to: string
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Registros Quirúrgicos</Text>
        <Text style={styles.subtitle}>Período: {from} — {to} · Total: {records.length}</Text>
        {records.map(r => <RecordBlock key={r.id} record={r} />)}
      </Page>
    </Document>
  )
}

export async function buildPDF(records: SurgicalRecord[], from: string, to: string): Promise<Buffer> {
  return renderToBuffer(React.createElement(ReportDocument, { records, from, to }))
}
```

- [ ] **Step 6: Create export API route**

Create `app/api/export/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildWorkbook } from '@/lib/export/excel'
import { buildPDF } from '@/lib/export/pdf'
import type { ExportQuery } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') as ExportQuery['format']
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!format || !from || !to) {
    return NextResponse.json({ error: 'format, from, and to are required' }, { status: 400 })
  }

  const { data: records, error } = await supabase
    .from('surgical_records')
    .select('*')
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59Z')
    .eq('status', 'final')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit
  await supabase.from('audit_log').insert({
    user_id: user.id,
    record_id: null,
    action: 'exported',
    diff: { format, from, to, count: records.length },
  })

  if (format === 'xlsx') {
    const buffer = buildWorkbook(records)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="registros-${from}-${to}.xlsx"`,
      },
    })
  }

  if (format === 'pdf') {
    const buffer = await buildPDF(records, from, to)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="registros-${from}-${to}.pdf"`,
      },
    })
  }

  return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/export/ app/api/export/
git commit -m "feat: add Excel and PDF export utilities and /api/export route"
```

---

### Task 19: Reports page

**Files:**
- Modify: `app/(app)/reports/page.tsx`

- [ ] **Step 1: Build reports page**

Replace `app/(app)/reports/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { SurgicalRecord } from '@/types'

function getDefaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(1)
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

function computeStats(records: SurgicalRecord[]) {
  const total = records.length
  const durations = records
    .map(r => r.final_data.duracion)
    .filter(Boolean)
    .map(d => {
      const hMatch = d!.match(/(\d+)h/)
      const mMatch = d!.match(/(\d+)min/)
      return (parseInt(hMatch?.[1] ?? '0') * 60) + parseInt(mMatch?.[1] ?? '0')
    })
    .filter(n => n > 0)
  const avgMin = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
  const bySanatorio = records.reduce<Record<string, number>>((acc, r) => {
    const s = r.final_data.sanatorio ?? 'Sin especificar'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})
  return { total, avgMin, bySanatorio }
}

export default function ReportsPage() {
  const defaults = getDefaultRange()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [records, setRecords] = useState<SurgicalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function loadRecords() {
    setLoading(true)
    const res = await fetch(`/api/search?from=${from}&to=${to}`)
    const data = await res.json()
    setRecords(data.records ?? [])
    setLoading(false)
    setSearched(true)
  }

  function exportFile(format: 'xlsx' | 'pdf') {
    window.open(`/api/export?format=${format}&from=${from}&to=${to}`, '_blank')
  }

  const stats = computeStats(records)

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Reportes</h1>

      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Desde</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <button
        onClick={loadRecords}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl mb-4"
      >
        {loading ? 'Cargando...' : 'Generar reporte'}
      </button>

      {searched && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{stats.total}</p>
              <p className="text-xs text-slate-400 mt-1">cirugías</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-400">
                {stats.avgMin > 0 ? `${Math.floor(stats.avgMin / 60)}h ${stats.avgMin % 60}m` : '—'}
              </p>
              <p className="text-xs text-slate-400 mt-1">duración promedio</p>
            </div>
          </div>

          {Object.keys(stats.bySanatorio).length > 0 && (
            <div className="bg-slate-800 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Por sanatorio</h3>
              {Object.entries(stats.bySanatorio)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <div key={name} className="flex justify-between text-sm mb-2">
                    <span className="text-slate-300">{name}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                ))}
            </div>
          )}

          {records.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={() => exportFile('xlsx')}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white py-3 rounded-xl text-sm font-medium"
              >
                📥 Exportar Excel
              </button>
              <button
                onClick={() => exportFile('pdf')}
                className="flex-1 bg-red-800 hover:bg-red-700 text-white py-3 rounded-xl text-sm font-medium"
              >
                📄 Exportar PDF
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(app)/reports/
git commit -m "feat: add reports page with stats and export buttons"
```

---

### Task 20: PWA manifest + final polish

**Files:**
- Create: `public/manifest.json`
- Create: `public/icons/` (add 192x192 and 512x512 PNG icons)
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create PWA manifest**

Create `public/manifest.json`:
```json
{
  "name": "Ficha Médica",
  "short_name": "FichaMed",
  "description": "Gestión de registros quirúrgicos",
  "start_url": "/records",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Generate icons**

Create a simple icon. Run this Node script once to generate placeholder icons:
```bash
node -e "
const { createCanvas } = require('canvas');
const fs = require('fs');
[192, 512].forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e40af';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'white';
  ctx.font = \`bold \${size * 0.4}px sans-serif\`;
  ctx.textAlign = 'center';
  ctx.fillText('FM', size/2, size * 0.62);
  fs.writeFileSync(\`public/icons/icon-\${size}.png\`, canvas.toBuffer('image/png'));
});
"
```

Or manually create 192×192 and 512×512 PNG images with the app logo and save to `public/icons/`.

Note: the script above requires `npm install --save-dev canvas` (native dependency, pre-built binaries available for macOS/Linux).

- [ ] **Step 3: Add pb-safe to Tailwind config**

Add to `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 4: Run final smoke test**

```bash
npm run dev
```

Walk through the full flow:
1. Open http://localhost:3000 → redirects to /login ✓
2. Log in → lands on /records ✓
3. Tap Nueva → ImageCapture shown ✓
4. Settings → enter OpenRouter key → save ✓
5. Nueva → take photo → processing → review form → save ✓
6. Records list shows new entry ✓
7. Búsqueda → search by name ✓
8. Reportes → generate → stats shown → export Excel/PDF ✓

- [ ] **Step 5: Final commit**

```bash
git add public/ tailwind.config.ts
git commit -m "feat: add PWA manifest and icons"
```

---

## Post-MVP: First admin user setup

After deploy, run this in Supabase SQL Editor to promote the first user to admin:

```sql
update public.users
set role = 'admin'
where email = 'your-email@example.com';
```

Then use the Settings → Users page to invite additional users.

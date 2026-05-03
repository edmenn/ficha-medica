# Ficha Medica - Full Modernization Design

**Date:** 2026-05-02  
**Scope:** Security, reliability, architecture, UX, testing, role separation, AI extraction improvements  
**Users:** 1-5  
**Compliance:** None required  

---

## Context

Ficha Medica is a Next.js App Router PWA deployed on Vercel with Supabase backend. Surgeons photograph surgical forms; AI (via OpenRouter) extracts structured data. Users review and save records. Admin manages users and views all records.

Audit of the full codebase found 23 issues across 9 areas. This document specifies fixes and improvements approved for implementation.

---

## Section 1: Security

### 1.1 File upload validation

**Problem:** `/api/analyze` accepts any file without MIME type or size validation. User-controlled `imageFile.name` is used directly in the storage path (path injection vector).

**Fix:**

```typescript
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
])
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

if (!ALLOWED_MIME.has(imageFile.type)) {
  return NextResponse.json({ error: 'Formato no soportado. Usá JPG, PNG, WebP o HEIC.' }, { status: 400 })
}
if (imageFile.size > MAX_SIZE_BYTES) {
  return NextResponse.json({ error: 'Imagen demasiado grande (máximo 10MB)' }, { status: 400 })
}

// UUID replaces user-controlled filename
import { randomUUID } from 'crypto'
const ext = imageFile.type.split('/')[1].replace('jpeg', 'jpg').replace('heif', 'heic')
const imagePath = `${user.id}/${randomUUID()}.${ext}`
```

### 1.2 Model validation

**Problem:** `preferred_model` in `/api/settings` accepts any string without validation.

**Fix:**

```typescript
const ALLOWED_MODEL_PATTERN = /^[a-z0-9\-]+\/[a-z0-9\-:.]+$/
if (body.preferred_model && !ALLOWED_MODEL_PATTERN.test(body.preferred_model)) {
  return NextResponse.json({ error: 'Modelo inválido' }, { status: 400 })
}
```

---

## Section 2: Reliability and Error Handling

### 2.1 Non-null assertion on signed URL

**Problem:** `signedData!.signedUrl` crashes with unhelpful error if Supabase Storage fails.

**Fix:** Explicit guard + cleanup of already-uploaded image.

```typescript
const { data: signedData, error: signedError } = await service.storage
  .from('surgical-images')
  .createSignedUrl(imagePath, 300)

if (signedError || !signedData?.signedUrl) {
  await service.storage.from('surgical-images').remove([imagePath])
  return NextResponse.json({ error: 'Error al procesar imagen' }, { status: 500 })
}
```

### 2.2 Orphaned image cleanup on DB failure

**Problem:** If `surgical_records` insert fails after a successful image upload, the image stays in storage with no associated record.

**Fix:**

```typescript
const { data: record, error: recordError } = await supabase
  .from('surgical_records').insert({...}).select().single()

if (recordError) {
  await service.storage.from('surgical-images').remove([imagePath])
  return NextResponse.json({ error: 'Error al guardar registro' }, { status: 500 })
}
```

### 2.3 Silent insert failures

**Problem:** `record_fields` and `audit_log` inserts fail silently — errors swallowed with no logging.

**Fix:** Log errors without blocking the primary response.

```typescript
const { error: auditError } = await supabase.from('audit_log').insert({...})
if (auditError) console.error('[audit_log insert]', auditError.message)
```

### 2.4 Pagination parameter validation

**Problem:** `parseInt('abc')` returns `NaN`, breaking the Supabase range query.

**Fix:**

```typescript
const rawPage = parseInt(searchParams.get('page') ?? '1')
const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
```

### 2.5 Analyze timeout

**Problem:** If OpenRouter hangs, the client shows an infinite spinner with no recovery path.

**Fix:** 30-second AbortController timeout on the client.

```typescript
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 30_000)

const res = await fetch('/api/analyze', {
  method: 'POST',
  body: form,
  signal: controller.signal,
}).finally(() => clearTimeout(timeout))
```

---

## Section 3: Data Architecture — Eliminate Triple Storage

### Problem

The same surgical field data exists in three places simultaneously:
- `surgical_records.extracted_data` (JSONB) — what AI extracted
- `surgical_records.final_data` (JSONB) — what user confirmed
- `record_fields` table (rows) — same content plus binary confidence

Any edit must update all three. Inconsistency is inevitable at scale. The `confidence` field is always 0 or 1 (not a real model score), making `record_fields` valueless.

### Fix: Drop `record_fields` table

`extracted_data` vs `final_data` captures everything `record_fields` provided:
- AI vs user comparison: `extracted_data[field]` vs `final_data[field]`
- Derived confidence: `extracted_data[field] !== null`

```typescript
// Derive confidence without a table
const confidence = (field: keyof SurgicalFields, record: SurgicalRecord) =>
  record.extracted_data[field] !== null ? 'high' : 'low'
```

```sql
-- Migration
DROP TABLE record_fields;
```

**Type changes:**
- Remove `RecordField` interface from `types/index.ts`
- Remove `record_fields?: RecordField[]` from `SurgicalRecord`
- Remove `AnalyzeResponse.record_fields`

**Trade-off:** If real per-field confidence scores from the model are needed in the future, a `record_fields` table can be re-added. Today the field is binary and doesn't justify the complexity.

---

## Section 4: Data Fetching — Server Components + Server Actions

### Problem

All pages use `useEffect + fetch + useState` for data loading. This causes a blank-screen flash on every navigation, has no caching, no retry, and requires manual auth checks in every client component.

### Fix: Server Components for initial data, Server Actions for mutations

No new dependencies. App Router native.

**Pages become async Server Components:**

```typescript
// app/(app)/records/page.tsx
export default async function RecordsPage({ searchParams }: { searchParams: { page?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const page = Math.max(1, Number(searchParams?.page ?? 1) || 1)

  const { data: records, count } = await supabase
    .from('surgical_records')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * 20, page * 20 - 1)

  return <RecordsList records={records ?? []} total={count ?? 0} page={page} />
}
```

**Mutations use Server Actions:**

```typescript
// app/(app)/records/[id]/actions.ts
'use server'
import { revalidatePath } from 'next/cache'

export async function updateRecord(id: string, data: Partial<SurgicalFields>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase
    .from('surgical_records')
    .update({ final_data: data, status: 'final', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  revalidatePath(`/records/${id}`)
  revalidatePath('/records')
}
```

**Client components use `useTransition` with Server Actions:**

```typescript
'use client'
export function SaveButton({ recordId, fields }: ...) {
  const [saving, startTransition] = useTransition()

  return (
    <button
      disabled={saving}
      onClick={() => startTransition(() => updateRecord(recordId, fields))}
    >
      {saving ? 'Guardando...' : 'Guardar'}
    </button>
  )
}
```

**What stays client-side:** `ImageCapture` (browser APIs), `RecordForm` (field editing state), `UsersAdminPanel` (complex interactions), `Combobox` for autocomplete.

**What moves to Server Components:** `records/page.tsx`, `records/[id]/page.tsx`, `reports/page.tsx`, `search/page.tsx`, `settings/page.tsx`.

---

## Section 5: UX — Skeletons, Error Boundaries, Loading States

### App Router convention files

```
app/(app)/
├── loading.tsx          # spinner for page transitions
├── error.tsx            # global error boundary
├── records/
│   ├── loading.tsx      # record list skeleton
│   └── [id]/
│       └── loading.tsx  # record detail skeleton
```

**`loading.tsx` (global):**

```typescript
export default function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
    </div>
  )
}
```

**`records/loading.tsx` (skeleton):**

```typescript
export default function RecordsLoading() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-slate-800 rounded-xl p-4 animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-1/3 mb-2" />
          <div className="h-3 bg-slate-700 rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}
```

**`error.tsx` (recovery):**

```typescript
'use client'
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-red-400 mb-4">{error.message}</p>
      <button onClick={reset} className="text-slate-400 underline text-sm">
        Reintentar
      </button>
    </div>
  )
}
```

---

## Section 6: Service Worker — Offline Support

### Strategy: cache app shell + queue pending uploads

Rationale: surgeons photograph in OR where signal is intermittent. The critical failure is losing a captured image when connection drops mid-upload.

**`public/sw.js`:**

```typescript
const CACHE = 'ficha-medica-v1'
const APP_SHELL = ['/', '/new', '/records', '/search', '/reports']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)))
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'Sin conexión' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached ?? fetch(e.request))
  )
})

// Background Sync for pending uploads (Chrome/Android only)
self.addEventListener('sync', (e) => {
  if (e.tag === 'upload-pending') e.waitUntil(flushPendingUploads())
})
```

**Client-side fallback (covers iOS Safari where Background Sync is unavailable):**

```typescript
// /new page — if analyze fails due to no connection
const res = await fetch('/api/analyze', { method: 'POST', body: form, signal: controller.signal })
  .catch(async (err) => {
    if (err.name === 'AbortError' || !navigator.onLine) {
      await savePendingUpload(form) // IndexedDB
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const sw = await navigator.serviceWorker.ready
        await sw.sync.register('upload-pending')
      }
      setError('Sin conexión. La ficha se enviará cuando vuelva la señal.')
      setStep('capture')
    }
    return null
  })
```

**SW registration in `app/layout.tsx`:**

```typescript
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
  }
}, [])
```

**Scope:** App shell cached for offline access. Pending uploads queued via IndexedDB + Background Sync (Chrome/Android) or manual retry prompt (iOS). Records list does NOT cache for offline reading — bidirectional sync is out of scope.

---

## Section 7: Testing

### API route tests (Vitest + Supabase mock)

Coverage targets: auth guards, validation, cleanup behavior, error paths.

```typescript
// app/api/analyze/route.test.ts
describe('POST /api/analyze', () => {
  it('returns 401 when unauthenticated')
  it('returns 400 for disallowed MIME type')
  it('returns 400 for file over 10MB')
  it('returns 422 when OpenRouter key not configured')
  it('removes uploaded image if DB insert fails')
  it('returns 502 if OpenRouter call fails')
})

// app/api/records/route.test.ts
describe('GET /api/records', () => {
  it('returns 401 when unauthenticated')
  it('defaults to page 1 for non-numeric page param')
  it('returns paginated results with total count')
})

describe('POST /api/records', () => {
  it('returns 401 when unauthenticated')
  it('returns 403 for admin user')
  it('returns 400 when no final_data provided')
  it('writes audit_log on successful create')
})

// app/api/users/route.test.ts
describe('GET /api/users', () => {
  it('returns 401 when unauthenticated')
  it('returns 403 for non-admin')
  it('returns user list for admin')
})
```

### E2E tests (Playwright against local Supabase)

Three critical flows only:

```typescript
// e2e/auth.spec.ts
test('unauthenticated user redirects to /login')
test('authenticated user redirects from /login to /records')

// e2e/new-record.spec.ts
test('full flow: capture → analyze → save → appears in list')

// e2e/admin.spec.ts
test('admin cannot access /new')
test('admin sees records from all users')
test('regular user cannot access /settings/users')
```

**Setup:** Supabase local (`supabase start`), `.env.test` with local credentials, `vitest.config.ts` `setupFiles` for Supabase mock helpers.

---

## Section 8: Role Separation — Admin as Pure Management Role

### Current behavior (broken)
- Admin can create surgical records (same as user)
- Admin sees only their own records (RLS filters `user_id = auth.uid()`)

### Target behavior
| Action | Admin | User |
|--------|-------|------|
| View records | All users | Own only |
| Create record | No (403) | Yes |
| Edit record | No (403) | Yes (own only) |
| Export | All users | Own only |
| Manage users | Yes | No |

### RLS changes

```sql
-- Helper function avoids recursion (prior bug: commit 645856b)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
$$;

-- Admin sees all records, user sees own
DROP POLICY IF EXISTS "users_own_records" ON surgical_records;
CREATE POLICY "records_select" ON surgical_records
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- INSERT/UPDATE/DELETE stay user_id = auth.uid() (admins blocked at RLS + API)
```

### API changes

```typescript
// lib/auth.ts
export async function requireOperationalUser() {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'Unauthorized', status: 401 as const }
  if (profile.role === 'admin') return { error: 'Admins no pueden operar registros', status: 403 as const }
  return { profile }
}
```

Used in: `/api/analyze POST`, `/api/records POST`, `/api/records/[id] PATCH`.

### Export scope by role

```typescript
// /api/export
let query = supabase.from('surgical_records').select('*')
if (profile.role !== 'admin') {
  query = query.eq('user_id', profile.id)
}
```

### UI changes

```typescript
// app/(app)/layout.tsx — pass role to nav
const profile = await getCurrentUserProfile()
// ...
<BottomNav role={profile.role} />
```

```typescript
// components/ui/BottomNav.tsx
export function BottomNav({ role }: { role: UserRole }) {
  return (
    <nav>
      <NavItem href="/records" label="Fichas" />
      <NavItem href="/search" label="Buscar" />
      {role === 'user' && <NavItem href="/new" label="Nueva" />}
      <NavItem href="/reports" label="Reportes" />
      <NavItem href="/settings" label="Config" />
    </nav>
  )
}
```

---

## Section 9: Functional Improvements to AI Extraction

### 9.1 Custom fields in extraction prompt

**Problem:** User-defined `CustomFieldTemplate` records exist but the extraction prompt is static — custom fields are never extracted by the AI.

**Fix:** Build prompt dynamically per user.

```typescript
// /api/analyze
const { data: customTemplates } = await supabase
  .from('custom_field_templates')
  .select('field_name, field_type')
  .eq('user_id', user.id)
  .order('display_order')

const prompt = buildExtractionPrompt(customTemplates ?? [])
```

```typescript
// lib/openrouter.ts
export function buildExtractionPrompt(customFields: Pick<CustomFieldTemplate, 'field_name' | 'field_type'>[]): string {
  const customSection = customFields.length > 0
    ? `\nAdemás extraé estos campos adicionales:\n${customFields.map(f => `- "${f.field_name}": ${f.field_type}`).join('\n')}`
    : ''
  return `${BASE_EXTRACTION_PROMPT}${customSection}`
}
```

### 9.2 Structured output (JSON mode)

**Problem:** Parser uses regex to find JSON inside free text — fragile across models.

**Fix:** Use `response_format: { type: "json_object" }` when model supports it.

```typescript
const MODELS_WITH_JSON_MODE = new Set([
  'openai/gpt-4o', 'openai/gpt-4o-mini',
  'anthropic/claude-3.5-sonnet', 'anthropic/claude-3-haiku',
  'google/gemini-pro-1.5',
])

const completion = await client.chat.completions.create({
  model,
  messages: [...],
  max_tokens: 1000,
  ...(MODELS_WITH_JSON_MODE.has(model) && {
    response_format: { type: 'json_object' },
  }),
})
```

```typescript
// lib/ai-parser.ts — simplified with JSON mode
export function parseAIResponse(raw: string): { fields: SurgicalFields } {
  try {
    const parsed = JSON.parse(raw)
    return { fields: normalizeSurgicalFields(parsed as Record<string, unknown>) }
  } catch {
    // Fallback: try fence extraction for models without JSON mode
    try {
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      const parsed = JSON.parse(fence ? fence[1].trim() : raw.trim())
      return { fields: normalizeSurgicalFields(parsed as Record<string, unknown>) }
    } catch {
      return { fields: emptyFields() }
    }
  }
}
```

### 9.3 Multi-image per record

**Problem:** Surgical forms often span multiple pages. Only one image per record is supported.

**Data change:**

```typescript
// types/index.ts
interface SurgicalRecord {
  // ...
  image_paths: string[]  // replaces image_path: string
}
```

```sql
-- Migration
ALTER TABLE surgical_records ADD COLUMN image_paths text[] DEFAULT '{}';
UPDATE surgical_records SET image_paths = ARRAY[image_path] WHERE image_path IS NOT NULL;
-- Keep image_path for backwards compat during migration, drop in follow-up
```

**UI flow:** In the review step, user can tap "+ Agregar página". Second image triggers another `/api/analyze` call. Fields extracted from image 2 fill only the `null` slots from image 1 (non-destructive merge).

### 9.4 Visual diff in review form

**Problem:** All fields look identical in the review form — no indication of which were extracted vs which are empty.

**Fix in `FieldRow.tsx`:**

```typescript
export function FieldRow({ fieldName, aiValue, value, onChange }: FieldRowProps) {
  const wasExtracted = aiValue !== null
  const wasModified = value !== aiValue

  return (
    <div className={`border-l-2 ${wasExtracted ? 'border-emerald-600' : 'border-slate-700'} pl-3`}>
      <label className="flex items-center gap-2 text-xs text-slate-400 mb-1">
        {fieldName}
        {wasExtracted && <span className="text-emerald-500">IA</span>}
        {wasModified && <span className="text-amber-500">editado</span>}
      </label>
      <input value={value ?? ''} onChange={onChange} className="..." />
    </div>
  )
}
```

### 9.5 Duplicate detection

**Problem:** Creating a record with the same patient and surgery date as an existing one produces a silent duplicate.

**Fix:** Check before inserting, return a warning with the existing record ID so the client can ask the user to confirm.

```typescript
// /api/analyze — after extraction, before DB insert
if (fields.paciente && fields.fecha_cirugia) {
  const { data: existing } = await supabase
    .from('surgical_records')
    .select('id')
    .eq('user_id', user.id)
    .eq('final_data->>paciente', fields.paciente)
    .eq('final_data->>fecha_cirugia', fields.fecha_cirugia)
    .limit(1)

  if (existing?.length) {
    return NextResponse.json({
      warning: 'duplicate',
      existing_id: existing[0].id,
      extracted_data: fields,
    }, { status: 200 })
    // Client shows: "Ya existe una ficha para este paciente en esta fecha. ¿Crear igual?"
    // If confirmed, client calls /api/records POST directly
  }
}
```

### 9.6 Autocomplete from history

**Problem:** Repetitive fields (`cirujano`, `anestesiologo`, `sanatorio`, `procedimiento`) are typed from scratch each time.

**New endpoint: `GET /api/search/suggestions?field=cirujano&q=Mar`**

```typescript
export async function GET(req: NextRequest) {
  const field = req.nextUrl.searchParams.get('field')
  const q = req.nextUrl.searchParams.get('q') ?? ''

  const ALLOWED = ['cirujano', 'anestesiologo', 'sanatorio', 'procedimiento', 'instrumentador']
  if (!field || !ALLOWED.includes(field)) {
    return NextResponse.json({ suggestions: [] })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('surgical_records')
    .select(`final_data->>${field}`)
    .eq('user_id', user.id)
    .ilike(`final_data->>${field}`, `${q}%`)
    .limit(10)

  const suggestions = [...new Set(
    data?.map((r: Record<string, string>) => r[field]).filter(Boolean)
  )]
  return NextResponse.json({ suggestions })
}
```

`FieldRow` shows a `Combobox` component for the 5 allowed fields.

### 9.7 Date and time validation

**Problem:** No validation prevents `fecha_cirugia > fecha_fin` or `hora_inicio > hora_fin`.

**Fix in `lib/record-utils.ts`:**

```typescript
export function validateSurgicalFields(fields: SurgicalFields): string[] {
  const errors: string[] = []

  if (fields.fecha_cirugia && fields.fecha_fin) {
    if (new Date(fields.fecha_cirugia) > new Date(fields.fecha_fin)) {
      errors.push('La fecha de inicio no puede ser posterior a la fecha de fin')
    }
  }

  if (
    fields.hora_inicio && fields.hora_fin &&
    fields.fecha_cirugia === fields.fecha_fin
  ) {
    if (fields.hora_inicio > fields.hora_fin) {
      errors.push('La hora de inicio no puede ser posterior a la hora de fin')
    }
  }

  return errors
}
```

Called in `RecordForm` before enabling save, and in `/api/records POST` and `PATCH`.

---

## Summary

| # | Section | Category | Effort |
|---|---------|----------|--------|
| 1 | Upload validation + filename sanitization | Security | Low |
| 2 | Null guards, cleanup, silent errors, timeout | Reliability | Low |
| 3 | Drop `record_fields` table | Architecture | Medium |
| 4 | Server Components + Server Actions | Architecture | Medium |
| 5 | Skeletons + error boundaries | UX | Low |
| 6 | Service Worker offline | UX | High |
| 7 | API route tests + E2E critical flows | Testing | Medium |
| 8 | Admin/user role separation | Functional | Medium |
| 9 | Custom fields IA, JSON mode, multi-image, visual diff, duplicate detection, autocomplete, date validation | Functional | High |

**Total: 23 improvements across 9 areas.**

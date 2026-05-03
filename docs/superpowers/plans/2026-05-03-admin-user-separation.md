# Admin/User Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split admin and user environments into structurally isolated Next.js route groups with centralized auth guards, a dedicated admin panel, and a full impersonation system.

**Architecture:** Route groups `(user)` and `(admin)` provide compile-time isolation — each has its own layout that enforces role. Centralized guards in `lib/auth/guards.ts` replace scattered inline checks. Impersonation uses a dedicated `impersonation_sessions` DB table plus an httpOnly cookie; all operational API endpoints route through `requireOperationalContext()` which resolves the effective user id.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + Auth + RLS), Tailwind CSS, server components for pages/layouts, client components for interactive UI.

---

## File Map

### Created
- `lib/auth/guards.ts` — centralized SSR + API role guards
- `lib/auth/impersonation.ts` — impersonation helpers (cookie, DB lookup)
- `app/(admin)/layout.tsx` — AdminLayout (role=admin enforced)
- `app/(admin)/admin/page.tsx` — admin dashboard
- `app/(user)/layout.tsx` — UserLayout (role=user enforced, replaces (app)/layout.tsx)
- `components/admin/layout/AdminNav.tsx` — admin-only bottom nav
- `components/admin/dashboard/AdminDashboard.tsx` — dashboard stats component
- `components/admin/impersonation/ImpersonationBanner.tsx` — impersonation warning bar
- `components/admin/users/UsersPanel.tsx` — ABM users component (replaces UsersAdminPanel)
- `app/api/admin/impersonation/start/route.ts`
- `app/api/admin/impersonation/stop/route.ts`
- `app/api/admin/impersonation/status/route.ts`
- `app/api/users/[id]/route.ts` — PATCH (edit user) + DELETE (soft-delete)
- `supabase/migrations/004_impersonation.sql`
- `docs/ARQUITECTURA_ADMIN_USER.md`

### Moved (git mv)
- `app/(app)/` → `app/(user)/` (entire group rename)
- `app/(user)/admin/` → `app/(admin)/admin/` (extract admin subtree)

### Modified
- `lib/auth.ts` — update `getHomePathForRole` to return `/admin`
- `app/page.tsx` — explicit role-based redirect
- `app/(user)/layout.tsx` — UserLayout content (after rename)
- `components/ui/BottomNav.tsx` — remove `role` prop, user-only
- `components/admin/AdminUserDetailPage.tsx` — strip dashboard card UI
- `components/settings/SettingsPageClient.tsx` — remove admin users section
- `app/api/records/route.ts` — use `requireOperationalContext()`
- `app/api/records/[id]/route.ts` — use `requireOperationalContext()`
- `app/api/analyze/route.ts` — use `requireOperationalContext()`
- `app/api/search/route.ts` — use `requireOperationalContext()`
- `app/api/export/route.ts` — use `requireOperationalContext()`
- `app/api/custom-fields/route.ts` — use `requireOperationalContext()`
- `app/api/custom-fields/[id]/route.ts` — use `requireOperationalContext()`
- `app/api/search/suggestions/route.ts` — use `requireOperationalContext()`
- `app/api/users/route.ts` — use `requireAdminApi()`, add record count
- `app/api/invites/route.ts` — use `requireAdminApi()`
- `app/api/invites/list/route.ts` — use `requireAdminApi()`

---

## Task 1: Auth Guards Foundation

**Files:**
- Create: `lib/auth/guards.ts`

- [ ] **Step 1: Create `lib/auth/guards.ts`**

```typescript
import { redirect } from 'next/navigation'
import { getCurrentUserProfile } from '@/lib/auth'
import type { UserProfile } from '@/types'

type ProfileSlice = Pick<UserProfile, 'id' | 'email' | 'role' | 'preferred_model'>

// SSR/layout guards — throw redirect, never return error
export async function requireUser(): Promise<ProfileSlice> {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'admin') redirect('/admin')
  return profile
}

export async function requireAdmin(): Promise<ProfileSlice> {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/records')
  return profile
}

// API route guards — return error object, never redirect
export async function requireUserApi(): Promise<{ profile: ProfileSlice } | { error: string; status: 401 | 403 }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'Unauthorized', status: 401 }
  if (profile.role === 'admin') return { error: 'Admins no pueden operar registros', status: 403 }
  return { profile }
}

export async function requireAdminApi(): Promise<{ profile: ProfileSlice } | { error: string; status: 401 | 403 }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'Unauthorized', status: 401 }
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 }
  return { profile }
}

// Impersonation-aware guard — used by all operational endpoints
// Returns effectiveUserId: the user whose records should be operated on
export async function requireOperationalContext(): Promise<
  { profile: ProfileSlice; effectiveUserId: string } | { error: string; status: 401 | 403 }
> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'Unauthorized', status: 401 }

  if (profile.role === 'admin') {
    const { getActiveImpersonation } = await import('@/lib/auth/impersonation')
    const session = await getActiveImpersonation()
    if (!session) return { error: 'Admins no pueden operar registros directamente', status: 403 }
    return { profile, effectiveUserId: session.target_user_id }
  }

  return { profile, effectiveUserId: profile.id }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `lib/auth/guards.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/auth/guards.ts
git commit -m "feat: add centralized auth guards in lib/auth/guards.ts"
```

---

## Task 2: Impersonation Helpers

**Files:**
- Create: `lib/auth/impersonation.ts`

- [ ] **Step 1: Create `lib/auth/impersonation.ts`**

```typescript
import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/types'

export const IMPERSONATION_COOKIE = 'impersonation_session_id'

export interface ImpersonationSession {
  id: string
  admin_id: string
  target_user_id: string
  started_at: string
}

export async function getActiveImpersonation(): Promise<ImpersonationSession | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (!sessionId) return null

  const service = await createServiceClient()
  const { data } = await service
    .from('impersonation_sessions')
    .select('id, admin_id, target_user_id, started_at')
    .eq('id', sessionId)
    .is('ended_at', null)
    .maybeSingle()

  return data ?? null
}

export async function isImpersonating(): Promise<boolean> {
  const session = await getActiveImpersonation()
  return session !== null
}

export async function getEffectiveUserProfile(): Promise<Pick<UserProfile, 'id' | 'email' | 'role' | 'preferred_model'> | null> {
  const session = await getActiveImpersonation()
  if (!session) {
    const { getCurrentUserProfile } = await import('@/lib/auth')
    return getCurrentUserProfile()
  }

  const service = await createServiceClient()
  const { data } = await service
    .from('users')
    .select('id, email, role, preferred_model')
    .eq('id', session.target_user_id)
    .maybeSingle()

  return data ?? null
}

export async function getRealUserProfile() {
  const { getCurrentUserProfile } = await import('@/lib/auth')
  return getCurrentUserProfile()
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/auth/impersonation.ts
git commit -m "feat: add impersonation helpers in lib/auth/impersonation.ts"
```

---

## Task 3: Update `lib/auth.ts`

**Files:**
- Modify: `lib/auth.ts`

Admin home path changes from `/admin/users` to `/admin`. Old `requireOperationalUser` and `requireAdminUser` are kept temporarily (removed in Task 14 after all callers migrate).

- [ ] **Step 1: Update `getHomePathForRole` in `lib/auth.ts`**

Find this line:
```typescript
export function getHomePathForRole(role: UserRole) {
  return role === 'admin' ? '/admin/users' : '/records'
}
```

Replace with:
```typescript
export function getHomePathForRole(role: UserRole) {
  return role === 'admin' ? '/admin' : '/records'
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "fix: admin home path is /admin not /admin/users"
```

---

## Task 4: Database Migration

**Files:**
- Create: `supabase/migrations/004_impersonation.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add is_active to users for soft-delete support
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Impersonation sessions
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.users(id),
  target_user_id uuid NOT NULL REFERENCES public.users(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  CONSTRAINT no_self_impersonation CHECK (admin_id != target_user_id)
);

-- Only service role can access impersonation_sessions
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
-- No RLS policies = service role only (default deny for authenticated/anon)

-- Index for fast active session lookup by session id + ended_at
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active
  ON public.impersonation_sessions(id)
  WHERE ended_at IS NULL;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool with the content above.

- [ ] **Step 3: Verify migration applied**

Use `mcp__supabase__list_migrations` to confirm `004_impersonation` appears.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_impersonation.sql
git commit -m "feat: add impersonation_sessions table and users.is_active column"
```

---

## Task 5: Route Group Rename

**Files:**
- Move: `app/(app)/` → `app/(user)/`
- Move: `app/(user)/admin/` → `app/(admin)/admin/`

This is a structural rename. No file content changes in this task — content changes come in Tasks 6 and 7.

- [ ] **Step 1: Rename `(app)` to `(user)`**

```bash
git mv "app/(app)" "app/(user)"
```

- [ ] **Step 2: Create `(admin)` group and move admin subtree**

```bash
mkdir -p "app/(admin)"
git mv "app/(user)/admin" "app/(admin)/admin"
```

- [ ] **Step 3: Verify build still works**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds. URLs `/records`, `/admin/users`, `/admin/users/[id]` are all still served.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: rename (app) → (user), extract (admin) route group"
```

---

## Task 6: UserLayout + BottomNav Cleanup

**Files:**
- Modify: `app/(user)/layout.tsx`
- Modify: `components/ui/BottomNav.tsx`

- [ ] **Step 1: Replace `app/(user)/layout.tsx` with UserLayout**

```typescript
import { redirect } from 'next/navigation'
import BottomNav from '@/components/ui/BottomNav'
import ImpersonationBanner from '@/components/admin/impersonation/ImpersonationBanner'
import { getCurrentUserProfile } from '@/lib/auth'
import { isImpersonating } from '@/lib/auth/impersonation'

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'admin') {
    // Admin without impersonation should not be in user routes
    const impersonating = await isImpersonating()
    if (!impersonating) redirect('/admin')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <ImpersonationBanner />
      <main className="pb-20 mx-auto px-4 pt-4 max-w-lg">{children}</main>
      <BottomNav />
    </div>
  )
}
```

Note: `ImpersonationBanner` renders nothing when not impersonating (implemented in Task 13). `BottomNav` no longer receives `role` prop.

- [ ] **Step 2: Simplify `components/ui/BottomNav.tsx`**

Replace the entire file:

```typescript
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
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {NAV_ITEMS.map(item => {
          const active = item.href === '/settings'
            ? pathname === '/settings'
            : pathname.startsWith(item.href)
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

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/\(user\)/layout.tsx components/ui/BottomNav.tsx
git commit -m "feat: UserLayout with role guard and simplified BottomNav (user-only)"
```

---

## Task 7: AdminNav + AdminLayout

**Files:**
- Create: `components/admin/layout/AdminNav.tsx`
- Create: `app/(admin)/layout.tsx`

- [ ] **Step 1: Create `components/admin/layout/AdminNav.tsx`**

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ADMIN_NAV_ITEMS = [
  { href: '/admin', icon: '🏠', label: 'Dashboard' },
  { href: '/admin/users', icon: '🧑‍💼', label: 'Usuarios' },
  { href: '/settings', icon: '⚙️', label: 'Cuenta' },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800">
      <div className="flex justify-around items-center h-16 max-w-6xl mx-auto px-2">
        {ADMIN_NAV_ITEMS.map(item => {
          const active = item.href === '/admin'
            ? pathname === '/admin'
            : item.href === '/settings'
              ? pathname === '/settings'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 flex-1"
            >
              <span className="text-xl">{item.icon}</span>
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

- [ ] **Step 2: Create `app/(admin)/layout.tsx`**

```typescript
import { redirect } from 'next/navigation'
import AdminNav from '@/components/admin/layout/AdminNav'
import { getActiveImpersonation } from '@/lib/auth/impersonation'
import { getCurrentUserProfile } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/records')

  // If admin has an active impersonation session they shouldn't be browsing /admin
  // (they should be in the user environment). Show a warning redirect.
  const impersonation = await getActiveImpersonation()
  if (impersonation) redirect('/records')

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="pb-20 mx-auto px-4 pt-4 max-w-6xl">{children}</main>
      <AdminNav />
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/layout/AdminNav.tsx app/\(admin\)/layout.tsx
git commit -m "feat: AdminNav and AdminLayout with role guard"
```

---

## Task 8: Root Redirect Update

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update `app/page.tsx`**

Replace the entire file:

```typescript
import { redirect } from 'next/navigation'
import { getCurrentUserProfile } from '@/lib/auth'

export default async function Home() {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'admin') redirect('/admin')
  redirect('/records')
}
```

- [ ] **Step 2: Verify type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "fix: root redirect — admin to /admin, user to /records"
```

---

## Task 9: Admin Dashboard

**Files:**
- Create: `components/admin/dashboard/AdminDashboard.tsx`
- Create: `app/(admin)/admin/page.tsx`

- [ ] **Step 1: Create `components/admin/dashboard/AdminDashboard.tsx`**

```typescript
import Link from 'next/link'

interface AdminStats {
  totalUsers: number
  userCount: number
  adminCount: number
  pendingInvitations: number
}

export default function AdminDashboard({ stats }: { stats: AdminStats }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Panel de Administración</h1>
        <p className="mt-1 text-sm text-slate-400">Resumen del sistema</p>
      </div>

      <div className="mb-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-800">
            <tr>
              <td className="px-4 py-3 text-slate-400">Total usuarios</td>
              <td className="px-4 py-3 text-right font-semibold text-white">{stats.totalUsers}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-400">Usuarios operativos</td>
              <td className="px-4 py-3 text-right font-semibold text-white">{stats.userCount}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-400">Administradores</td>
              <td className="px-4 py-3 text-right font-semibold text-white">{stats.adminCount}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-400">Invitaciones pendientes</td>
              <td className="px-4 py-3 text-right font-semibold text-amber-300">{stats.pendingInvitations}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/admin/users"
          className="block rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
        >
          Gestionar usuarios →
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(admin)/admin/page.tsx`**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import AdminDashboard from '@/components/admin/dashboard/AdminDashboard'

export default async function AdminPage() {
  await requireAdmin()

  const service = await createServiceClient()

  const [usersResult, invitesResult] = await Promise.all([
    service.from('users').select('role'),
    service
      .from('invitations')
      .select('id')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString()),
  ])

  const users = usersResult.data ?? []
  const stats = {
    totalUsers: users.length,
    userCount: users.filter(u => u.role === 'user').length,
    adminCount: users.filter(u => u.role === 'admin').length,
    pendingInvitations: invitesResult.data?.length ?? 0,
  }

  return <AdminDashboard stats={stats} />
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Verify `/admin` loads in browser**

Start dev server (`npm run dev`), log in as admin, navigate to `/admin`. Should see dashboard table with stats.

- [ ] **Step 5: Commit**

```bash
git add components/admin/dashboard/AdminDashboard.tsx app/\(admin\)/admin/page.tsx
git commit -m "feat: admin dashboard at /admin with system stats"
```

---

## Task 10: ABM Usuarios — Component + API

**Files:**
- Create: `components/admin/users/UsersPanel.tsx`
- Create: `app/api/users/[id]/route.ts`
- Modify: `app/api/users/route.ts`
- Modify: `app/(admin)/admin/users/page.tsx`

- [ ] **Step 1: Create `components/admin/users/UsersPanel.tsx`**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'

interface User {
  id: string
  email: string
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
  record_count: number
}

interface Invitation {
  id: string
  email: string
  status: string
  created_at: string
  expires_at: string
}

interface Props {
  users: User[]
  invitations: Invitation[]
}

export default function UsersPanel({ users, invitations }: Props) {
  const [tab, setTab] = useState<'users' | 'invitations'>('users')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [inviteEmail, setInviteEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setShowCreateForm(false)
    setEmail(''); setPassword(''); setRole('user')
    window.location.reload()
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setShowInviteForm(false)
    setInviteEmail('')
    window.location.reload()
  }

  async function handleStartImpersonation(userId: string) {
    const res = await fetch('/api/admin/impersonation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId }),
    })
    if (res.ok) {
      window.location.href = '/records'
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowInviteForm(v => !v); setShowCreateForm(false) }}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-white"
          >
            Invitar
          </button>
          <button
            onClick={() => { setShowCreateForm(v => !v); setShowInviteForm(false) }}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white"
          >
            Crear usuario
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/30 border border-red-700 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreate} className="mb-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
          <p className="text-sm font-medium text-white">Nuevo usuario</p>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña (mínimo 8 caracteres)" required minLength={8}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
          />
          <select
            value={role} onChange={e => setRole(e.target.value as 'user' | 'admin')}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white"
          >
            <option value="user">Usuario</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              {loading ? 'Creando...' : 'Crear'}
            </button>
            <button type="button" onClick={() => setShowCreateForm(false)}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {showInviteForm && (
        <form onSubmit={handleInvite} className="mb-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
          <p className="text-sm font-medium text-white">Invitar por email</p>
          <input
            type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="Email" required
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              {loading ? 'Enviando...' : 'Invitar'}
            </button>
            <button type="button" onClick={() => setShowInviteForm(false)}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab('users')}
          className={`rounded-lg px-3 py-1.5 text-sm ${tab === 'users' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
          Usuarios ({users.length})
        </button>
        <button onClick={() => setTab('invitations')}
          className={`rounded-lg px-3 py-1.5 text-sm ${tab === 'invitations' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
          Invitaciones ({invitations.length})
        </button>
      </div>

      {tab === 'users' && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/70">
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Email</th>
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Rol</th>
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Estado</th>
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Alta</th>
                <th className="px-4 py-2 text-right text-xs text-slate-400 font-medium">Registros</th>
                <th className="px-4 py-2 text-right text-xs text-slate-400 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {users.map(user => (
                <tr key={user.id}>
                  <td className="px-4 py-3 text-white">{user.email}</td>
                  <td className="px-4 py-3 text-slate-300">{user.role}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${user.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(user.created_at).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">{user.record_count}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/users/${user.id}`}
                        className="rounded px-2 py-1 text-xs bg-slate-700 text-white">
                        Ver
                      </Link>
                      {user.role === 'user' && (
                        <button
                          onClick={() => handleStartImpersonation(user.id)}
                          className="rounded px-2 py-1 text-xs bg-amber-700 text-white">
                          Entrar como usuario
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'invitations' && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/70">
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Email</th>
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Estado</th>
                <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Expira</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/40">
              {invitations.map(inv => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 text-white">{inv.email}</td>
                  <td className="px-4 py-3 text-slate-300">{inv.status}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(inv.expires_at).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
              {invitations.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-sm text-slate-500">
                    Sin invitaciones
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `app/api/users/route.ts` — add `requireAdminApi()` and record count**

Replace the entire file:

```typescript
import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const service = await createServiceClient()

  const { data: users, error } = await service
    .from('users')
    .select('id, email, role, is_active, created_at')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: counts } = await service
    .from('surgical_records')
    .select('user_id')

  const countMap = new Map<string, number>()
  for (const row of counts ?? []) {
    countMap.set(row.user_id, (countMap.get(row.user_id) ?? 0) + 1)
  }

  const result = (users ?? []).map(u => ({
    ...u,
    record_count: countMap.get(u.id) ?? 0,
  }))

  return NextResponse.json({ users: result })
}

export async function POST(req: Request) {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as { email?: string; password?: string; role?: 'admin' | 'user' }
  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()
  const role = body.role === 'admin' ? 'admin' : 'user'

  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: 'Email y contraseña válida son obligatorios' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? 'No se pudo crear el usuario' }, { status: 400 })
  }

  if (role === 'admin') {
    const { error: roleError } = await service
      .from('users')
      .update({ role })
      .eq('id', created.user.id)

    if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 })
  }

  return NextResponse.json({
    user: { id: created.user.id, email: created.user.email, role, created_at: created.user.created_at },
  }, { status: 201 })
}
```

- [ ] **Step 3: Create `app/api/users/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as { role?: 'admin' | 'user'; is_active?: boolean }
  const updates: Record<string, unknown> = {}

  if (body.role === 'admin' || body.role === 'user') updates.role = body.role
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data, error } = await service
    .from('users')
    .update(updates)
    .eq('id', params.id)
    .select('id, email, role, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const service = await createServiceClient()
  const { error } = await service
    .from('users')
    .update({ is_active: false })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Update `app/(admin)/admin/users/page.tsx`**

Replace the entire file:

```typescript
import { requireAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import UsersPanel from '@/components/admin/users/UsersPanel'

export default async function AdminUsersPage() {
  await requireAdmin()

  const service = await createServiceClient()

  const [usersResult, countsResult, invitesResult] = await Promise.all([
    service.from('users').select('id, email, role, is_active, created_at').order('created_at'),
    service.from('surgical_records').select('user_id'),
    service.from('invitations').select('id, email, status, created_at, expires_at').order('created_at', { ascending: false }),
  ])

  const countMap = new Map<string, number>()
  for (const row of countsResult.data ?? []) {
    countMap.set(row.user_id, (countMap.get(row.user_id) ?? 0) + 1)
  }

  const users = (usersResult.data ?? []).map(u => ({
    ...u,
    record_count: countMap.get(u.id) ?? 0,
  }))

  return (
    <UsersPanel
      users={users}
      invitations={invitesResult.data ?? []}
    />
  )
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Verify `/admin/users` loads and shows user list**

Start dev server, log in as admin, navigate to `/admin/users`. Should see table with users, record counts, and action buttons.

- [ ] **Step 7: Commit**

```bash
git add components/admin/users/UsersPanel.tsx app/api/users/route.ts app/api/users/\[id\]/route.ts app/\(admin\)/admin/users/page.tsx
git commit -m "feat: ABM users panel at /admin/users with record counts and PATCH/DELETE endpoints"
```

---

## Task 11: Admin User Detail Refactor + Settings Cleanup

**Files:**
- Modify: `components/admin/AdminUserDetailPage.tsx`
- Modify: `components/settings/SettingsPageClient.tsx`
- Modify: `app/(admin)/admin/users/[id]/page.tsx`

- [ ] **Step 0: Create `components/admin/users/ImpersonateButton.tsx`**

Small client component used in `AdminUserDetailPage`:

```typescript
'use client'

import { useState } from 'react'

export default function ImpersonateButton({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const res = await fetch('/api/admin/impersonation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId }),
    })
    if (res.ok) {
      window.location.href = '/records'
    } else {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-lg bg-amber-700 px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {loading ? 'Entrando...' : 'Entrar como usuario'}
    </button>
  )
}
```

- [ ] **Step 1: Refactor `components/admin/AdminUserDetailPage.tsx`**

Add import at top of the new component:
```typescript
import ImpersonateButton from '@/components/admin/users/ImpersonateButton'
```

Replace the entire file:

```typescript
import Link from 'next/link'
import type { SurgicalRecord, UserProfile } from '@/types'

const STATUS_LABELS: Record<SurgicalRecord['status'], string> = {
  draft: 'Borrador',
  reviewed: 'Revisado',
  final: 'Final',
}

interface Props {
  user: Pick<UserProfile, 'id' | 'email' | 'role' | 'created_at'>
  records: SurgicalRecord[]
}

export default function AdminUserDetailPage({ user, records }: Props) {
  const drafts = records.filter(r => r.status === 'draft').length
  const finals = records.filter(r => r.status === 'final').length

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <Link href="/admin/users" className="text-sm text-slate-400 hover:text-white">
          ← Volver a usuarios
        </Link>
      </div>

      {/* Administrative user info panel — NOT a user dashboard */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Datos del usuario supervisado</p>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-800">
            <tr>
              <td className="py-2 text-slate-400">Email</td>
              <td className="py-2 text-white font-medium text-right">{user.email}</td>
            </tr>
            <tr>
              <td className="py-2 text-slate-400">Rol</td>
              <td className="py-2 text-slate-300 text-right">{user.role}</td>
            </tr>
            <tr>
              <td className="py-2 text-slate-400">Alta</td>
              <td className="py-2 text-slate-300 text-right">
                {new Date(user.created_at).toLocaleDateString('es-AR')}
              </td>
            </tr>
            <tr>
              <td className="py-2 text-slate-400">Registros</td>
              <td className="py-2 text-slate-300 text-right">
                {records.length} ({drafts} borradores, {finals} finales)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Admin actions — ImpersonateButton is a client component */}
      <div className="mb-6 flex gap-2">
        <ImpersonateButton userId={user.id} />
      </div>

      {/* Records of supervised user — administrative view */}
      <div>
        <p className="mb-3 text-xs text-slate-500 uppercase tracking-wide">
          Registros del usuario supervisado
        </p>

        {records.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-6 text-center text-sm text-slate-500">
            Sin registros
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/70">
                  <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Fecha</th>
                  <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Cirujano</th>
                  <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Sanatorio</th>
                  <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Estado</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                {records.map(record => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 text-slate-300">
                      {record.final_data.fecha_cirugia ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {record.final_data.cirujano ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {record.final_data.sanatorio ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {STATUS_LABELS[record.status]}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/users/${user.id}/records/${record.id}`}
                        className="rounded px-2 py-1 text-xs bg-slate-700 text-white"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `app/(admin)/admin/users/[id]/page.tsx` to use `requireAdmin()`**

Read the current file, then replace the profile check at the top with `requireAdmin()` from `@/lib/auth/guards`.

Open `app/(admin)/admin/users/[id]/page.tsx`. Find the profile check (currently something like `getCurrentUserProfile()` + role check). Replace with:

```typescript
import { requireAdmin } from '@/lib/auth/guards'
// ...
export default async function AdminUserDetailPageRoute({ params }: { params: { id: string } }) {
  await requireAdmin()
  // rest of SSR data fetching unchanged
```

- [ ] **Step 3: Remove admin users section from `SettingsPageClient`**

Read `components/settings/SettingsPageClient.tsx`. Find and remove:
- Any import of `UsersAdminPanel` (or equivalent)
- Any JSX block that renders the users panel or admin-only section
- Keep: API key settings, modelo preferred, custom fields — personal account config only

The exact code to remove depends on the current file. Find the admin branch/section and delete it. The component should render the same UI regardless of role (only personal settings).

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/admin/AdminUserDetailPage.tsx components/settings/SettingsPageClient.tsx app/\(admin\)/admin/users/\[id\]/page.tsx
git commit -m "feat: admin user detail — plain admin view, no dashboard cards; strip admin section from settings"
```

---

## Task 12: Impersonation API Endpoints

**Files:**
- Create: `app/api/admin/impersonation/start/route.ts`
- Create: `app/api/admin/impersonation/stop/route.ts`
- Create: `app/api/admin/impersonation/status/route.ts`

- [ ] **Step 1: Create `app/api/admin/impersonation/start/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAdminApi } from '@/lib/auth/guards'
import { IMPERSONATION_COOKIE } from '@/lib/auth/impersonation'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as { target_user_id?: string }
  if (!body.target_user_id) {
    return NextResponse.json({ error: 'target_user_id is required' }, { status: 400 })
  }

  const service = await createServiceClient()

  // Verify target exists and is not an admin
  const { data: target, error: targetError } = await service
    .from('users')
    .select('id, role, email')
    .eq('id', body.target_user_id)
    .maybeSingle()

  if (targetError || !target) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }
  if (target.role === 'admin') {
    return NextResponse.json({ error: 'No se puede impersonar a un admin' }, { status: 403 })
  }

  const { data: session, error: sessionError } = await service
    .from('impersonation_sessions')
    .insert({ admin_id: auth.profile.id, target_user_id: body.target_user_id })
    .select('id')
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'No se pudo crear la sesión de impersonación' }, { status: 500 })
  }

  await service.from('audit_log').insert({
    user_id: auth.profile.id,
    record_id: null,
    action: 'impersonation_started',
    diff: { target_user_id: body.target_user_id, target_email: target.email, session_id: session.id },
  })

  const cookieStore = await cookies()
  cookieStore.set(IMPERSONATION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours max
  })

  return NextResponse.json({ ok: true, session_id: session.id })
}
```

- [ ] **Step 2: Create `app/api/admin/impersonation/stop/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAdminApi } from '@/lib/auth/guards'
import { IMPERSONATION_COOKIE, getActiveImpersonation } from '@/lib/auth/impersonation'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest) {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const session = await getActiveImpersonation()
  const cookieStore = await cookies()
  cookieStore.delete(IMPERSONATION_COOKIE)

  if (session) {
    const service = await createServiceClient()

    await service
      .from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', session.id)

    await service.from('audit_log').insert({
      user_id: auth.profile.id,
      record_id: null,
      action: 'impersonation_ended',
      diff: { target_user_id: session.target_user_id, session_id: session.id },
    })

    return NextResponse.json({ ok: true, redirect: `/admin/users/${session.target_user_id}` })
  }

  return NextResponse.json({ ok: true, redirect: '/admin' })
}
```

- [ ] **Step 3: Create `app/api/admin/impersonation/status/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getActiveImpersonation } from '@/lib/auth/impersonation'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const session = await getActiveImpersonation()
  if (!session) return NextResponse.json({ active: false })

  const service = await createServiceClient()
  const { data: user } = await service
    .from('users')
    .select('email')
    .eq('id', session.target_user_id)
    .maybeSingle()

  return NextResponse.json({
    active: true,
    target_user_id: session.target_user_id,
    target_email: user?.email ?? null,
    started_at: session.started_at,
  })
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/impersonation/
git commit -m "feat: impersonation API endpoints — start, stop, status"
```

---

## Task 13: ImpersonationBanner

**Files:**
- Create: `components/admin/impersonation/ImpersonationBanner.tsx`

The UserLayout already imports this (added in Task 6). Now we implement it.

- [ ] **Step 1: Create `components/admin/impersonation/ImpersonationBanner.tsx`**

```typescript
import { getActiveImpersonation } from '@/lib/auth/impersonation'
import { createServiceClient } from '@/lib/supabase/server'
import ImpersonationBannerClient from './ImpersonationBannerClient'

export default async function ImpersonationBanner() {
  const session = await getActiveImpersonation()
  if (!session) return null

  const service = await createServiceClient()
  const { data: user } = await service
    .from('users')
    .select('email')
    .eq('id', session.target_user_id)
    .maybeSingle()

  return <ImpersonationBannerClient targetEmail={user?.email ?? session.target_user_id} />
}
```

- [ ] **Step 2: Create `components/admin/impersonation/ImpersonationBannerClient.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ImpersonationBannerClient({ targetEmail }: { targetEmail: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleStop() {
    setLoading(true)
    const res = await fetch('/api/admin/impersonation/stop', { method: 'POST' })
    if (res.ok) {
      const data = await res.json() as { redirect?: string }
      router.push(data.redirect ?? '/admin')
    } else {
      setLoading(false)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-amber-700 px-4 py-2 text-sm text-white">
      <span>Viendo el sistema como <strong>{targetEmail}</strong></span>
      <button
        onClick={handleStop}
        disabled={loading}
        className="rounded bg-amber-900 px-3 py-1 text-xs font-medium disabled:opacity-50"
      >
        {loading ? 'Saliendo...' : 'Volver a admin'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Update `app/(user)/layout.tsx`** — add `pt-10` to main when banner is present

The current UserLayout already renders `<ImpersonationBanner />` above `<main>`. To avoid the banner overlapping content, add top padding to `<main>` when impersonating. The simplest approach: always add `pt-10` to account for the banner height (it's 0 cost when banner is absent).

In `app/(user)/layout.tsx`, change `<main className="pb-20 mx-auto px-4 pt-4 max-w-lg">` to:

```typescript
<main className="pb-20 mx-auto px-4 pt-14 max-w-lg">{children}</main>
```

`pt-14` (56px) accommodates both the banner (when active) and normal top padding.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/admin/impersonation/ app/\(user\)/layout.tsx
git commit -m "feat: ImpersonationBanner — amber fixed bar with stop-impersonation action"
```

---

## Task 14: API Endpoint Migration

All operational endpoints switch to `requireOperationalContext()`. All admin endpoints switch to `requireAdminApi()`. This ensures impersonation uses `effectiveUserId` and admin endpoints are guarded consistently.

**Files:**
- Modify: `app/api/records/route.ts`
- Modify: `app/api/records/[id]/route.ts`
- Modify: `app/api/analyze/route.ts`
- Modify: `app/api/search/route.ts`
- Modify: `app/api/export/route.ts`
- Modify: `app/api/custom-fields/route.ts`
- Modify: `app/api/custom-fields/[id]/route.ts`
- Modify: `app/api/search/suggestions/route.ts`
- Modify: `app/api/invites/route.ts`
- Modify: `app/api/invites/list/route.ts`
- Modify: `lib/auth.ts` (remove old guards)

**Pattern for operational endpoints (GET and POST):**

Old pattern:
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
// queries use supabase (RLS scopes to user JWT)
```

New pattern:
```typescript
const ctx = await requireOperationalContext()
if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
const service = await createServiceClient()
// queries use service + .eq('user_id', ctx.effectiveUserId)
```

Old pattern (using `requireOperationalUser`):
```typescript
const auth = await requireOperationalUser()
if ('error' in auth) return NextResponse.json(...)
// uses auth.profile.id
```

New pattern:
```typescript
const ctx = await requireOperationalContext()
if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
// uses ctx.effectiveUserId instead of ctx.profile.id for data queries
// uses ctx.profile.id only for audit_log.user_id
```

- [ ] **Step 1: Update `app/api/records/route.ts`**

Replace the GET handler's auth block:

```typescript
import { requireOperationalContext } from '@/lib/auth/guards'
// remove: import { requireOperationalUser } from '@/lib/auth'

// GET handler — replace auth check:
export async function GET(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { searchParams } = new URL(req.url)
  const rawPage = parseInt(searchParams.get('page') ?? '1')
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const requestedPageSize = parseInt(searchParams.get('pageSize') ?? '20')
  const limit = [10, 20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20
  const includeImages = searchParams.get('includeImages') === '1'
  const offset = (page - 1) * limit

  const service = await createServiceClient()
  const { data, error } = await service
    .from('surgical_records')
    .select('*')
    .eq('user_id', ctx.effectiveUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // rest unchanged (sort, paginate, sign URLs)
```

Replace the POST handler's auth block:

```typescript
export async function POST(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  // ... body parsing unchanged ...

  const { data: record, error } = await insertSurgicalRecord(supabase, {
    user_id: ctx.effectiveUserId,   // was: auth.profile.id
    // rest unchanged
  })

  // audit_log uses ctx.profile.id (real admin or real user)
  await supabase.from('audit_log').insert({
    user_id: ctx.profile.id,
    // ...
  })
```

- [ ] **Step 2: Update `app/api/records/[id]/route.ts`**

Replace GET, PATCH, DELETE handlers. Auth pattern:

```typescript
import { requireOperationalContext } from '@/lib/auth/guards'

// GET
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('surgical_records')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', ctx.effectiveUserId)  // ensures ownership
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  // rest unchanged (image URL signing)
```

PATCH and DELETE: same pattern — use `ctx.effectiveUserId` for ownership checks, `ctx.profile.id` for audit_log.

- [ ] **Step 3: Update `app/api/search/route.ts`**

Replace the auth block:

```typescript
import { requireOperationalContext } from '@/lib/auth/guards'

export async function GET(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('surgical_records')
    .select('*')
    .eq('user_id', ctx.effectiveUserId)
  // rest of filtering logic unchanged
```

- [ ] **Step 4: Update `app/api/export/route.ts`**

Replace:
```typescript
const profile = await getCurrentUserProfile()
if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const supabase = await createClient()
```

With:
```typescript
import { requireOperationalContext } from '@/lib/auth/guards'

const ctx = await requireOperationalContext()
if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
const service = await createServiceClient()
```

Then use `service` + `.eq('user_id', ctx.effectiveUserId)` in the records query.

- [ ] **Step 5: Update `app/api/custom-fields/route.ts`**

```typescript
import { requireOperationalContext } from '@/lib/auth/guards'

export async function GET() {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('custom_field_templates')
    .select('*')
    .eq('user_id', ctx.effectiveUserId)
    .order('display_order')
  // rest unchanged
```

POST handler: use `ctx.effectiveUserId` as `user_id` on insert.

- [ ] **Step 6: Update `app/api/custom-fields/[id]/route.ts`**

Same pattern: `requireOperationalContext()`, use `ctx.effectiveUserId` to scope the DELETE ownership check.

- [ ] **Step 7: Update `app/api/search/suggestions/route.ts`**

```typescript
import { requireOperationalContext } from '@/lib/auth/guards'

export async function GET(req: NextRequest) {
  // ... field/q validation unchanged ...

  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const { data } = await service
    .from('surgical_records')
    .select(`final_data`)
    .eq('user_id', ctx.effectiveUserId)
  // rest unchanged
```

- [ ] **Step 12: Update `app/api/invites/route.ts`**

Replace inline `getCurrentUserProfile()` check with:
```typescript
import { requireAdminApi } from '@/lib/auth/guards'

export async function POST(req: Request) {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  // rest unchanged, use auth.profile.id where needed
```

- [ ] **Step 9: Update `app/api/analyze/route.ts`**

Replace auth guard at the top of the handler:

```typescript
import { requireOperationalContext } from '@/lib/auth/guards'

// Replace: const auth = await requireOperationalUser()
const ctx = await requireOperationalContext()
if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

// Replace all: auth.profile.id  →  ctx.effectiveUserId  (for record ownership)
// Replace audit_log insert: user_id: ctx.profile.id  (real user always)
```

- [ ] **Step 10: Update `app/api/records/[id]/reanalyze/route.ts`**

Same pattern — read the file, replace `requireOperationalUser()` with `requireOperationalContext()`, use `ctx.effectiveUserId` for record ownership check, `ctx.profile.id` for audit.

- [ ] **Step 11: Update `app/api/invites/list/route.ts`**

Same: replace inline auth check with `requireAdminApi()`.

- [ ] **Step 13: Remove old guards from `lib/auth.ts`**

Remove `requireOperationalUser` and `requireAdminUser` exports. They are fully replaced by `lib/auth/guards.ts`.

- [ ] **Step 14: Type-check**

```bash
npx tsc --noEmit
```

Fix any type errors (likely related to `effectiveUserId` vs `profile.id` usage).

- [ ] **Step 15: Run build**

```bash
npm run build
```

Expected: successful build. Fix any remaining errors.

- [ ] **Step 16: Commit**

```bash
git add app/api/ lib/auth.ts
git commit -m "feat: migrate all API endpoints to centralized guards and effectiveUserId for impersonation"
```

---

## Task 15: Documentation

**Files:**
- Create: `docs/ARQUITECTURA_ADMIN_USER.md`

- [ ] **Step 1: Create `docs/ARQUITECTURA_ADMIN_USER.md`**

```markdown
# Arquitectura Admin/User

## Separación de entornos

El sistema tiene dos entornos completamente aislados mediante Next.js App Router route groups:

- `app/(user)/` — sistema de fichas médicas, solo para `role = 'user'`
- `app/(admin)/` — panel de administración, solo para `role = 'admin'`

Los route groups no afectan las URLs. Las rutas finales son:

**Usuario:** `/records`, `/records/[id]`, `/new`, `/search`, `/reports`, `/settings`

**Admin:** `/admin`, `/admin/users`, `/admin/users/[id]`, `/admin/users/[id]/records/[recordId]`

## Layouts

**UserLayout** (`app/(user)/layout.tsx`):
- Llama `requireUser()` — redirige a `/admin` si role=admin, a `/login` si no hay sesión
- Renderiza `BottomNav` (solo usuario)
- Renderiza `ImpersonationBanner` cuando hay impersonación activa

**AdminLayout** (`app/(admin)/layout.tsx`):
- Llama `requireAdmin()` — redirige a `/records` si role=user, a `/login` si no hay sesión
- Redirige a `/records` si hay sesión de impersonación activa (admin está en modo usuario)
- Renderiza `AdminNav`

## Guards centralizados (`lib/auth/guards.ts`)

| Función | Uso | Comportamiento |
|---|---|---|
| `requireUser()` | SSR layouts/pages del entorno usuario | Redirige si no es user |
| `requireAdmin()` | SSR layouts/pages del entorno admin | Redirige si no es admin |
| `requireUserApi()` | API routes de usuario | Retorna error si no es user |
| `requireAdminApi()` | API routes de admin | Retorna error si no es admin |
| `requireOperationalContext()` | API routes operativos | Retorna `effectiveUserId` |

## Impersonación

### Flujo
1. Admin hace click en "Entrar como usuario" en `/admin/users` o `/admin/users/[id]`
2. Frontend llama `POST /api/admin/impersonation/start` con `{ target_user_id }`
3. El endpoint crea un registro en `impersonation_sessions`, setea cookie httpOnly `impersonation_session_id`, escribe en `audit_log`
4. Frontend redirige a `/records`
5. `UserLayout` detecta impersonación y renderiza `ImpersonationBanner`
6. Al hacer click en "Volver a admin", llama `POST /api/admin/impersonation/stop`
7. El endpoint limpia la cookie, setea `ended_at` en la sesión, escribe en `audit_log`, redirige a `/admin/users/[target_id]`

### Tabla `impersonation_sessions`
```sql
id uuid PRIMARY KEY
admin_id uuid REFERENCES users(id)
target_user_id uuid REFERENCES users(id)
started_at timestamptz DEFAULT now()
ended_at timestamptz  -- NULL = sesión activa
```
RLS: solo service role.

### Helpers (`lib/auth/impersonation.ts`)
- `getActiveImpersonation()` — lee cookie + consulta DB, retorna sesión o null
- `isImpersonating()` — boolean
- `getEffectiveUserProfile()` — perfil del usuario impersonado o perfil real
- `getRealUserProfile()` — siempre el usuario auth real

## `effectiveUserId`

`requireOperationalContext()` retorna `{ profile, effectiveUserId }`:
- Si admin con impersonación activa: `effectiveUserId = session.target_user_id`
- Si usuario normal: `effectiveUserId = profile.id`
- Si admin sin impersonación: error 403

Todos los endpoints operativos (`/api/records`, `/api/search`, `/api/export`, etc.) usan `effectiveUserId` para filtrar datos.
`audit_log.user_id` siempre usa `profile.id` (el usuario real).

## Seguridad

- Admin no puede impersonar a otro admin (check en endpoint + constraint en DB)
- Todas las acciones de impersonación se registran en `audit_log`
- La cookie de impersonación es httpOnly, secure en producción, sameSite=lax, TTL 8 horas
- `GET /api/me` y `PATCH /api/settings` siempre operan sobre el usuario real (no efectivo)

## Checklist de pruebas

### Admin
- [ ] Login admin → `/admin`
- [ ] Admin no puede abrir `/records` (redirige a `/admin`)
- [ ] Admin no puede abrir `/new` (redirige a `/admin`)
- [ ] Admin puede abrir `/admin/users`
- [ ] Admin puede crear usuario manual
- [ ] Admin puede invitar usuario
- [ ] Admin puede ver detalle usuario en `/admin/users/[id]`
- [ ] Admin puede iniciar impersonación → redirige a `/records`
- [ ] ImpersonationBanner visible con email del usuario impersonado
- [ ] "Volver a admin" detiene impersonación y redirige a `/admin/users/[id]`

### Usuario
- [ ] Login user → `/records`
- [ ] User no puede abrir `/admin` (redirige a `/records`)
- [ ] User no puede abrir `/admin/users` (redirige a `/records`)
- [ ] User puede crear registros
- [ ] User puede editar sus registros
- [ ] User no ve ningún componente de administración

### APIs
- [ ] User no puede llamar `POST /api/admin/impersonation/start` (403)
- [ ] Admin sin impersonación recibe 403 en `GET /api/records`
- [ ] Admin impersonando recibe registros del usuario impersonado
- [ ] `GET /api/me` retorna perfil real (no efectivo) durante impersonación
- [ ] `POST /api/admin/impersonation/stop` limpia cookie y registra en audit_log
```

- [ ] **Step 2: Commit**

```bash
git add docs/ARQUITECTURA_ADMIN_USER.md
git commit -m "docs: add ARQUITECTURA_ADMIN_USER.md"
```

---

## Final Verification

- [ ] **Run full build**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Manual smoke test**

1. Log in as admin → lands on `/admin`
2. Navigate to `/records` → redirects to `/admin`
3. Open `/admin/users` → table with users and record counts
4. Click "Entrar como usuario" on a user → ImpersonationBanner visible at `/records`
5. Click "Volver a admin" → returns to `/admin/users/[id]`
6. Log in as user → lands on `/records`
7. Navigate to `/admin` → redirects to `/records`

- [ ] **Commit final state**

```bash
git add -A
git commit -m "feat: complete admin/user environment separation"
```

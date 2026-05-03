# Admin/User Separation — Design Spec

**Date:** 2026-05-03
**Status:** Approved
**Branch:** feat/modernization-phase1

## Overview

Refactor the admin/user architecture to create two completely isolated environments:

1. **User environment** — medical records system (`/records`, `/new`, `/search`, `/reports`, `/settings`)
2. **Admin environment** — administration panel (`/admin`, `/admin/users`, `/admin/users/[id]`)

Admin sees nothing from the user flow unless explicitly impersonating a user.

---

## Section 1 — Routing & File Structure

Use Next.js App Router route groups for compile-time isolation. URLs are unchanged.

```
app/
  (auth)/                             # unchanged
    login/
    accept-invite/[token]/
  (user)/                             # renamed from (app), minus admin/ subtree
    layout.tsx                        # UserLayout — enforces role=user
    records/
    records/[id]/
    new/
    search/
    reports/
    settings/
    settings/users/                   # redirects to /admin/users (admin only)
    error.tsx
    loading.tsx
  (admin)/                            # new group, extracted from (app)/admin/
    layout.tsx                        # AdminLayout — enforces role=admin
    admin/
      page.tsx                        # dashboard (new)
      users/
        page.tsx
        [id]/
          page.tsx
          records/[recordId]/
            page.tsx
  page.tsx                            # root redirect by role
  layout.tsx                          # global root — unchanged
```

**Files moving:**
- `app/(app)/admin/users/...` → `app/(admin)/admin/users/...`
- `app/(app)/layout.tsx` → `app/(user)/layout.tsx` (content changes)
- New: `app/(admin)/layout.tsx`
- New: `app/(admin)/admin/page.tsx`

**URLs preserved — all existing links remain valid.**

---

## Section 2 — Layouts

### UserLayout (`app/(user)/layout.tsx`)
- Calls `requireUser()` — redirects to `/admin` if role=admin, `/login` if unauthenticated
- Renders `BottomNav` (user-only, simplified)
- `max-w-lg` container
- Renders `ImpersonationBanner` when impersonation is active

### AdminLayout (`app/(admin)/layout.tsx`)
- Calls `requireAdmin()` — redirects to `/records` if role=user, `/login` if unauthenticated
- Renders `AdminNav` (new component)
- `max-w-6xl` container
- If admin has active impersonation session and visits `/admin/*`, shows warning or stops session
- Zero imports from `components/records/` or `components/capture/`

### AdminNav (`components/admin/layout/AdminNav.tsx`)
- New component, completely separate from `BottomNav`
- Items: Dashboard (`/admin`), Usuarios (`/admin/users`), Cuenta (`/settings`)
- Same visual shell (fixed bottom, `bg-slate-900`, border-t)

### BottomNav (`components/ui/BottomNav.tsx`)
- Remove `role` prop and `ADMIN_NAV_ITEMS`
- User-only from now on

---

## Section 3 — Auth Guards

New file: `lib/auth/guards.ts`

```typescript
// SSR pages/layouts — throws redirect, never returns error object
export async function requireUser(): Promise<UserProfile>
// → no session: redirect('/login')
// → role=admin: redirect('/admin')

export async function requireAdmin(): Promise<UserProfile>
// → no session: redirect('/login')
// → role=user: redirect('/records')

// API routes — returns error object, never redirects
export async function requireUserApi(): Promise<{ profile } | { error, status }>
export async function requireAdminApi(): Promise<{ profile } | { error, status }>

// Impersonation-aware — used by all operational endpoints
export async function requireOperationalContext(): Promise<{ profile, effectiveUserId }>
// → returns real admin profile + impersonated userId if active impersonation
// → returns real user profile + own userId otherwise
// → 403 if admin with no active impersonation
```

Existing `requireOperationalUser()` and `requireAdminUser()` in `lib/auth.ts` are replaced. `getHomePathForRole()` updated: admin home is `/admin` (not `/admin/users`).

---

## Section 4 — Root Redirect + Middleware

**`app/page.tsx`:**
```typescript
const profile = await getCurrentUserProfile()
if (!profile) redirect('/login')
if (profile.role === 'admin') redirect('/admin')
redirect('/records')
```

**`middleware.ts`:** minimal change — keeps session auth check, does not enforce roles. Role enforcement is structural (layout groups) + SSR guards.

**`accept-invite`:** no change needed — uses `getHomePathForRole()` which returns `/admin` for admins after update.

---

## Section 5 — Admin Dashboard (`/admin`)

New page: `app/(admin)/admin/page.tsx`
New component: `components/admin/dashboard/AdminDashboard.tsx`

**Metrics (from existing tables, service role, SSR):**
- Total usuarios
- Usuarios activos (non-admin users; note if `active` field absent)
- Usuarios admin
- Invitaciones pendientes (status=pending, not expired)

**Does NOT show:** clinical metrics, records count for logged-in admin, any user-flow UI.

No new API endpoint — metrics fetched server-side directly.

---

## Section 6 — ABM de Usuarios (`/admin/users`)

`components/settings/UsersAdminPanel.tsx` → `components/admin/users/UsersPanel.tsx` (refactored).

**List columns:** email, rol, estado, fecha de alta, cantidad de registros, acciones.

**Row actions:** Ver detalle, Editar, Entrar como usuario (impersonation).

**Panel operations:** Crear usuario manual, Invitar usuario, Ver invitaciones pendientes.

**`SettingsPageClient`:** remove admin users panel section — settings is personal account only.

**API changes:**
- `GET /api/users` — add record count per user (join on `surgical_records`)
- `PATCH /api/users/[id]` — new endpoint (rol, estado)
- `DELETE /api/users/[id]` — soft delete (mark inactive); if schema lacks field, document as pending

---

## Section 7 — Admin User Detail (`/admin/users/[id]`)

Refactor `components/admin/AdminUserDetailPage.tsx`.

**Shows:**
- Header: email, rol, estado, fecha de alta
- Stat row: total registros, drafts, finals
- Table: "Registros del usuario supervisado" — last 10 records (fecha, cirujano, sanatorio, estado, link)
- Actions: Editar usuario, Entrar como usuario, Desactivar/Activar

**Does NOT show:**
- "Registros", "Borradores", "Finales" cards from user flow
- "Este usuario todavía no tiene registros" message
- Editable `RecordForm`

Data fetched SSR via service role. Reuses query patterns from `lib/records-db.ts`.

---

## Section 8 — Impersonation

### DB Migration (`supabase/migrations/004_impersonation.sql`)
```sql
create table impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references users(id),
  target_user_id uuid not null references users(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint no_self_impersonation check (admin_id != target_user_id)
);
-- RLS: service role only
```

### API Endpoints
- `POST /api/admin/impersonation/start` — validates `requireAdminApi()`, target must be role=user, inserts session row, sets httpOnly cookie `impersonation_session_id`, writes `impersonation_started` to `audit_log`, redirects to `/records`
- `POST /api/admin/impersonation/stop` — clears cookie, sets `ended_at`, writes `impersonation_ended` to `audit_log`, redirects to `/admin/users/[target_id]`
- `GET /api/admin/impersonation/status` — returns active session if cookie present and session open

### Helpers (`lib/auth/impersonation.ts`)
```typescript
getEffectiveUserProfile()     // impersonated user if active, else real user
getRealUserProfile()          // always auth user
isImpersonating()             // boolean
```

### ImpersonationBanner (`components/admin/impersonation/ImpersonationBanner.tsx`)
- Client component rendered in `(user)/layout.tsx` when impersonation cookie present
- Shows: "Estás viendo el sistema como [email]" + "Volver a admin" button
- "Volver a admin" calls `POST /api/admin/impersonation/stop`
- Fixed top bar, amber/warning color

### Security Rules
- Admin cannot impersonate another admin (endpoint check + DB constraint)
- All operational API calls during impersonation use `effectiveUserId`
- AdminLayout checks for active session — shows warning if admin visits `/admin/*` while impersonating

---

## Section 9 — API Endpoint Updates

All endpoints migrate to guards in `lib/auth/guards.ts`.

**Impersonation-aware (use `requireOperationalContext()`, filter by `effectiveUserId`):**
- `GET/POST /api/records`
- `GET/PATCH/DELETE /api/records/[id]`
- `POST /api/analyze`
- `GET /api/search`
- `GET /api/export`
- `GET/POST /api/custom-fields`
- `DELETE /api/custom-fields/[id]`
- `GET /api/search/suggestions`

**Admin-only (use `requireAdminApi()`, no impersonation context):**
- `GET/POST /api/users`
- `PATCH /api/users/[id]` (new)
- `POST /api/invites`
- `GET /api/invites/list`
- `POST/GET /api/admin/impersonation/*`

**Special cases:**
- `GET /api/me` — always returns real profile, never effective
- `PATCH /api/settings` — always operates on real user

**Key invariant:** admin with no active impersonation hitting `/api/records` or `/api/analyze` → 403.

---

## Section 10 — Component Reorganization

**Moves:**
- `components/settings/UsersAdminPanel.tsx` → `components/admin/users/UsersPanel.tsx`

**New:**
- `components/admin/layout/AdminNav.tsx`
- `components/admin/dashboard/AdminDashboard.tsx`
- `components/admin/impersonation/ImpersonationBanner.tsx`

**In-place refactors:**
- `components/admin/AdminUserDetailPage.tsx` — strip user-dashboard UI
- `components/admin/AdminRecordDetailPage.tsx` — verify read-only, no editable RecordForm
- `components/ui/BottomNav.tsx` — remove role prop, user-only
- `components/settings/SettingsPageClient.tsx` — remove admin users section

**No moves needed:**
- `components/records/*` — user-only, stays
- `components/capture/*` — user-only, stays

**Rule:** `app/(admin)/layout.tsx` imports only from `components/admin/` and shared `components/ui/` primitives. Never from `components/records/` or `components/capture/`.

---

## Verification Checklist

### Admin flows
- [ ] Login admin → `/admin`
- [ ] Admin cannot open `/records`
- [ ] Admin cannot open `/new`
- [ ] Admin can open `/admin/users`
- [ ] Admin can create/invite user
- [ ] Admin can view user detail
- [ ] Admin can impersonate user → redirected to `/records`
- [ ] ImpersonationBanner visible during impersonation
- [ ] "Volver a admin" stops impersonation, returns to `/admin/users/[id]`

### User flows
- [ ] Login user → `/records`
- [ ] User cannot open `/admin`
- [ ] User cannot open `/admin/users`
- [ ] User can create records
- [ ] User can edit own records
- [ ] User cannot see other users

### API
- [ ] User cannot call admin endpoints
- [ ] Admin outside impersonation gets 403 on `/api/records`, `/api/analyze`
- [ ] Impersonation uses `effectiveUserId` correctly in all operational endpoints
- [ ] `GET /api/me` always returns real profile

---

## Open Items

- `PATCH /api/users/[id]` — new endpoint, needs schema check for `active`/status field on `users` table
- Soft delete strategy — pending schema verification; if `active` field absent, document in migration
- `AdminRecordDetailPage` — verify no editable `RecordForm` path exists before closing Section 10

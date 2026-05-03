# Admin Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a separate read-only supervision workspace centered on users and their records instead of the normal clinical flow.

**Architecture:** Keep clinical APIs blocked for admins, but add admin-only server-rendered routes backed by the service role and swap admin navigation away from clinical pages. Reuse existing record rendering where practical, but expose it in read-only form under `admin/*`.

**Tech Stack:** Next.js App Router, TypeScript, Supabase, Vitest

---

### Task 1: Add admin routing and role helpers

**Files:**
- Modify: `lib/auth.ts`
- Modify: `app/page.tsx`
- Modify: `app/(app)/layout.tsx`
- Modify: `components/ui/BottomNav.tsx`

- [ ] Add helpers for admin-only access and role-based home redirection.
- [ ] Make `/` route send admins to `/admin/users` and users to `/records`.
- [ ] Change bottom nav so admins only see admin-oriented entries.

### Task 2: Redirect admins away from clinical workspace pages

**Files:**
- Modify: `app/(app)/new/page.tsx`
- Modify: `app/(app)/records/page.tsx`
- Modify: `app/(app)/records/[id]/page.tsx`
- Modify: `app/(app)/search/page.tsx`
- Modify: `app/(app)/reports/page.tsx`
- Modify: `app/(app)/settings/page.tsx`
- Modify: `app/(app)/settings/users/page.tsx`

- [ ] For admin sessions, redirect clinical pages to `/admin/users`.
- [ ] Keep `/settings` available, but in admin mode show account/admin controls instead of clinical settings.
- [ ] Redirect legacy `/settings/users` to `/admin/users`.

### Task 3: Build admin users index page

**Files:**
- Create: `app/(app)/admin/users/page.tsx`
- Create: `components/admin/AdminUsersPage.tsx`

- [ ] Query all users and all records server-side with service role.
- [ ] Compute per-user record counts.
- [ ] Render user cards with links to user detail.
- [ ] Move existing create-user/invite tools into this admin page.

### Task 4: Build admin user detail page

**Files:**
- Create: `app/(app)/admin/users/[id]/page.tsx`
- Create: `components/admin/AdminUserDetailPage.tsx`

- [ ] Load selected user server-side.
- [ ] Load that user’s records and sort by date.
- [ ] Render a supervision view with summary + record list.

### Task 5: Build admin read-only record detail page

**Files:**
- Create: `app/(app)/admin/users/[id]/records/[recordId]/page.tsx`
- Create: `components/admin/AdminRecordDetailPage.tsx`
- Modify: `components/records/RecordForm.tsx` if needed for read-only rendering only

- [ ] Load target record with signed image URLs via service role.
- [ ] Render the data and images in read-only mode.
- [ ] Ensure no save/delete/reanalyze actions are exposed.

### Task 6: Verify and commit admin workspace

**Files:**
- Include only admin-workspace files plus shared helpers/UI touched by this spec.

- [ ] Run: `npm test`
- [ ] Run: `npx tsc --noEmit`
- [ ] Run: `npm run build`
- [ ] Stage and commit admin workspace changes.

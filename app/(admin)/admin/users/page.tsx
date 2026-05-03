import { requireAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import UsersPanel from '@/components/admin/users/UsersPanel'

export default async function AdminUsersPage() {
  await requireAdmin()

  const service = await createServiceClient()
  const [usersResult, countsResult, invitesResult] = await Promise.all([
    service.from('users').select('id, email, role, is_active, created_at').order('created_at'),
    service.from('surgical_records').select('user_id'),
    service.from('invitations').select('id, email, accepted_at, created_at, expires_at').order('created_at', { ascending: false }),
  ])

  const countMap = new Map<string, number>()
  for (const row of countsResult.data ?? []) {
    countMap.set(row.user_id, (countMap.get(row.user_id) ?? 0) + 1)
  }

  const users = (usersResult.data ?? []).map(user => ({
    ...user,
    record_count: countMap.get(user.id) ?? 0,
  }))

  return <UsersPanel users={users} invitations={invitesResult.data ?? []} />
}

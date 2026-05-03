import { redirect } from 'next/navigation'
import UsersAdminPanel from '@/components/settings/UsersAdminPanel'
import { getCurrentUserProfile } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export default async function AdminUsersPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) {
    redirect('/login')
  }
  if (profile.role !== 'admin') {
    redirect('/records')
  }

  const service = await createServiceClient()
  const [{ data: users }, { data: invites }, { data: records }] = await Promise.all([
    service
      .from('users')
      .select('id, email, role, preferred_model, created_at')
      .order('created_at'),
    service
      .from('invitations')
      .select('id, email, token, invited_by, accepted_at, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    service
      .from('surgical_records')
      .select('id, user_id'),
  ])

  const recordCountByUser = new Map<string, number>()
  for (const record of records ?? []) {
    recordCountByUser.set(record.user_id, (recordCountByUser.get(record.user_id) ?? 0) + 1)
  }

  const usersWithCounts = (users ?? []).map(user => ({
    ...user,
    record_count: recordCountByUser.get(user.id) ?? 0,
  }))

  return <UsersAdminPanel initialUsers={usersWithCounts} initialInvites={invites ?? []} />
}

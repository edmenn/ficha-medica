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
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString()),
  ])

  const users = usersResult.data ?? []
  const stats = {
    totalUsers: users.length,
    userCount: users.filter(user => user.role === 'user').length,
    adminCount: users.filter(user => user.role === 'admin').length,
    pendingInvitations: invitesResult.data?.length ?? 0,
  }

  return <AdminDashboard stats={stats} />
}

import { redirect } from 'next/navigation'
import UsersAdminPanel from '@/components/settings/UsersAdminPanel'
import { getCurrentUserProfile } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export default async function UsersPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) {
    redirect('/login')
  }

  if (profile?.role !== 'admin') {
    redirect('/settings')
  }

  const service = await createServiceClient()
  const [{ data: users }, { data: invites }] = await Promise.all([
    service
      .from('users')
      .select('id, email, role, preferred_model, created_at')
      .order('created_at'),
    service
      .from('invitations')
      .select('id, email, token, invited_by, accepted_at, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return <UsersAdminPanel initialUsers={users ?? []} initialInvites={invites ?? []} />
}

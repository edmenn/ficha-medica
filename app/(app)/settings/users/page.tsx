import { redirect } from 'next/navigation'
import UsersAdminPanel from '@/components/settings/UsersAdminPanel'
import { getCurrentUserProfile } from '@/lib/auth'

export default async function UsersPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) {
    redirect('/login')
  }

  if (profile?.role !== 'admin') {
    redirect('/settings')
  }

  return <UsersAdminPanel />
}

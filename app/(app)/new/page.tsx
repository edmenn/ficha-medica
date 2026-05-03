import { redirect } from 'next/navigation'
import NewRecordClient from '@/components/records/NewRecordClient'
import { getCurrentUserProfile } from '@/lib/auth'

export default async function NewRecordPage() {
  const profile = await getCurrentUserProfile()
  if (profile?.role === 'admin') {
    redirect('/admin/users')
  }

  return <NewRecordClient blockedForRole={false} />
}

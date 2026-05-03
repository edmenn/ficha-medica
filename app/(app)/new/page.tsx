import NewRecordClient from '@/components/records/NewRecordClient'
import { getCurrentUserProfile } from '@/lib/auth'

export default async function NewRecordPage() {
  const profile = await getCurrentUserProfile()
  const blockedForRole = profile?.role === 'admin'

  return <NewRecordClient blockedForRole={blockedForRole} />
}

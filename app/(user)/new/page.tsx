import NewRecordClient from '@/components/records/NewRecordClient'
import { requireOperationalContext } from '@/lib/auth/guards'

export default async function NewRecordPage() {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return <NewRecordClient blockedForRole />

  return <NewRecordClient blockedForRole={false} />
}

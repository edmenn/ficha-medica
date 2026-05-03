import { notFound } from 'next/navigation'
import AdminUserDetailPage from '@/components/admin/AdminUserDetailPage'
import { requireAdmin } from '@/lib/auth/guards'
import { compareDateStringsDesc } from '@/lib/record-utils'
import { createServiceClient } from '@/lib/supabase/server'
import type { SurgicalRecord } from '@/types'

export default async function AdminUserPage({ params }: { params: { id: string } }) {
  await requireAdmin()

  const service = await createServiceClient()
  const [{ data: user }, { data: records }] = await Promise.all([
    service
      .from('users')
      .select('id, email, role, created_at')
      .eq('id', params.id)
      .maybeSingle(),
    service
      .from('surgical_records')
      .select('*')
      .eq('user_id', params.id),
  ])

  if (!user) {
    notFound()
  }

  const sortedRecords = ((records ?? []) as SurgicalRecord[]).sort((left, right) => {
    const byDate = compareDateStringsDesc(left.final_data.fecha_cirugia, right.final_data.fecha_cirugia)
    if (byDate !== 0) return byDate
    return right.created_at.localeCompare(left.created_at)
  })

  return <AdminUserDetailPage user={user} records={sortedRecords} />
}

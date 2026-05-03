import { notFound, redirect } from 'next/navigation'
import AdminRecordDetailPage from '@/components/admin/AdminRecordDetailPage'
import { getCurrentUserProfile } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import type { SurgicalRecord } from '@/types'

function getImagePaths(record: { image_paths?: string[] | null; image_path?: string | null }) {
  if (record.image_paths && record.image_paths.length > 0) return record.image_paths
  if (record.image_path) return [record.image_path]
  return []
}

export default async function AdminRecordPage({
  params,
}: {
  params: { id: string; recordId: string }
}) {
  const profile = await getCurrentUserProfile()
  if (!profile) {
    redirect('/login')
  }
  if (profile.role !== 'admin') {
    redirect('/records')
  }

  const service = await createServiceClient()
  const [{ data: record }, { data: customFields }] = await Promise.all([
    service
      .from('surgical_records')
      .select('*')
      .eq('id', params.recordId)
      .eq('user_id', params.id)
      .maybeSingle(),
    service
      .from('custom_field_templates')
      .select('*')
      .eq('user_id', params.id)
      .order('display_order'),
  ])

  if (!record) {
    notFound()
  }

  const imagePaths = getImagePaths(record)
  let imageUrls: string[] = []
  if (imagePaths.length > 0 && imagePaths[0] !== 'manual-entry') {
    imageUrls = (await Promise.all(imagePaths.map(async imagePath => {
      const { data: signed } = await service.storage
        .from('surgical-images')
        .createSignedUrl(imagePath, 3600)
      return signed?.signedUrl ?? null
    }))).filter((value): value is string => Boolean(value))
  }

  return (
    <AdminRecordDetailPage
      userId={params.id}
      record={{
        ...(record as SurgicalRecord),
        image_url: imageUrls[0] ?? null,
        image_urls: imageUrls,
      }}
      customFields={customFields ?? []}
    />
  )
}

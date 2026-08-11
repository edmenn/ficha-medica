import { notFound } from 'next/navigation'
import RecordDetailClient from '@/components/records/RecordDetailClient'
import { requireOperationalContext } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import { isValidImagePath } from '@/lib/storage-paths'
import type { SurgicalRecord } from '@/types'

function getImagePaths(record: { image_paths?: string[] | null; image_path?: string | null }) {
  if (record.image_paths && record.image_paths.length > 0) return record.image_paths
  if (record.image_path) return [record.image_path]
  return []
}

export default async function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOperationalContext()
  if ('error' in ctx) notFound()

  const service = await createServiceClient()
  const [{ data: record }, { data: customFields }] = await Promise.all([
    service.from('surgical_records').select('*').eq('id', id).eq('user_id', ctx.effectiveUserId).single(),
    service.from('custom_field_templates').select('*').eq('user_id', ctx.effectiveUserId).order('display_order'),
  ])

  if (!record) {
    notFound()
  }

  const imagePaths = getImagePaths(record).filter(path => isValidImagePath(path, ctx.effectiveUserId))
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
    <RecordDetailClient
      record={{
        ...(record as SurgicalRecord),
        image_url: imageUrls[0] ?? null,
        image_urls: imageUrls,
      }}
      customFields={customFields ?? []}
    />
  )
}

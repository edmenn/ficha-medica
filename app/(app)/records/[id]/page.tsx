import { notFound } from 'next/navigation'
import RecordDetailClient from '@/components/records/RecordDetailClient'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { SurgicalRecord } from '@/types'

function getImagePaths(record: { image_paths?: string[] | null; image_path?: string | null }) {
  if (record.image_paths && record.image_paths.length > 0) return record.image_paths
  if (record.image_path) return [record.image_path]
  return []
}

export default async function RecordDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const [{ data: record }, { data: customFields }] = await Promise.all([
    supabase.from('surgical_records').select('*').eq('id', params.id).single(),
    supabase.from('custom_field_templates').select('*').order('display_order'),
  ])

  if (!record) {
    notFound()
  }

  const imagePaths = getImagePaths(record)
  let imageUrls: string[] = []
  if (imagePaths.length > 0 && imagePaths[0] !== 'manual-entry') {
    const service = await createServiceClient()
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

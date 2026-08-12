import { notFound } from 'next/navigation'
import RecordDetailClient from '@/components/records/RecordDetailClient'
import { requireOperationalContext } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import { isValidImagePath } from '@/lib/storage-paths'
import type { AiUsageSummary, SurgicalRecord } from '@/types'

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
  const { data: record } = await service
    .from('surgical_records').select('*').eq('id', id).eq('user_id', ctx.effectiveUserId).single()

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

  // Uso de IA acumulado por registro (solo informativo; no va a reportes/exportaciones).
  const { data: usageRows } = await service
    .from('ai_usage')
    .select('cost_usd, total_tokens, created_at')
    .eq('record_id', id)
    .eq('user_id', ctx.effectiveUserId)

  let usage: AiUsageSummary = { total_cost_usd: null, total_requests: 0, total_tokens: null, last_cost_usd: null, last_at: null }
  if (usageRows && usageRows.length > 0) {
    const totalCost = usageRows.reduce((acc, row) => acc + (Number(row.cost_usd) || 0), 0)
    const last = usageRows[usageRows.length - 1]
    usage = {
      total_cost_usd: totalCost,
      total_requests: usageRows.length,
      total_tokens: usageRows.reduce((acc, row) => acc + (Number(row.total_tokens) || 0), 0) || null,
      last_cost_usd: last && Number(last.cost_usd) || null,
      last_at: last?.created_at ?? null,
    }
  }

  return (
    <RecordDetailClient
      record={{
        ...(record as SurgicalRecord),
        image_url: imageUrls[0] ?? null,
        image_urls: imageUrls,
      }}
      aiUsage={usage}
    />
  )
}

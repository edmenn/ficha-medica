import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { insertSurgicalRecord } from '@/lib/records-db'
import { compareDateStringsDesc, normalizeSurgicalFields, validateSurgicalFields } from '@/lib/record-utils'
import { createServiceClient } from '@/lib/supabase/server'
import type { RecordStatus, SurgicalFields } from '@/types'

function getPrimaryImagePath(record: { image_paths?: string[] | null; image_path?: string | null }) {
  return record.image_paths?.[0] ?? record.image_path ?? null
}

export async function GET(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { searchParams } = new URL(req.url)
  const rawPage = parseInt(searchParams.get('page') ?? '1')
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const requestedPageSize = parseInt(searchParams.get('pageSize') ?? '20')
  const limit = [10, 20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20
  const includeImages = searchParams.get('includeImages') === '1'
  const offset = (page - 1) * limit

  const service = await createServiceClient()
  const { data, error } = await service
    .from('surgical_records')
    .select('*')
    .eq('user_id', ctx.effectiveUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sortedData = (data ?? []).sort((left, right) => {
    const byDate = compareDateStringsDesc(left.final_data?.fecha_cirugia, right.final_data?.fecha_cirugia)
    if (byDate !== 0) return byDate
    return right.created_at.localeCompare(left.created_at)
  })
  const count = sortedData.length
  const pagedData = sortedData.slice(offset, offset + limit)

  if (!includeImages) {
    const records = pagedData.map(record => ({ ...record, image_url: null }))
    return NextResponse.json({ records, total: count, page, pageSize: limit })
  }

  const records = await Promise.all(pagedData.map(async record => {
    const imagePath = getPrimaryImagePath(record)
    if (!imagePath || imagePath === 'manual-entry') {
      return { ...record, image_url: null }
    }

    const { data: signed } = await service.storage
      .from('surgical-images')
      .createSignedUrl(imagePath, 3600)

    return { ...record, image_url: signed?.signedUrl ?? null }
  }))

  return NextResponse.json({ records, total: count, page, pageSize: limit })
}

export async function POST(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const body = await req.json() as {
    image_path?: string
    image_paths?: string[]
    extracted_data?: SurgicalFields
    final_data?: SurgicalFields
    status?: RecordStatus
  }

  const finalData = body.final_data ?? body.extracted_data
  if (!finalData) {
    return NextResponse.json({ error: 'final_data or extracted_data is required' }, { status: 400 })
  }

  const normalizedFinalData = normalizeSurgicalFields(finalData)
  const extractedData = normalizeSurgicalFields(body.extracted_data ?? normalizedFinalData)
  const validationErrors = validateSurgicalFields(normalizedFinalData)
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: validationErrors[0], errors: validationErrors }, { status: 400 })
  }

  const status = body.status ?? 'draft'
  const imagePaths = body.image_paths?.length
    ? body.image_paths
    : body.image_path
      ? [body.image_path]
      : ['manual-entry']

  const { data: record, error } = await insertSurgicalRecord(service, {
    user_id: ctx.effectiveUserId,
    image_path: imagePaths[0] ?? 'manual-entry',
    image_paths: imagePaths,
    ai_raw_response: null,
    extracted_data: extractedData,
    final_data: normalizedFinalData,
    status,
  })

  if (error || !record) {
    return NextResponse.json({ error: error?.message ?? 'Error al crear registro' }, { status: 500 })
  }

  const { error: auditError } = await service.from('audit_log').insert({
    user_id: ctx.profile.id,
    record_id: record.id,
    action: 'created',
    diff: normalizedFinalData,
  })
  if (auditError) console.error('[audit_log insert]', auditError.message)

  return NextResponse.json(record, { status: 201 })
}

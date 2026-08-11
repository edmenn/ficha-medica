import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { insertSurgicalRecord } from '@/lib/records-db'
import { normalizeSurgicalFields, validateSurgicalFields } from '@/lib/record-utils'
import { createServiceClient } from '@/lib/supabase/server'
import { isValidImagePath } from '@/lib/storage-paths'
import type { RecordStatus, SurgicalFields, SurgicalRecord } from '@/types'

function getPrimaryImagePath(record: { image_paths?: string[] | null; image_path?: string | null }, userId: string) {
  const paths = record.image_paths?.length ? record.image_paths : record.image_path ? [record.image_path] : []
  const valid = paths.filter(path => isValidImagePath(path, userId))
  return valid[0] ?? null
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

  // Count total (DB-side, real total).
  const { count, error: countError } = await service
    .from('surgical_records')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.effectiveUserId)

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })

  // Paginate + order in the DB by surgical_date (falls back to created_at).
  const { data, error } = await service
    .from('surgical_records')
    .select('*')
    .eq('user_id', ctx.effectiveUserId)
    .order('surgical_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const pagedData = (data ?? []) as SurgicalRecord[]

  if (!includeImages) {
    const records = pagedData.map(record => ({ ...record, image_url: null }))
    return NextResponse.json({ records, total: count ?? 0, page, pageSize: limit })
  }

  const records = await Promise.all(pagedData.map(async record => {
    const imagePath = getPrimaryImagePath(record, ctx.effectiveUserId)
    if (!imagePath || imagePath === 'manual-entry') {
      return { ...record, image_url: null }
    }

    const { data: signed } = await service.storage
      .from('surgical-images')
      .createSignedUrl(imagePath, 3600)

    return { ...record, image_url: signed?.signedUrl ?? null }
  }))

  return NextResponse.json({ records, total: count ?? 0, page, pageSize: limit })
}

export async function POST(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const body = await req.json() as {
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
  // Las rutas de Storage nunca se aceptan del cliente: una ficha manual siempre
  // usa "manual-entry". Las imágenes reales solo las persiste el servidor en /api/analyze.
  const imagePaths = ['manual-entry']

  const { data: record, error } = await insertSurgicalRecord(service, {
    user_id: ctx.effectiveUserId,
    image_path: imagePaths[0],
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
    effective_user_id: ctx.profile.id === ctx.effectiveUserId ? null : ctx.effectiveUserId,
    record_id: record.id,
    action: 'created',
    diff: normalizedFinalData,
  })
  if (auditError) console.error('[audit_log insert]', auditError.message)

  return NextResponse.json(record, { status: 201 })
}

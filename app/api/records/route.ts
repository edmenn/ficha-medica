import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalUser } from '@/lib/auth'
import { insertSurgicalRecord } from '@/lib/records-db'
import { normalizeSurgicalFields, validateSurgicalFields } from '@/lib/record-utils'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { RecordStatus, SurgicalFields } from '@/types'

function getPrimaryImagePath(record: { image_paths?: string[] | null; image_path?: string | null }) {
  return record.image_paths?.[0] ?? record.image_path ?? null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const rawPage = parseInt(searchParams.get('page') ?? '1')
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const requestedPageSize = parseInt(searchParams.get('pageSize') ?? '20')
  const limit = [10, 20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20
  const includeImages = searchParams.get('includeImages') === '1'
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('surgical_records')
    .select('*', { count: 'exact' })
    .order('final_data->>fecha_cirugia', { ascending: true })
    .order('final_data->>hora_inicio', { ascending: true })
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!includeImages) {
    const records = (data ?? []).map(record => ({ ...record, image_url: null }))
    return NextResponse.json({ records, total: count, page, pageSize: limit })
  }

  const service = await createServiceClient()
  const records = await Promise.all((data ?? []).map(async record => {
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
  const auth = await requireOperationalUser()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const supabase = await createClient()
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

  const { data: record, error } = await insertSurgicalRecord(supabase, {
    user_id: auth.profile.id,
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

  const { error: auditError } = await supabase.from('audit_log').insert({
    user_id: auth.profile.id,
    record_id: record.id,
    action: 'created',
    diff: normalizedFinalData,
  })
  if (auditError) console.error('[audit_log insert]', auditError.message)

  return NextResponse.json(record, { status: 201 })
}

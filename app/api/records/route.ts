import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizeSurgicalFields } from '@/lib/record-utils'
import type { RecordStatus, SurgicalFields } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('surgical_records')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const service = await createServiceClient()
  const records = await Promise.all((data ?? []).map(async record => {
    if (!record.image_path || record.image_path === 'manual-entry') {
      return { ...record, image_url: null }
    }

    const { data: signed } = await service.storage
      .from('surgical-images')
      .createSignedUrl(record.image_path, 3600)

    return { ...record, image_url: signed?.signedUrl ?? null }
  }))

  return NextResponse.json({ records, total: count, page })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    image_path?: string
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
  const status = body.status ?? 'draft'

  const { data: record, error } = await supabase
    .from('surgical_records')
    .insert({
      user_id: user.id,
      image_path: body.image_path ?? 'manual-entry',
      ai_raw_response: null,
      extracted_data: extractedData,
      final_data: normalizedFinalData,
      status,
    })
    .select()
    .single()

  if (error || !record) {
    return NextResponse.json({ error: error?.message ?? 'Error al crear registro' }, { status: 500 })
  }

  const recordFields = Object.entries(normalizedFinalData).map(([field_name, final_value]) => ({
    record_id: record.id,
    field_name,
    ai_value: extractedData[field_name] ?? null,
    final_value: final_value ?? null,
    confidence: extractedData[field_name] ? 1 : 0,
  }))

  if (recordFields.length > 0) {
    await supabase.from('record_fields').insert(recordFields)
  }

  await supabase.from('audit_log').insert({
    user_id: user.id,
    record_id: record.id,
    action: 'created',
    diff: normalizedFinalData,
  })

  return NextResponse.json(record, { status: 201 })
}

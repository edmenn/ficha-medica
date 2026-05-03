import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizeSurgicalFields } from '@/lib/record-utils'
import type { SurgicalFields, RecordStatus } from '@/types'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('surgical_records')
    .select('*, record_fields(*)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  if (!data.image_path || data.image_path === 'manual-entry') {
    return NextResponse.json({ ...data, image_url: null })
  }

  const service = await createServiceClient()
  const { data: signed } = await service.storage
    .from('surgical-images')
    .createSignedUrl(data.image_path, 3600)

  return NextResponse.json({ ...data, image_url: signed?.signedUrl ?? null })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { final_data?: SurgicalFields; status?: RecordStatus }
  const normalizedFinalData = body.final_data ? normalizeSurgicalFields(body.final_data) : undefined

  const { data: current } = await supabase
    .from('surgical_records')
    .select('final_data')
    .eq('id', params.id)
    .single()

  const { data, error } = await supabase
    .from('surgical_records')
    .update({ ...body, final_data: normalizedFinalData, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (normalizedFinalData) {
    const { data: existingFields } = await supabase
      .from('record_fields')
      .select('field_name')
      .eq('record_id', params.id)

    const existingNames = new Set((existingFields ?? []).map(field => field.field_name))
    const syncOperations = Object.entries(normalizedFinalData).map(([field_name, final_value]) => {
      if (existingNames.has(field_name)) {
        return supabase.from('record_fields')
          .update({ final_value: final_value ?? null })
          .eq('record_id', params.id)
          .eq('field_name', field_name)
      }

      return supabase.from('record_fields').insert({
        record_id: params.id,
        field_name,
        ai_value: null,
        final_value: final_value ?? null,
        confidence: final_value ? 1 : 0,
      })
    })
    await Promise.all(syncOperations)

    const diff: Partial<SurgicalFields> = {}
    if (current?.final_data) {
      for (const key of Object.keys(normalizedFinalData) as (keyof SurgicalFields)[]) {
        if (normalizedFinalData[key] !== (current.final_data as SurgicalFields)[key]) {
          diff[key] = normalizedFinalData[key]
        }
      }
    }
    if (Object.keys(diff).length > 0) {
      await supabase.from('audit_log').insert({
        user_id: user.id,
        record_id: params.id,
        action: 'edited',
        diff,
      })
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('surgical_records')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

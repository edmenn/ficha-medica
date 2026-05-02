import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { final_data?: SurgicalFields; status?: RecordStatus }

  const { data: current } = await supabase
    .from('surgical_records')
    .select('final_data')
    .eq('id', params.id)
    .single()

  const { data, error } = await supabase
    .from('surgical_records')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.final_data) {
    const updates = Object.entries(body.final_data).map(([field_name, final_value]) =>
      supabase.from('record_fields')
        .update({ final_value: final_value ?? null })
        .eq('record_id', params.id)
        .eq('field_name', field_name)
    )
    await Promise.all(updates)

    const diff: Partial<SurgicalFields> = {}
    if (current?.final_data) {
      for (const key of Object.keys(body.final_data) as (keyof SurgicalFields)[]) {
        if (body.final_data[key] !== (current.final_data as SurgicalFields)[key]) {
          diff[key] = body.final_data[key]
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

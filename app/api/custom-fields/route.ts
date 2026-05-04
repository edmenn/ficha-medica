import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import type { FieldType } from '@/types'

export async function GET() {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('custom_field_templates')
    .select('*')
    .eq('user_id', ctx.effectiveUserId)
    .order('display_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fields: data })
}

export async function POST(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const body = await req.json() as { field_name: string; field_type: FieldType; is_required?: boolean }
  if (!body.field_name?.trim()) return NextResponse.json({ error: 'field_name required' }, { status: 400 })

  const service = await createServiceClient()
  const { count } = await service
    .from('custom_field_templates')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ctx.effectiveUserId)

  const { data, error } = await service
    .from('custom_field_templates')
    .insert({
      user_id: ctx.effectiveUserId,
      field_name: body.field_name.trim(),
      field_type: body.field_type ?? 'text',
      is_required: body.is_required ?? false,
      display_order: (count ?? 0) + 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

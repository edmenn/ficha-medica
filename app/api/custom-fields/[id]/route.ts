import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import type { FieldType } from '@/types'

const VALID_FIELD_TYPES = new Set<FieldType>(['text', 'number', 'date', 'bool'])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const body = await req.json() as { field_type?: FieldType; is_required?: boolean; display_order?: number; field_name?: string }

  const updates: Record<string, unknown> = {}
  if (body.field_type !== undefined) {
    if (!VALID_FIELD_TYPES.has(body.field_type)) {
      return NextResponse.json({ error: 'Tipo de campo inválido' }, { status: 400 })
    }
    updates.field_type = body.field_type
  }
  if (body.is_required !== undefined) updates.is_required = Boolean(body.is_required)
  if (body.display_order !== undefined) updates.display_order = body.display_order

  const service = await createServiceClient()

  if (body.field_name !== undefined && body.field_name.trim()) {
    const name = body.field_name.trim()
    const standard = new Set([
      'paciente', 'fecha_cirugia', 'diagnostico', 'procedimiento', 'cirujano',
      'ayudantes', 'anestesiologo', 'instrumentador', 'sanatorio', 'observaciones',
    ])
    if (standard.has(name.toLowerCase())) {
      return NextResponse.json({ error: 'Ese nombre ya es un campo estándar' }, { status: 400 })
    }
    const { data: dup } = await service
      .from('custom_field_templates')
      .select('id')
      .eq('user_id', ctx.effectiveUserId)
      .ilike('field_name', name)
      .neq('id', id)
    if (dup && dup.length > 0) {
      return NextResponse.json({ error: 'Ya existe un campo con ese nombre' }, { status: 400 })
    }
    updates.field_name = name
  }

  const { data, error } = await service
    .from('custom_field_templates')
    .update(updates)
    .eq('id', id)
    .eq('user_id', ctx.effectiveUserId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const { error } = await service
    .from('custom_field_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.effectiveUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

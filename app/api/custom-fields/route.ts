import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import type { FieldType } from '@/types'

const VALID_FIELD_TYPES = new Set<FieldType>(['text', 'number', 'date', 'bool'])
const STANDARD_FIELDS = new Set([
  'paciente', 'fecha_cirugia', 'diagnostico', 'procedimiento', 'cirujano',
  'ayudantes', 'anestesiologo', 'instrumentador', 'sanatorio', 'observaciones',
])

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

  const body = await req.json() as { field_name: string; field_type?: FieldType; is_required?: boolean }
  const name = body.field_name?.trim()
  if (!name) return NextResponse.json({ error: 'field_name required' }, { status: 400 })
  if (name.length > 80) return NextResponse.json({ error: 'El nombre del campo no puede superar 80 caracteres' }, { status: 400 })
  if (STANDARD_FIELDS.has(name.toLowerCase())) {
    return NextResponse.json({ error: 'Ese nombre ya es un campo estándar' }, { status: 400 })
  }

  const fieldType = body.field_type ?? 'text'
  if (!VALID_FIELD_TYPES.has(fieldType)) {
    return NextResponse.json({ error: 'Tipo de campo inválido' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { data: existing, error: existingError } = await service
    .from('custom_field_templates')
    .select('field_name')
    .eq('user_id', ctx.effectiveUserId)
    .ilike('field_name', name)

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Ya existe un campo con ese nombre' }, { status: 400 })
  }

  const { count } = await service
    .from('custom_field_templates')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ctx.effectiveUserId)

  const { data, error } = await service
    .from('custom_field_templates')
    .insert({
      user_id: ctx.effectiveUserId,
      field_name: name,
      field_type: fieldType,
      is_required: Boolean(body.is_required),
      display_order: (count ?? 0) + 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

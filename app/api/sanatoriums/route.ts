import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('user_sanatoriums')
    .select('id, name')
    .eq('user_id', ctx.effectiveUserId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sanatoriums: data })
}

export async function POST(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const body = await req.json() as { name?: string }
  const name = body.name?.trim().toLocaleUpperCase('es')
  if (!name) return NextResponse.json({ error: 'Ingresá un nombre de sanatorio' }, { status: 400 })
  if (name.length > 120) return NextResponse.json({ error: 'El nombre no puede superar 120 caracteres' }, { status: 400 })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('user_sanatoriums')
    .insert({ user_id: ctx.effectiveUserId, name })
    .select('id, name')
    .single()

  if (error) {
    // unique(user_id, name)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ese sanatorio ya existe' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const service = await createServiceClient()
  const { error } = await service
    .from('user_sanatoriums')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.effectiveUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

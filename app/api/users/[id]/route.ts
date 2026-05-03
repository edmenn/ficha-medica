import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as { role?: 'admin' | 'user'; is_active?: boolean }
  const updates: Record<string, unknown> = {}

  if (body.role === 'admin' || body.role === 'user') updates.role = body.role
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data, error } = await service
    .from('users')
    .update(updates)
    .eq('id', params.id)
    .select('id, email, role, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const service = await createServiceClient()
  const { error } = await service
    .from('users')
    .update({ is_active: false })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

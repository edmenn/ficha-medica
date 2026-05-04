import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAdminApi } from '@/lib/auth/guards'
import { IMPERSONATION_COOKIE } from '@/lib/auth/impersonation'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json() as { target_user_id?: string }
  if (!body.target_user_id) {
    return NextResponse.json({ error: 'target_user_id is required' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: target, error: targetError } = await service
    .from('users')
    .select('id, role, email, is_active')
    .eq('id', body.target_user_id)
    .maybeSingle()

  if (targetError || !target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (target.role === 'admin') return NextResponse.json({ error: 'No se puede impersonar a un admin' }, { status: 403 })
  if (target.is_active === false) return NextResponse.json({ error: 'No se puede impersonar un usuario inactivo' }, { status: 403 })

  const { data: session, error: sessionError } = await service
    .from('impersonation_sessions')
    .insert({ admin_id: auth.profile.id, target_user_id: body.target_user_id })
    .select('id')
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'No se pudo crear la sesión de impersonación' }, { status: 500 })
  }

  await service.from('audit_log').insert({
    user_id: auth.profile.id,
    record_id: null,
    action: 'impersonation_started',
    diff: { target_user_id: body.target_user_id, target_email: target.email, session_id: session.id },
  })

  cookies().set(IMPERSONATION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })

  return NextResponse.json({ ok: true, session_id: session.id })
}

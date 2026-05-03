import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAdminApi } from '@/lib/auth/guards'
import { IMPERSONATION_COOKIE, getActiveImpersonation } from '@/lib/auth/impersonation'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const session = await getActiveImpersonation()
  cookies().delete(IMPERSONATION_COOKIE)

  if (session && session.admin_id === auth.profile.id) {
    const service = await createServiceClient()
    await service
      .from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', session.id)

    await service.from('audit_log').insert({
      user_id: auth.profile.id,
      record_id: null,
      action: 'impersonation_ended',
      diff: { target_user_id: session.target_user_id, session_id: session.id },
    })

    return NextResponse.json({ ok: true, redirect: `/admin/users/${session.target_user_id}` })
  }

  return NextResponse.json({ ok: true, redirect: '/admin' })
}

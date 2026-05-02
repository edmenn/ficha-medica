import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserProfile } from '@/lib/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET: validate token (used by accept-invite page)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('invitations')
    .select('email, expires_at, accepted_at')
    .eq('token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (data.accepted_at) return NextResponse.json({ error: 'Invitation already used' }, { status: 410 })
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ error: 'Invitation expired' }, { status: 410 })

  return NextResponse.json({ email: data.email })
}

// POST: either create invite (admin) or accept invite (public with token+password)
export async function POST(req: NextRequest) {
  const body = await req.json() as { email?: string; token?: string; password?: string }

  if (body.token && body.password) {
    // Accept invitation flow
    const service = await createServiceClient()
    const { data: invite } = await service
      .from('invitations')
      .select('*')
      .eq('token', body.token)
      .single()

    if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitación inválida o vencida' }, { status: 410 })
    }

    const { error: signupError } = await service.auth.admin.createUser({
      email: invite.email,
      password: body.password,
      email_confirm: true,
    })
    if (signupError) return NextResponse.json({ error: signupError.message }, { status: 400 })

    await service.from('invitations').update({ accepted_at: new Date().toISOString() }).eq('token', body.token)
    return NextResponse.json({ ok: true })
  }

  if (body.email) {
    // Create invitation flow — admin only
    const profile = await getCurrentUserProfile()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const supabase = await createClient()
    const { data: invite, error } = await supabase
      .from('invitations')
      .insert({ email: body.email, invited_by: profile.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const inviteUrl = new URL(`/accept-invite/${invite.token}`, req.nextUrl.origin).toString()
    return NextResponse.json({ token: invite.token, url: inviteUrl })
  }

  return NextResponse.json({ error: 'Bad request' }, { status: 400 })
}

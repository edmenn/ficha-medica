import { NextResponse } from 'next/server'
import { getCurrentUserProfile } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const profile = await getCurrentUserProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = await createServiceClient()
  const { data, error } = await service
    .from('users')
    .select('id, email, role, created_at')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

export async function POST(req: Request) {
  const profile = await getCurrentUserProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as { email?: string; password?: string; role?: 'admin' | 'user' }
  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()
  const role = body.role === 'admin' ? 'admin' : 'user'

  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: 'Email y contraseña válida son obligatorios' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? 'No se pudo crear el usuario' }, { status: 400 })
  }

  if (role === 'admin') {
    const { error: roleError } = await service
      .from('users')
      .update({ role })
      .eq('id', created.user.id)

    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    user: {
      id: created.user.id,
      email: created.user.email,
      role,
      created_at: created.user.created_at,
    },
  }, { status: 201 })
}

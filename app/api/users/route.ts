import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const service = await createServiceClient()
  const { data: users, error } = await service
    .from('users')
    .select('id, email, role, is_active, created_at')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: counts } = await service
    .from('surgical_records')
    .select('user_id')

  const countMap = new Map<string, number>()
  for (const row of counts ?? []) {
    countMap.set(row.user_id, (countMap.get(row.user_id) ?? 0) + 1)
  }

  const result = (users ?? []).map(user => ({
    ...user,
    record_count: countMap.get(user.id) ?? 0,
  }))

  return NextResponse.json({ users: result })
}

export async function POST(req: Request) {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

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

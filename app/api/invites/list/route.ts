import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await requireAdminApi()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('invitations')
    .select('id, email, accepted_at, expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invites: data })
}

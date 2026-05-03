import { NextResponse } from 'next/server'
import { getActiveImpersonation } from '@/lib/auth/impersonation'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const session = await getActiveImpersonation()
  if (!session) return NextResponse.json({ active: false })

  const service = await createServiceClient()
  const { data: user } = await service
    .from('users')
    .select('email')
    .eq('id', session.target_user_id)
    .maybeSingle()

  return NextResponse.json({
    active: true,
    target_user_id: session.target_user_id,
    target_email: user?.email ?? null,
    started_at: session.started_at,
  })
}

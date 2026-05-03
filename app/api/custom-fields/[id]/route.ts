import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const { error } = await service
    .from('custom_field_templates')
    .delete()
    .eq('id', params.id)
    .eq('user_id', ctx.effectiveUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

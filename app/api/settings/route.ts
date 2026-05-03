import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/crypto'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { openrouter_key?: string; preferred_model?: string }
  const update: Record<string, string> = {}

  if (body.openrouter_key?.trim()) {
    update.openrouter_key = encrypt(body.openrouter_key.trim())
  }
  if (body.preferred_model) {
    const MODEL_PATTERN = /^[a-z0-9\-]+\/[a-z0-9\-:.]+$/
    if (!MODEL_PATTERN.test(body.preferred_model)) {
      return NextResponse.json({ error: 'Modelo inválido' }, { status: 400 })
    }
    update.preferred_model = body.preferred_model
  }

  const { error } = await supabase.from('users').update(update).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

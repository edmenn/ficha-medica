import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'

const ALLOWED_FIELDS = ['cirujano', 'anestesiologo', 'sanatorio', 'procedimiento', 'instrumentador'] as const

export async function GET(req: NextRequest) {
  const field = req.nextUrl.searchParams.get('field')
  const q = req.nextUrl.searchParams.get('q') ?? ''

  if (!field || !ALLOWED_FIELDS.includes(field as typeof ALLOWED_FIELDS[number])) {
    return NextResponse.json({ suggestions: [] })
  }

  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('surgical_records')
    .select('final_data')
    .eq('user_id', ctx.effectiveUserId)
    .order('created_at', { ascending: false })
    .limit(250)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const suggestions = Array.from(new Set(
    (data ?? [])
      .map(record => record.final_data?.[field])
      .filter((value): value is string => typeof value === 'string' && value.toLowerCase().startsWith(q.toLowerCase()))
  )).slice(0, 10)

  return NextResponse.json({ suggestions })
}

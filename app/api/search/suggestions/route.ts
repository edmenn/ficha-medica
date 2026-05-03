import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_FIELDS = ['cirujano', 'anestesiologo', 'sanatorio', 'procedimiento', 'instrumentador'] as const

export async function GET(req: NextRequest) {
  const field = req.nextUrl.searchParams.get('field')
  const q = req.nextUrl.searchParams.get('q') ?? ''

  if (!field || !ALLOWED_FIELDS.includes(field as typeof ALLOWED_FIELDS[number])) {
    return NextResponse.json({ suggestions: [] })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('surgical_records')
    .select('final_data')
    .eq('user_id', user.id)
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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { FieldType } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('custom_field_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('display_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fields: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { field_name: string; field_type: FieldType; is_required?: boolean }
  if (!body.field_name?.trim()) return NextResponse.json({ error: 'field_name required' }, { status: 400 })

  const { count } = await supabase
    .from('custom_field_templates')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { data, error } = await supabase
    .from('custom_field_templates')
    .insert({
      user_id: user.id,
      field_name: body.field_name.trim(),
      field_type: body.field_type ?? 'text',
      is_required: body.is_required ?? false,
      display_order: (count ?? 0) + 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

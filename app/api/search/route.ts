import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const cirujano = searchParams.get('cirujano')
  const sanatorio = searchParams.get('sanatorio')

  let query = supabase
    .from('surgical_records')
    .select('*')
    .order('final_data->>fecha_cirugia', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (q.trim()) {
    query = query.or(
      `final_data->>'paciente'.ilike.%${q}%,` +
      `final_data->>'cirujano'.ilike.%${q}%,` +
      `final_data->>'procedimiento'.ilike.%${q}%,` +
      `final_data->>'diagnostico'.ilike.%${q}%`
    )
  }
  if (from) query = query.gte('final_data->>fecha_cirugia', from)
  if (to) query = query.lte('final_data->>fecha_cirugia', to)
  if (cirujano) query = query.ilike("final_data->>'cirujano'", `%${cirujano}%`)
  if (sanatorio) query = query.ilike("final_data->>'sanatorio'", `%${sanatorio}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ records: data })
}

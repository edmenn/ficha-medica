import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('surgical_records')
    .select('final_data')
    .order('final_data->>cirujano')
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cirujanos = new Set<string>()
  const sanatorios = new Set<string>()

  for (const record of data ?? []) {
    const cirujano = record.final_data?.cirujano?.trim()
    const sanatorio = record.final_data?.sanatorio?.trim()
    if (cirujano) cirujanos.add(cirujano)
    if (sanatorio) sanatorios.add(sanatorio)
  }

  return NextResponse.json({
    cirujanos: Array.from(cirujanos).sort((a, b) => a.localeCompare(b, 'es')),
    sanatorios: Array.from(sanatorios).sort((a, b) => a.localeCompare(b, 'es')),
  })
}

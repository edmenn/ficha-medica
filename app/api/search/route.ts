import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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
  const status = searchParams.get('status')

  let query = supabase
    .from('surgical_records')
    .select('*')
    .order('final_data->>fecha_cirugia', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (from) query = query.gte('final_data->>fecha_cirugia', from)
  if (to) query = query.lte('final_data->>fecha_cirugia', to)
  if (cirujano) query = query.ilike("final_data->>'cirujano'", `%${cirujano}%`)
  if (sanatorio) query = query.ilike("final_data->>'sanatorio'", `%${sanatorio}%`)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const terms = q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  const filtered = (data ?? []).filter(record => {
    if (terms.length === 0) return true

    const haystack = [
      record.final_data?.paciente,
      record.final_data?.cirujano,
      record.final_data?.procedimiento,
      record.final_data?.diagnostico,
      record.final_data?.sanatorio,
      record.final_data?.ayudantes,
      record.final_data?.anestesiologo,
      record.final_data?.instrumentador,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return terms.every(term => haystack.includes(term))
  })

  const service = await createServiceClient()
  const records = await Promise.all(filtered.slice(0, 50).map(async record => {
    if (!record.image_path || record.image_path === 'manual-entry') {
      return { ...record, image_url: null }
    }

    const { data: signed } = await service.storage
      .from('surgical-images')
      .createSignedUrl(record.image_path, 3600)

    return { ...record, image_url: signed?.signedUrl ?? null }
  }))

  return NextResponse.json({ records })
}

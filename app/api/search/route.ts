import { NextRequest, NextResponse } from 'next/server'
import { compareDateStringsDesc, isDateInRange } from '@/lib/record-utils'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function normalizeFilterValue(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function getPrimaryImagePath(record: { image_paths?: string[] | null; image_path?: string | null }) {
  return record.image_paths?.[0] ?? record.image_path ?? null
}

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
    .limit(200)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const terms = q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  const selectedCirujano = normalizeFilterValue(cirujano)
  const selectedSanatorio = normalizeFilterValue(sanatorio)

  const filtered = (data ?? []).filter(record => {
    if ((from || to) && !isDateInRange(record.final_data?.fecha_cirugia, from, to)) {
      return false
    }

    if (selectedCirujano) {
      const recordCirujano = normalizeFilterValue(record.final_data?.cirujano)
      if (recordCirujano !== selectedCirujano) return false
    }

    if (selectedSanatorio) {
      const recordSanatorio = normalizeFilterValue(record.final_data?.sanatorio)
      if (recordSanatorio !== selectedSanatorio) return false
    }

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

    const normalizedHaystack = normalizeFilterValue(haystack)

    return terms.every(term => normalizedHaystack.includes(term))
  })
    .sort((left, right) => {
      const byDate = compareDateStringsDesc(left.final_data?.fecha_cirugia, right.final_data?.fecha_cirugia)
      if (byDate !== 0) return byDate
      return right.created_at.localeCompare(left.created_at)
    })

  const service = await createServiceClient()
  const records = await Promise.all(filtered.slice(0, 50).map(async record => {
    const imagePath = getPrimaryImagePath(record)
    if (!imagePath || imagePath === 'manual-entry') {
      return { ...record, image_url: null }
    }

    const { data: signed } = await service.storage
      .from('surgical-images')
      .createSignedUrl(imagePath, 3600)

    return { ...record, image_url: signed?.signedUrl ?? null }
  }))

  return NextResponse.json({ records })
}

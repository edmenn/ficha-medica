import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { compareDateStringsDesc } from '@/lib/record-utils'
import { createServiceClient } from '@/lib/supabase/server'
import { isValidImagePath } from '@/lib/storage-paths'

const VALID_STATUS = new Set(['draft', 'reviewed', 'final'])

function normalizeFilterValue(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function getPrimaryImagePath(record: { image_paths?: string[] | null; image_path?: string | null }, userId: string) {
  const paths = record.image_paths?.length ? record.image_paths : record.image_path ? [record.image_path] : []
  const valid = paths.filter(path => isValidImagePath(path, userId))
  return valid[0] ?? null
}

export async function GET(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const cirujano = searchParams.get('cirujano')
  const sanatorio = searchParams.get('sanatorio')
  const status = searchParams.get('status')

  const rawPage = parseInt(searchParams.get('page') ?? '1')
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const requestedPageSize = parseInt(searchParams.get('pageSize') ?? '20')
  const limit = [10, 20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20
  const offset = (page - 1) * limit

  if (status && !VALID_STATUS.has(status)) {
    return NextResponse.json({ error: 'Parámetro status inválido' }, { status: 400 })
  }

  const service = await createServiceClient()

  // Filtros duros en la base (status, fechas, sanatorio, cirujano). Sin corte
  // silencioso: se trae el universo filtrado y se pagina en memoria.
  let query = service
    .from('surgical_records')
    .select('*')
    .eq('user_id', ctx.effectiveUserId)

  if (status) query = query.eq('status', status)
  if (from) query = query.gte('surgical_date', from)
  if (to) query = query.lte('surgical_date', to)
  if (sanatorio) query = query.eq('final_data->>sanatorio', sanatorio)
  if (cirujano) query = query.eq('final_data->>cirujano', cirujano)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const selectedSanatorio = normalizeFilterValue(sanatorio)
  const selectedCirujano = normalizeFilterValue(cirujano)

  const filtered = (data ?? []).filter(record => {
    if (selectedSanatorio && normalizeFilterValue(record.final_data?.sanatorio) !== selectedSanatorio) return false
    if (selectedCirujano && normalizeFilterValue(record.final_data?.cirujano) !== selectedCirujano) return false
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
  }).sort((left, right) => {
    const byDate = compareDateStringsDesc(left.final_data?.fecha_cirugia, right.final_data?.fecha_cirugia)
    if (byDate !== 0) return byDate
    return right.created_at.localeCompare(left.created_at)
  })

  const total = filtered.length
  const paged = filtered.slice(offset, offset + limit)

  const records = await Promise.all(paged.map(async record => {
    const imagePath = getPrimaryImagePath(record, ctx.effectiveUserId)
    if (!imagePath || imagePath === 'manual-entry') {
      return { ...record, image_url: null }
    }

    const { data: signed } = await service.storage
      .from('surgical-images')
      .createSignedUrl(imagePath, 3600)

    return { ...record, image_url: signed?.signedUrl ?? null }
  }))

  return NextResponse.json({ records, total, page, pageSize: limit })
}

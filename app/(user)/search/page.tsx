import RecordCard from '@/components/records/RecordCard'
import { requireOperationalContext } from '@/lib/auth/guards'
import { compareDateStringsDesc } from '@/lib/record-utils'
import { createServiceClient } from '@/lib/supabase/server'
import { isValidImagePath } from '@/lib/storage-paths'
import type { SurgicalRecord } from '@/types'

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

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; from?: string; to?: string; sanatorio?: string; cirujano?: string; status?: string }>
}) {
  const sp = await searchParams
  const q = sp?.q ?? ''
  const from = sp?.from ?? ''
  const to = sp?.to ?? ''
  const sanatorio = sp?.sanatorio ?? ''
  const cirujano = sp?.cirujano ?? ''
  const status = sp?.status ?? ''

  const ctx = await requireOperationalContext()
  if ('error' in ctx) return null

  const service = await createServiceClient()

  // Filtros duros en la base; sin corte silencioso (se pagina en memoria luego).
  let query = service
    .from('surgical_records')
    .select('*')
    .eq('user_id', ctx.effectiveUserId)

  if (status) query = query.eq('status', status)
  if (from) query = query.gte('surgical_date', from)
  if (to) query = query.lte('surgical_date', to)
  if (sanatorio) query = query.eq('final_data->>sanatorio', sanatorio)
  if (cirujano) query = query.eq('final_data->>cirujano', cirujano)

  const [{ data }, { data: filterRows }] = await Promise.all([
    query,
    service.from('surgical_records').select('final_data').eq('user_id', ctx.effectiveUserId),
  ])

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const selectedCirujano = normalizeFilterValue(cirujano)
  const selectedSanatorio = normalizeFilterValue(sanatorio)

  const filtered = ((data ?? []) as SurgicalRecord[]).filter(record => {
    if (selectedCirujano && normalizeFilterValue(record.final_data?.cirujano) !== selectedCirujano) {
      return false
    }

    if (selectedSanatorio && normalizeFilterValue(record.final_data?.sanatorio) !== selectedSanatorio) {
      return false
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
  }).sort((left, right) => {
    const byDate = compareDateStringsDesc(left.final_data?.fecha_cirugia, right.final_data?.fecha_cirugia)
    if (byDate !== 0) return byDate
    return right.created_at.localeCompare(left.created_at)
  })

  const records = await Promise.all(filtered.map(async record => {
    const imagePath = getPrimaryImagePath(record, ctx.effectiveUserId)
    if (!imagePath || imagePath === 'manual-entry') {
      return { ...record, image_url: null }
    }

    const { data: signed } = await service.storage
      .from('surgical-images')
      .createSignedUrl(imagePath, 3600)

    return { ...record, image_url: signed?.signedUrl ?? null }
  }))

  const cirujanoOptions = new Set<string>()
  const sanatorioOptions = new Set<string>()
  for (const row of filterRows ?? []) {
    const rowCirujano = row.final_data?.cirujano?.trim()
    const rowSanatorio = row.final_data?.sanatorio?.trim()
    if (rowCirujano) cirujanoOptions.add(rowCirujano)
    if (rowSanatorio) sanatorioOptions.add(rowSanatorio)
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Buscar</h1>
      <form className="mb-4 space-y-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Paciente, procedimiento, diagnóstico..."
          className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">Desde</label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none [color-scheme:dark]"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">Hasta</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none [color-scheme:dark]"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Sanatorio</label>
            <select
              name="sanatorio"
              defaultValue={sanatorio}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Todos</option>
              {Array.from(sanatorioOptions).sort((a, b) => a.localeCompare(b, 'es')).map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Cirujano</label>
            <select
              name="cirujano"
              defaultValue={cirujano}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Todos</option>
              {Array.from(cirujanoOptions).sort((a, b) => a.localeCompare(b, 'es')).map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700">
          Buscar
        </button>
      </form>

      {records.length === 0 && q && <p className="py-8 text-center text-slate-500">Sin resultados</p>}
      {records.length > 0 && <p className="mb-3 text-xs text-slate-500">{records.length} resultado{records.length !== 1 ? 's' : ''}</p>}
      {records.map(record => <RecordCard key={record.id} record={record} />)}
    </div>
  )
}

import RecordCard from '@/components/records/RecordCard'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { SurgicalRecord } from '@/types'

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

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: { q?: string; from?: string; to?: string; sanatorio?: string; cirujano?: string; status?: string }
}) {
  const q = searchParams?.q ?? ''
  const from = searchParams?.from ?? ''
  const to = searchParams?.to ?? ''
  const sanatorio = searchParams?.sanatorio ?? ''
  const cirujano = searchParams?.cirujano ?? ''
  const status = searchParams?.status ?? ''

  const supabase = await createClient()
  let query = supabase
    .from('surgical_records')
    .select('*')
    .order('final_data->>fecha_cirugia', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (from) query = query.gte('final_data->>fecha_cirugia', from)
  if (to) query = query.lte('final_data->>fecha_cirugia', to)
  if (status) query = query.eq('status', status)

  const [{ data }, { data: filterRows }] = await Promise.all([
    query,
    supabase.from('surgical_records').select('final_data').order('final_data->>cirujano').limit(500),
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
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">Hasta</label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
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
      {records.map(record => <RecordCard key={record.id} record={record} />)}
    </div>
  )
}

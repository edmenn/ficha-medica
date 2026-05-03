import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUserProfile } from '@/lib/auth'
import { compareDateStringsDesc, isDateInRange, normalizeDateString } from '@/lib/record-utils'
import { createClient } from '@/lib/supabase/server'
import type { SurgicalRecord } from '@/types'

function getDefaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(1)
  return {
    from: normalizeDateString(from.toISOString().split('T')[0]) ?? '',
    to: normalizeDateString(to.toISOString().split('T')[0]) ?? '',
  }
}

function computeStats(records: SurgicalRecord[]) {
  const total = records.length
  const bySanatorio = records.reduce<Record<string, number>>((acc, record) => {
    const sanatorio = record.final_data.sanatorio ?? 'Sin especificar'
    acc[sanatorio] = (acc[sanatorio] ?? 0) + 1
    return acc
  }, {})

  return { total, bySanatorio }
}

function buildReportQuery(from: string, to: string, sanatorio: string) {
  const params = new URLSearchParams({ from, to, status: 'final' })
  if (sanatorio.trim()) {
    params.set('sanatorio', sanatorio.trim())
  }
  return params.toString()
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: { from?: string; to?: string; sanatorio?: string }
}) {
  const defaults = getDefaultRange()
  const from = searchParams?.from ?? defaults.from
  const to = searchParams?.to ?? defaults.to
  const sanatorio = searchParams?.sanatorio ?? ''
  const searched = Boolean(searchParams?.from || searchParams?.to || searchParams?.sanatorio)

  const profile = await getCurrentUserProfile()
  if (profile?.role === 'admin') {
    redirect('/admin/users')
  }

  const supabase = await createClient()
  const [{ data }, { data: filterRows }] = await Promise.all([
    supabase
      .from('surgical_records')
      .select('*')
      .eq('status', 'final'),
    supabase.from('surgical_records').select('final_data').order('final_data->>cirujano').limit(500),
  ])

  const sanatorioOptions = Array.from(new Set(
    (filterRows ?? [])
      .map(row => row.final_data?.sanatorio?.trim())
      .filter((value): value is string => Boolean(value))
  )).sort((a, b) => a.localeCompare(b, 'es'))

  const records = ((data ?? []) as SurgicalRecord[])
    .filter(record => isDateInRange(record.final_data.fecha_cirugia, from, to))
    .filter(record => {
      if (!sanatorio.trim()) return true
      return record.final_data.sanatorio?.trim() === sanatorio.trim()
    })
    .sort((left, right) => {
      const byDate = compareDateStringsDesc(left.final_data.fecha_cirugia, right.final_data.fecha_cirugia)
      if (byDate !== 0) return byDate
      return right.created_at.localeCompare(left.created_at)
    })

  const stats = computeStats(records)
  const queryString = buildReportQuery(from, to, sanatorio)

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Reportes</h1>

      <form className="mb-4">
        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">Desde</label>
            <input
              type="text"
              name="from"
              defaultValue={from}
              placeholder="dd-mm-aaaa"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-500">Hasta</label>
            <input
              type="text"
              name="to"
              defaultValue={to}
              placeholder="dd-mm-aaaa"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-xs text-slate-500">Sanatorio</label>
          <select
            name="sanatorio"
            defaultValue={sanatorio}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todos</option>
            {sanatorioOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="mb-4 w-full rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-700">
          Generar reporte
        </button>
      </form>

      {searched && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-800 p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{stats.total}</p>
              <p className="mt-1 text-xs text-slate-400">cirugías</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{Object.keys(stats.bySanatorio).length}</p>
              <p className="mt-1 text-xs text-slate-400">sanatorios</p>
            </div>
          </div>

          {Object.keys(stats.bySanatorio).length > 0 && (
            <div className="mb-4 rounded-xl bg-slate-800 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-300">Por sanatorio</h3>
              {Object.entries(stats.bySanatorio)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <div key={name} className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-300">{name}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                ))}
            </div>
          )}

          {records.length > 0 && (
            <div className="flex gap-3">
              <Link
                href={`/api/export?format=xlsx&${queryString}`}
                target="_blank"
                className="flex-1 rounded-xl bg-green-700 py-3 text-center text-sm font-medium text-white hover:bg-green-600"
              >
                Exportar Excel
              </Link>
              <Link
                href={`/api/export?format=pdf&${queryString}`}
                target="_blank"
                className="flex-1 rounded-xl bg-red-800 py-3 text-center text-sm font-medium text-white hover:bg-red-700"
              >
                Exportar PDF
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}

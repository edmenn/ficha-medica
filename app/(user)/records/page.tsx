import Link from 'next/link'
import RecordListItem from '@/components/records/RecordListItem'
import MonthFilter from '@/components/records/MonthFilter'
import { requireOperationalContext } from '@/lib/auth/guards'
import { compareDateStringsDesc, normalizeDateString } from '@/lib/record-utils'
import { createServiceClient } from '@/lib/supabase/server'
import type { SurgicalRecord } from '@/types'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function buildPageHref(page: number, pageSize: number, month?: string) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  if (month) params.set('month', month)
  const qs = params.toString()
  return qs ? `/records?${qs}` : '/records'
}

function recordMatchesMonth(record: SurgicalRecord, month: string): boolean {
  const normalized = normalizeDateString(record.final_data?.fecha_cirugia)
  const match = normalized?.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return false
  return `${match[3]}-${match[2]}` === month
}

function getAvailableMonths(records: SurgicalRecord[]): string[] {
  const months = new Set<string>()
  for (const record of records) {
    const normalized = normalizeDateString(record.final_data?.fecha_cirugia)
    const match = normalized?.match(/^(\d{2})-(\d{2})-(\d{4})$/)
    if (match) months.add(`${match[3]}-${match[2]}`)
  }
  return Array.from(months).sort().reverse()
}

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-')
  const index = Number(monthNum) - 1
  return `${MONTHS[index] ?? monthNum} ${year}`
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; pageSize?: string; month?: string }>
}) {
  const sp = await searchParams
  const rawPage = Number.parseInt(sp?.page ?? '1', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const rawPageSize = Number.parseInt(sp?.pageSize ?? '20', 10)
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize) ? rawPageSize : 20
  const month = sp?.month || undefined
  const offset = (page - 1) * pageSize

  const ctx = await requireOperationalContext()
  if ('error' in ctx) return null

  const service = await createServiceClient()
  const { data } = await service
    .from('surgical_records')
    .select('*')
    .eq('user_id', ctx.effectiveUserId)

  const allRecords = ((data ?? []) as SurgicalRecord[]).sort((left, right) => {
    const byDate = compareDateStringsDesc(left.final_data?.fecha_cirugia, right.final_data?.fecha_cirugia)
    if (byDate !== 0) return byDate
    return (right.created_at ?? '').localeCompare(left.created_at ?? '')
  })

  const availableMonths = getAvailableMonths(allRecords)
  const monthOptions = availableMonths.map(m => ({ value: m, label: formatMonthLabel(m) }))
  const filteredRecords = month ? allRecords.filter(r => recordMatchesMonth(r, month)) : allRecords

  const total = filteredRecords.length
  const records = filteredRecords.slice(offset, offset + pageSize)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Registros</h1>
          {total > 0 && <p className="mt-1 text-sm text-slate-500">{total} registros</p>}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <MonthFilter months={monthOptions} currentMonth={month} pageSize={pageSize} />
          <div>
            <label className="mb-1 block text-xs text-slate-500">Ver</label>
            <form className="flex items-center gap-2">
              <input type="hidden" name="page" value="1" />
              <input type="hidden" name="month" value={month ?? ''} />
              <select
                name="pageSize"
                defaultValue={String(pageSize)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                {PAGE_SIZE_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white"
              >
                Aplicar
              </button>
            </form>
          </div>
        </div>
      </div>

      {month && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-slate-400">Filtrando por {formatMonthLabel(month)}</span>
          <Link
            href={buildPageHref(1, pageSize)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white"
          >
            Quitar filtro
          </Link>
        </div>
      )}

      {records.length === 0 && (
        <div className="py-12 text-center">
          <p className="mb-4 text-slate-400">No hay registros aún</p>
          <p className="text-sm text-slate-500">Tocá para crear el primero</p>
        </div>
      )}

      <div className="space-y-2">
        {records.map(record => <RecordListItem key={record.id} record={record} />)}
      </div>

      {total > pageSize && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <Link
            href={buildPageHref(Math.max(1, page - 1), pageSize, month)}
            aria-disabled={page === 1}
            className={`rounded-lg bg-slate-800 px-3 py-2 text-sm text-white ${page === 1 ? 'pointer-events-none opacity-40' : ''}`}
          >
            Anterior
          </Link>
          <span className="text-sm text-slate-400">Página {page} de {totalPages}</span>
          <Link
            href={buildPageHref(Math.min(totalPages, page + 1), pageSize, month)}
            aria-disabled={page >= totalPages}
            className={`rounded-lg bg-slate-800 px-3 py-2 text-sm text-white ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
          >
            Siguiente
          </Link>
        </div>
      )}
    </div>
  )
}

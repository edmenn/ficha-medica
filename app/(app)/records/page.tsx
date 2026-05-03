import Link from 'next/link'
import RecordListItem from '@/components/records/RecordListItem'
import { createClient } from '@/lib/supabase/server'
import type { SurgicalRecord } from '@/types'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function buildPageHref(page: number, pageSize: number) {
  return `/records?page=${page}&pageSize=${pageSize}`
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams?: { page?: string; pageSize?: string }
}) {
  const rawPage = Number.parseInt(searchParams?.page ?? '1', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const rawPageSize = Number.parseInt(searchParams?.pageSize ?? '20', 10)
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize) ? rawPageSize : 20
  const offset = (page - 1) * pageSize

  const supabase = await createClient()
  const { data, count } = await supabase
    .from('surgical_records')
    .select('*', { count: 'exact' })
    .order('final_data->>fecha_cirugia', { ascending: true })
    .order('final_data->>hora_inicio', { ascending: true })
    .order('created_at', { ascending: true })
    .range(offset, offset + pageSize - 1)

  const records = (data ?? []) as SurgicalRecord[]
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Registros</h1>
          {total > 0 && <p className="mt-1 text-sm text-slate-500">{total} registros</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Ver</label>
          <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-800 p-1 text-sm">
            {PAGE_SIZE_OPTIONS.map(option => (
              <Link
                key={option}
                href={buildPageHref(1, option)}
                className={`rounded px-2 py-1 ${pageSize === option ? 'bg-blue-600 text-white' : 'text-slate-300'}`}
              >
                {option}
              </Link>
            ))}
          </div>
        </div>
      </div>

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
            href={buildPageHref(Math.max(1, page - 1), pageSize)}
            aria-disabled={page === 1}
            className={`rounded-lg bg-slate-800 px-3 py-2 text-sm text-white ${page === 1 ? 'pointer-events-none opacity-40' : ''}`}
          >
            Anterior
          </Link>
          <span className="text-sm text-slate-400">Página {page} de {totalPages}</span>
          <Link
            href={buildPageHref(Math.min(totalPages, page + 1), pageSize)}
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

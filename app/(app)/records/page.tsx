'use client'

import { useEffect, useState } from 'react'
import RecordListItem from '@/components/records/RecordListItem'
import type { SurgicalRecord } from '@/types'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export default function RecordsPage() {
  const [records, setRecords] = useState<SurgicalRecord[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/records?page=${page}&pageSize=${pageSize}`)
      .then(r => r.json())
      .then(d => {
        setRecords(d.records ?? [])
        setTotal(d.total ?? 0)
        setLoading(false)
      })
  }, [page, pageSize])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function handlePageSizeChange(value: number) {
    setPageSize(value)
    setPage(1)
  }

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Registros</h1>
          {!loading && total > 0 && (
            <p className="mt-1 text-sm text-slate-500">{total} registros</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Ver</label>
          <select
            value={pageSize}
            onChange={e => handlePageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>
      {loading && <p className="text-slate-400 text-center py-8">Cargando...</p>}
      {!loading && records.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">No hay registros aún</p>
          <p className="text-slate-500 text-sm">Tocá para crear el primero</p>
        </div>
      )}
      <div className="space-y-2">
        {records.map(r => <RecordListItem key={r.id} record={r} />)}
      </div>
      {!loading && total > pageSize && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <button
            type="button"
            onClick={() => setPage(current => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-slate-400">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(current => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

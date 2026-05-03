'use client'

import { useState } from 'react'
import { getDurationMinutes } from '@/lib/record-utils'
import type { SurgicalRecord } from '@/types'

function getDefaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(1)
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

function computeStats(records: SurgicalRecord[]) {
  const total = records.length
  const durations = records
    .map(r => getDurationMinutes(r.final_data))
    .filter((n): n is number => typeof n === 'number' && n > 0)
  const avgMin = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0
  const bySanatorio = records.reduce<Record<string, number>>((acc, r) => {
    const s = r.final_data.sanatorio ?? 'Sin especificar'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})
  return { total, avgMin, bySanatorio }
}

export default function ReportsPage() {
  const defaults = getDefaultRange()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [records, setRecords] = useState<SurgicalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function loadRecords() {
    setLoading(true)
    const res = await fetch(`/api/search?from=${from}&to=${to}`)
    const data = await res.json()
    setRecords(data.records ?? [])
    setLoading(false)
    setSearched(true)
  }

  function exportFile(format: 'xlsx' | 'pdf') {
    window.open(`/api/export?format=${format}&from=${from}&to=${to}`, '_blank')
  }

  const stats = computeStats(records)

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Reportes</h1>

      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Desde</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2.5 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <button
        onClick={loadRecords}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl mb-4"
      >
        {loading ? 'Cargando...' : 'Generar reporte'}
      </button>

      {searched && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{stats.total}</p>
              <p className="text-xs text-slate-400 mt-1">cirugías</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-400">
                {stats.avgMin > 0 ? `${Math.floor(stats.avgMin / 60)}h ${stats.avgMin % 60}m` : '—'}
              </p>
              <p className="text-xs text-slate-400 mt-1">duración promedio</p>
            </div>
          </div>

          {Object.keys(stats.bySanatorio).length > 0 && (
            <div className="bg-slate-800 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Por sanatorio</h3>
              {Object.entries(stats.bySanatorio)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <div key={name} className="flex justify-between text-sm mb-2">
                    <span className="text-slate-300">{name}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                ))}
            </div>
          )}

          {records.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={() => exportFile('xlsx')}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white py-3 rounded-xl text-sm font-medium"
              >
                Exportar Excel
              </button>
              <button
                onClick={() => exportFile('pdf')}
                className="flex-1 bg-red-800 hover:bg-red-700 text-white py-3 rounded-xl text-sm font-medium"
              >
                Exportar PDF
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

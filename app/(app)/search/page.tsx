'use client'

import { useState, useEffect, useCallback } from 'react'
import RecordCard from '@/components/records/RecordCard'
import type { SurgicalRecord } from '@/types'

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [cirujano, setCirujano] = useState('')
  const [sanatorio, setSanatorio] = useState('')
  const [records, setRecords] = useState<SurgicalRecord[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (cirujano) params.set('cirujano', cirujano)
    if (sanatorio) params.set('sanatorio', sanatorio)
    const res = await fetch(`/api/search?${params}`)
    const data = await res.json()
    setRecords(data.records ?? [])
    setLoading(false)
  }, [q, from, to, cirujano, sanatorio])

  useEffect(() => { search() }, [search])

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Buscar</h1>
      <input
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Paciente, procedimiento, diagnóstico..."
        className="w-full bg-slate-800 text-white rounded-xl px-4 py-3 border border-slate-700 mb-3 focus:outline-none focus:border-blue-500"
      />
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Desde</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Hasta</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Cirujano</label>
          <input type="text" value={cirujano} onChange={e => setCirujano(e.target.value)}
            placeholder="Cirujano..."
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-500 mb-1 block">Sanatorio</label>
          <input type="text" value={sanatorio} onChange={e => setSanatorio(e.target.value)}
            placeholder="Sanatorio..."
            className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
        </div>
      </div>
      {loading && <p className="text-slate-400 text-center py-4">Buscando...</p>}
      {!loading && records.length === 0 && q && (
        <p className="text-slate-500 text-center py-8">Sin resultados</p>
      )}
      {records.map(r => <RecordCard key={r.id} record={r} />)}
    </div>
  )
}

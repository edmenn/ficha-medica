'use client'

import { useEffect, useState } from 'react'
import RecordCard from '@/components/records/RecordCard'
import type { SurgicalRecord } from '@/types'

export default function RecordsPage() {
  const [records, setRecords] = useState<SurgicalRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/records')
      .then(r => r.json())
      .then(d => { setRecords(d.records ?? []); setLoading(false) })
  }, [])

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Registros</h1>
      {loading && <p className="text-slate-400 text-center py-8">Cargando...</p>}
      {!loading && records.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">No hay registros aún</p>
          <p className="text-slate-500 text-sm">Tocá para crear el primero</p>
        </div>
      )}
      {records.map(r => <RecordCard key={r.id} record={r} />)}
    </div>
  )
}

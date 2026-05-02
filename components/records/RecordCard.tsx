import Link from 'next/link'
import type { SurgicalRecord } from '@/types'

interface Props { record: SurgicalRecord }

export default function RecordCard({ record }: Props) {
  const f = record.final_data
  const date = f.fecha_cirugia
    ? new Date(f.fecha_cirugia + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date(record.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <Link href={`/records/${record.id}`}>
      <div className="bg-slate-800 rounded-xl p-4 mb-3 active:opacity-70">
        <div className="flex justify-between items-start mb-1">
          <span className="font-semibold text-white">{f.paciente ?? 'Sin nombre'}</span>
          <span className="text-xs text-slate-400">{date}</span>
        </div>
        <p className="text-sm text-slate-400 truncate">{f.procedimiento ?? f.diagnostico ?? '—'}</p>
        {f.sanatorio && <p className="text-xs text-slate-500 mt-1">{f.sanatorio}</p>}
      </div>
    </Link>
  )
}

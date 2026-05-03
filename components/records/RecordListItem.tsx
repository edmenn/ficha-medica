import Link from 'next/link'
import type { SurgicalRecord } from '@/types'

interface Props {
  record: SurgicalRecord
}

function formatDate(record: SurgicalRecord) {
  const source = record.final_data.fecha_cirugia
    ? `${record.final_data.fecha_cirugia}T12:00:00`
    : record.created_at

  return new Date(source).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function RecordListItem({ record }: Props) {
  const f = record.final_data

  return (
    <Link href={`/records/${record.id}`} className="block">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 active:opacity-70">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white">{f.paciente ?? 'Sin nombre'}</p>
            <p className="mt-1 truncate text-sm text-slate-400">
              {f.procedimiento ?? f.diagnostico ?? 'Sin procedimiento'}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>{formatDate(record)}</span>
              {f.sanatorio && <span>{f.sanatorio}</span>}
              {f.hora_inicio && <span>Inicio {f.hora_inicio}</span>}
              {f.duracion && <span>{f.duracion}</span>}
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
            {record.status}
          </span>
        </div>
      </div>
    </Link>
  )
}

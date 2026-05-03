import Link from 'next/link'
import type { SurgicalRecord, UserProfile } from '@/types'

const STATUS_LABELS: Record<SurgicalRecord['status'], string> = {
  draft: 'Borrador',
  reviewed: 'Revisado',
  final: 'Final',
}

interface Props {
  user: Pick<UserProfile, 'id' | 'email' | 'role' | 'created_at'>
  records: SurgicalRecord[]
}

export default function AdminUserDetailPage({ user, records }: Props) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Usuario</p>
          <h1 className="text-2xl font-bold text-white">{user.email}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {user.role} · alta {new Date(user.created_at).toLocaleDateString('es-AR')}
          </p>
        </div>
        <Link href="/admin/users" className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">
          Volver
        </Link>
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-slate-900/70 p-4">
          <p className="text-sm text-slate-500">Registros</p>
          <p className="mt-1 text-3xl font-bold text-white">{records.length}</p>
        </div>
        <div className="rounded-xl bg-slate-900/70 p-4">
          <p className="text-sm text-slate-500">Borradores</p>
          <p className="mt-1 text-3xl font-bold text-amber-300">
            {records.filter(record => record.status === 'draft').length}
          </p>
        </div>
        <div className="rounded-xl bg-slate-900/70 p-4">
          <p className="text-sm text-slate-500">Finales</p>
          <p className="mt-1 text-3xl font-bold text-emerald-300">
            {records.filter(record => record.status === 'final').length}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {records.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
            Este usuario todavía no tiene registros.
          </div>
        )}

        {records.map(record => (
          <Link
            key={record.id}
            href={`/admin/users/${user.id}/records/${record.id}`}
            className="block rounded-xl border border-slate-800 bg-slate-900/70 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{record.final_data.paciente ?? 'Sin nombre'}</p>
                <p className="mt-1 truncate text-sm text-slate-400">
                  {record.final_data.procedimiento ?? record.final_data.diagnostico ?? 'Sin procedimiento'}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{record.final_data.fecha_cirugia ?? 'Sin fecha'}</span>
                  {record.final_data.sanatorio && <span>{record.final_data.sanatorio}</span>}
                </div>
              </div>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                {STATUS_LABELS[record.status]}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

import Link from 'next/link'
import ImpersonateButton from '@/components/admin/users/ImpersonateButton'
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
  const drafts = records.filter(record => record.status === 'draft').length
  const finals = records.filter(record => record.status === 'final').length

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <Link href="/admin/users" className="text-sm text-slate-400 hover:text-white">
          ← Volver a usuarios
        </Link>
      </div>

      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Datos del usuario supervisado</p>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-800">
            <tr>
              <td className="py-2 text-slate-400">Email</td>
              <td className="py-2 text-white font-medium text-right">{user.email}</td>
            </tr>
            <tr>
              <td className="py-2 text-slate-400">Rol</td>
              <td className="py-2 text-slate-300 text-right">{user.role}</td>
            </tr>
            <tr>
              <td className="py-2 text-slate-400">Alta</td>
              <td className="py-2 text-slate-300 text-right">
                {new Date(user.created_at).toLocaleDateString('es-AR')}
              </td>
            </tr>
            <tr>
              <td className="py-2 text-slate-400">Registros</td>
              <td className="py-2 text-slate-300 text-right">
                {records.length} ({drafts} borradores, {finals} finales)
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {user.role === 'user' && (
        <div className="mb-6 flex gap-2">
          <ImpersonateButton userId={user.id} />
        </div>
      )}

      <div>
        <p className="mb-3 text-xs text-slate-500 uppercase tracking-wide">
          Registros del usuario supervisado
        </p>

        {records.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-6 text-center text-sm text-slate-500">
            Sin registros
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/70">
                  <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Fecha</th>
                  <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Cirujano</th>
                  <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Sanatorio</th>
                  <th className="px-4 py-2 text-left text-xs text-slate-400 font-medium">Estado</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                {records.map(record => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 text-slate-300">{record.final_data.fecha_cirugia ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{record.final_data.cirujano ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{record.final_data.sanatorio ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{STATUS_LABELS[record.status]}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/users/${user.id}/records/${record.id}`} className="rounded px-2 py-1 text-xs bg-slate-700 text-white">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

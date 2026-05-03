import Link from 'next/link'

interface AdminStats {
  totalUsers: number
  userCount: number
  adminCount: number
  pendingInvitations: number
}

export default function AdminDashboard({ stats }: { stats: AdminStats }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Panel de Administración</h1>
        <p className="mt-1 text-sm text-slate-400">Resumen del sistema</p>
      </div>

      <div className="mb-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-800">
            <tr>
              <td className="px-4 py-3 text-slate-400">Total usuarios</td>
              <td className="px-4 py-3 text-right font-semibold text-white">{stats.totalUsers}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-400">Usuarios operativos</td>
              <td className="px-4 py-3 text-right font-semibold text-white">{stats.userCount}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-400">Administradores</td>
              <td className="px-4 py-3 text-right font-semibold text-white">{stats.adminCount}</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-400">Invitaciones pendientes</td>
              <td className="px-4 py-3 text-right font-semibold text-amber-300">{stats.pendingInvitations}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Link
        href="/admin/users"
        className="block rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
      >
        Gestionar usuarios →
      </Link>
    </div>
  )
}

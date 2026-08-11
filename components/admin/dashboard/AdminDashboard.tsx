import Link from 'next/link'

interface AdminStats {
  totalUsers: number
  userCount: number
  adminCount: number
  pendingInvitations: number
}

export default function AdminDashboard({ stats }: { stats: AdminStats }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
        <h1 className="text-2xl font-bold text-white">Panel de Administración</h1>
        <p className="mt-1 text-sm text-slate-400">Resumen del sistema</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total usuarios</p>
          <p className="mt-2 text-3xl font-bold text-white">{stats.totalUsers}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Usuarios operativos</p>
          <p className="mt-2 text-3xl font-bold text-white">{stats.userCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Administradores</p>
          <p className="mt-2 text-3xl font-bold text-white">{stats.adminCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Invitaciones pendientes</p>
          <p className="mt-2 text-3xl font-bold text-amber-300">{stats.pendingInvitations}</p>
        </div>
      </div>

      <Link
        href="/admin/users"
        className="block rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
      >
        Gestionar usuarios →
      </Link>
    </div>
  )
}

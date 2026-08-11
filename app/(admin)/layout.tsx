import { redirect } from 'next/navigation'
import AdminNav from '@/components/admin/layout/AdminNav'
import { getActiveImpersonation } from '@/lib/auth/impersonation'
import { getCurrentUserProfile } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (profile.is_active === false) redirect('/login?inactive=1')
  if (profile.role !== 'admin') redirect('/records')

  const impersonation = await getActiveImpersonation()
  if (impersonation) redirect('/records')

  return (
    <div className="min-h-dvh bg-slate-950 text-white">
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:pt-8">{children}</main>
      <AdminNav />
    </div>
  )
}

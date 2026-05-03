import { redirect } from 'next/navigation'
import AdminNav from '@/components/admin/layout/AdminNav'
import { getActiveImpersonation } from '@/lib/auth/impersonation'
import { getCurrentUserProfile } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/records')

  const impersonation = await getActiveImpersonation()
  if (impersonation) redirect('/records')

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="pb-20 mx-auto px-4 pt-4 max-w-6xl">{children}</main>
      <AdminNav />
    </div>
  )
}

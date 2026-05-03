import { redirect } from 'next/navigation'
import BottomNav from '@/components/ui/BottomNav'
import ImpersonationBanner from '@/components/admin/impersonation/ImpersonationBanner'
import { getCurrentUserProfile } from '@/lib/auth'
import { getActiveImpersonation } from '@/lib/auth/impersonation'

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'admin') {
    const impersonation = await getActiveImpersonation()
    if (!impersonation || impersonation.admin_id !== profile.id) redirect('/admin')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <ImpersonationBanner />
      <main className="pb-20 mx-auto px-4 pt-14 max-w-lg">{children}</main>
      <BottomNav />
    </div>
  )
}

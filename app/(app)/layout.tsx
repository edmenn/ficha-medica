import { redirect } from 'next/navigation'
import BottomNav from '@/components/ui/BottomNav'
import { getCurrentUserProfile } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile()
  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="pb-20 max-w-lg mx-auto px-4 pt-4">{children}</main>
      <BottomNav role={profile.role} />
    </div>
  )
}

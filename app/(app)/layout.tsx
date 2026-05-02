import BottomNav from '@/components/ui/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="pb-20 max-w-lg mx-auto px-4 pt-4">{children}</main>
      <BottomNav />
    </div>
  )
}

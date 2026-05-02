import { redirect } from 'next/navigation'
import UsersAdminPanel from '@/components/settings/UsersAdminPanel'
import { createClient } from '@/lib/supabase/server'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/settings')
  }

  return <UsersAdminPanel />
}

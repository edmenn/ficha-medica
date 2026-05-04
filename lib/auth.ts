import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { UserProfile, UserRole } from '@/types'

export async function getCurrentUserProfile(): Promise<Pick<UserProfile, 'id' | 'email' | 'role' | 'preferred_model'> | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = await createServiceClient()
  const { data } = await service
    .from('users')
    .select('id, email, role, preferred_model')
    .eq('id', user.id)
    .maybeSingle()

  return data ?? null
}

export function getHomePathForRole(role: UserRole) {
  return role === 'admin' ? '/admin' : '/records'
}

import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/types'

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

export async function requireOperationalUser() {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'Unauthorized', status: 401 as const }
  if (profile.role === 'admin') {
    return { error: 'Admins no pueden operar registros', status: 403 as const }
  }
  return { profile }
}

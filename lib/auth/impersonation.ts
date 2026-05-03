import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/types'

export const IMPERSONATION_COOKIE = 'impersonation_session_id'

export interface ImpersonationSession {
  id: string
  admin_id: string
  target_user_id: string
  started_at: string
}

export async function getActiveImpersonation(): Promise<ImpersonationSession | null> {
  const cookieStore = cookies()
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (!sessionId) return null

  const service = await createServiceClient()
  const { data } = await service
    .from('impersonation_sessions')
    .select('id, admin_id, target_user_id, started_at')
    .eq('id', sessionId)
    .is('ended_at', null)
    .maybeSingle()

  return data ?? null
}

export async function isImpersonating(): Promise<boolean> {
  const session = await getActiveImpersonation()
  return session !== null
}

export async function getEffectiveUserProfile(): Promise<Pick<UserProfile, 'id' | 'email' | 'role' | 'preferred_model'> | null> {
  const session = await getActiveImpersonation()
  if (!session) {
    const { getCurrentUserProfile } = await import('@/lib/auth')
    return getCurrentUserProfile()
  }

  const service = await createServiceClient()
  const { data } = await service
    .from('users')
    .select('id, email, role, preferred_model')
    .eq('id', session.target_user_id)
    .maybeSingle()

  return data ?? null
}

export async function getRealUserProfile() {
  const { getCurrentUserProfile } = await import('@/lib/auth')
  return getCurrentUserProfile()
}

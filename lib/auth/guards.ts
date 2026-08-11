import { redirect } from 'next/navigation'
import { getCurrentUserProfile } from '@/lib/auth'
import type { UserProfile } from '@/types'

type ProfileSlice = Pick<UserProfile, 'id' | 'email' | 'role' | 'preferred_model' | 'is_active'>

function isInactive(profile: ProfileSlice): boolean {
  return profile.is_active === false
}

export async function requireUser(): Promise<ProfileSlice> {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (isInactive(profile)) redirect('/login?inactive=1')
  if (profile.role === 'admin') redirect('/admin')
  return profile
}

export async function requireAdmin(): Promise<ProfileSlice> {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/login')
  if (isInactive(profile)) redirect('/login?inactive=1')
  if (profile.role !== 'admin') redirect('/records')
  return profile
}

export async function requireUserApi(): Promise<{ profile: ProfileSlice } | { error: string; status: 401 | 403 }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'Unauthorized', status: 401 }
  if (isInactive(profile)) return { error: 'Tu cuenta fue desactivada. Contactá al administrador.', status: 403 }
  if (profile.role === 'admin') return { error: 'Admins no pueden operar registros', status: 403 }
  return { profile }
}

export async function requireAdminApi(): Promise<{ profile: ProfileSlice } | { error: string; status: 401 | 403 }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'Unauthorized', status: 401 }
  if (isInactive(profile)) return { error: 'Tu cuenta fue desactivada. Contactá al administrador.', status: 403 }
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 }
  return { profile }
}

export async function requireOperationalContext(): Promise<
  { profile: ProfileSlice; effectiveUserId: string } | { error: string; status: 401 | 403 }
> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'Unauthorized', status: 401 }
  if (isInactive(profile)) return { error: 'Tu cuenta fue desactivada. Contactá al administrador.', status: 403 }

  if (profile.role === 'admin') {
    const { getActiveImpersonation } = await import('@/lib/auth/impersonation')
    const session = await getActiveImpersonation()
    if (!session) return { error: 'Admins no pueden operar registros directamente', status: 403 }
    if (session.admin_id !== profile.id) return { error: 'Sesión de impersonación inválida', status: 403 }

    // El usuario efectivo (objetivo de impersonación) también debe estar activo.
    const { createServiceClient } = await import('@/lib/supabase/server')
    const service = await createServiceClient()
    const { data: target } = await service
      .from('users')
      .select('is_active')
      .eq('id', session.target_user_id)
      .maybeSingle()
    if (!target || target.is_active === false) {
      return { error: 'El usuario no está activo', status: 403 }
    }

    return { profile, effectiveUserId: session.target_user_id }
  }

  return { profile, effectiveUserId: profile.id }
}

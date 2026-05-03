import { getActiveImpersonation } from '@/lib/auth/impersonation'
import { createServiceClient } from '@/lib/supabase/server'
import ImpersonationBannerClient from './ImpersonationBannerClient'

export default async function ImpersonationBanner() {
  const session = await getActiveImpersonation()
  if (!session) return null

  const service = await createServiceClient()
  const { data: user } = await service
    .from('users')
    .select('email')
    .eq('id', session.target_user_id)
    .maybeSingle()

  return <ImpersonationBannerClient targetEmail={user?.email ?? session.target_user_id} />
}

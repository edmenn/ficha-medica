import SettingsPageClient from '@/components/settings/SettingsPageClient'
import { getCurrentUserProfile } from '@/lib/auth'

export default async function SettingsPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) return null

  return (
    <SettingsPageClient
      initialRole={profile.role}
      initialPreferredModel={profile.preferred_model}
    />
  )
}

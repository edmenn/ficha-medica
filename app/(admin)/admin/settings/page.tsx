import SettingsPageClient from '@/components/settings/SettingsPageClient'
import { requireAdmin } from '@/lib/auth/guards'

export default async function AdminSettingsPage() {
  const profile = await requireAdmin()

  return (
    <SettingsPageClient
      initialRole={profile.role}
      initialPreferredModel={profile.preferred_model}
      initialCustomFields={[]}
    />
  )
}

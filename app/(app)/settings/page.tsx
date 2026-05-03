import SettingsPageClient from '@/components/settings/SettingsPageClient'
import { getCurrentUserProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('custom_field_templates')
    .select('*')
    .order('display_order')

  return (
    <SettingsPageClient
      initialRole={profile.role}
      initialPreferredModel={profile.preferred_model}
      initialCustomFields={data ?? []}
    />
  )
}

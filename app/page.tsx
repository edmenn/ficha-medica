import { redirect } from 'next/navigation'
import { getCurrentUserProfile, getHomePathForRole } from '@/lib/auth'

export default async function Home() {
  const profile = await getCurrentUserProfile()
  redirect(profile ? getHomePathForRole(profile.role) : '/login')
}

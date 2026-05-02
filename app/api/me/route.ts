import { NextResponse } from 'next/server'
import { getCurrentUserProfile } from '@/lib/auth'

export async function GET() {
  const profile = await getCurrentUserProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ profile })
}

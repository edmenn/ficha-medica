import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

interface OpenRouterModel {
  id: string
  name?: string
  context_length?: number
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('openrouter_key')
    .eq('id', user.id)
    .single()

  const headers: HeadersInit = {}
  if (profile?.openrouter_key) {
    try {
      headers.Authorization = `Bearer ${decrypt(profile.openrouter_key)}`
    } catch {
      return NextResponse.json({ error: 'API key inválida. Volvé a guardarla en Configuración.' }, { status: 422 })
    }
  }

  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers,
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'No se pudo cargar la lista de modelos de OpenRouter.' }, { status: 502 })
  }

  const payload = await res.json() as { data?: OpenRouterModel[] }
  const models = (payload.data ?? [])
    .map(model => ({
      id: model.id,
      name: model.name ?? model.id,
      context_length: model.context_length ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))

  return NextResponse.json({ models })
}

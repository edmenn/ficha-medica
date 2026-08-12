import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()

  // Uso historico global: suma de ai_usage del usuario real. Independiente de
  // registros vivos (record_id puede ser NULL tras borrar el registro).
  const { data: usageRows, error } = await service
    .from('ai_usage')
    .select('cost_usd, total_tokens, created_at')
    .eq('user_id', user.id)

  let totalCostUsd: number | null = null
  let totalRequests = 0
  let totalTokens: number | null = null
  if (!error && usageRows && usageRows.length > 0) {
    totalCostUsd = usageRows.reduce((acc, row) => acc + (Number(row.cost_usd) || 0), 0)
    totalRequests = usageRows.length
    totalTokens = usageRows.reduce((acc, row) => acc + (Number(row.total_tokens) || 0), 0) || null
  }

  // Saldo disponible de OpenRouter (solo informativo).
  let balanceUsd: number | null = null
  const { data: profile } = await service
    .from('users')
    .select('openrouter_key')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.openrouter_key) {
    try {
      const apiKey = decrypt(profile.openrouter_key)
      // Saldo real de la cuenta: GET /credits devuelve total_credits y total_usage.
      const res = await fetch('https://openrouter.ai/api/v1/credits', {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const payload = await res.json() as {
          data?: { total_credits?: number | null; total_usage?: number | null }
        }
        const credits = payload.data?.total_credits
        const usage = payload.data?.total_usage
        if (typeof credits === 'number' && typeof usage === 'number') {
          balanceUsd = credits - usage
        } else if (typeof credits === 'number') {
          balanceUsd = credits
        }
      }
    } catch {
      balanceUsd = null
    }
  }

  return NextResponse.json({
    total_cost_usd: totalCostUsd,
    total_requests: totalRequests,
    total_tokens: totalTokens,
    balance_usd: balanceUsd,
  })
}

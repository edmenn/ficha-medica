import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatCompletion } from 'openai/resources/chat/completions'

export type AiUsageEvent = 'analyze' | 'reanalyze'

interface UsageInput {
  user_id: string
  record_id: string | null
  model: string
  event_type: AiUsageEvent
}

// OpenRouter devuelve el costo real en el header `x-usage` (JSON) de la respuesta.
function parseXUsageHeader(value: string | null): { cost?: number } {
  if (!value) return {}
  try {
    return JSON.parse(value) as { cost?: number }
  } catch {
    return {}
  }
}

export function extractUsageFromCompletion(
  completion: ChatCompletion,
  responseHeaders: Headers
) {
  const usage = completion.usage
  const xUsage = parseXUsageHeader(responseHeaders.get('x-usage'))
  const usageCost = (usage as ChatCompletion['usage'] & { cost?: number })?.cost
  const rawCost = xUsage.cost ?? usageCost

  return {
    prompt_tokens: usage?.prompt_tokens ?? null,
    completion_tokens: usage?.completion_tokens ?? null,
    total_tokens: usage?.total_tokens ?? null,
    cost_usd: typeof rawCost === 'number' && isFinite(rawCost) ? rawCost : null,
    provider: completion.model?.split('/')[0] ?? null,
    request_id: completion.id ?? null,
  }
}

export async function insertAiUsage(
  supabase: SupabaseClient,
  input: UsageInput & ReturnType<typeof extractUsageFromCompletion>
) {
  const { error } = await supabase.from('ai_usage').insert(input)
  if (error) {
    console.error('[ai_usage insert]', error.message)
  }
}

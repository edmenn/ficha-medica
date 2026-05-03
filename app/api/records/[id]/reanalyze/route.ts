import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { createOpenRouterClient, EXTRACTION_PROMPT } from '@/lib/openrouter'
import { parseAIResponse } from '@/lib/ai-parser'
import { normalizeSurgicalFields } from '@/lib/record-utils'
import type { AnalyzeResponse } from '@/types'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('openrouter_key, preferred_model')
    .eq('id', user.id)
    .single()

  if (!profile?.openrouter_key) {
    return NextResponse.json({ error: 'Configure tu API key de OpenRouter en Configuración' }, { status: 422 })
  }

  const { data: record, error: recordError } = await supabase
    .from('surgical_records')
    .select('id, image_path')
    .eq('id', params.id)
    .single()

  if (recordError || !record) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
  }

  if (!record.image_path || record.image_path === 'manual-entry') {
    return NextResponse.json({ error: 'Este registro no tiene imagen para releer' }, { status: 400 })
  }

  let apiKey: string
  try {
    apiKey = decrypt(profile.openrouter_key)
  } catch {
    return NextResponse.json({ error: 'API key inválida, reconfigurala en Configuración' }, { status: 422 })
  }

  const service = await createServiceClient()
  const { data: signedData, error: signedError } = await service.storage
    .from('surgical-images')
    .createSignedUrl(record.image_path, 300)

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'No se pudo acceder a la imagen guardada' }, { status: 500 })
  }

  const client = createOpenRouterClient(apiKey)
  const model = profile.preferred_model ?? 'anthropic/claude-3.5-sonnet'

  let rawResponse: string
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: EXTRACTION_PROMPT },
          { type: 'image_url', image_url: { url: signedData.signedUrl } },
        ],
      }],
      max_tokens: 1000,
    })
    rawResponse = completion.choices[0]?.message?.content ?? ''
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al releer imagen'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const parsed = parseAIResponse(rawResponse)
  const fields = normalizeSurgicalFields(parsed.fields)
  const record_fields = parsed.record_fields.map((field, i) => ({
    ...field,
    id: `tmp-${i}`,
    record_id: record.id,
    ai_value: fields[field.field_name],
    final_value: fields[field.field_name],
    confidence: fields[field.field_name] !== null ? field.confidence : 0,
  }))

  const response: AnalyzeResponse = {
    record_id: record.id,
    extracted_data: fields,
    record_fields,
  }

  return NextResponse.json(response)
}

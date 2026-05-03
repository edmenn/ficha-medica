import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { createOpenRouterClient, EXTRACTION_PROMPT } from '@/lib/openrouter'
import { parseAIResponse } from '@/lib/ai-parser'
import { normalizeSurgicalFields } from '@/lib/record-utils'
import type { AnalyzeResponse } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const imageFile = formData.get('image') as File | null
  const rotatedImageFile = formData.get('image_rotated') as File | null
  if (!imageFile) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  // Get user's OpenRouter key
  const { data: profile } = await supabase
    .from('users')
    .select('openrouter_key, preferred_model')
    .eq('id', user.id)
    .single()

  if (!profile?.openrouter_key) {
    return NextResponse.json({ error: 'Configure tu API key de OpenRouter en Configuración' }, { status: 422 })
  }

  let apiKey: string
  try {
    apiKey = decrypt(profile.openrouter_key)
  } catch {
    return NextResponse.json({ error: 'API key inválida, reconfigurala en Configuración' }, { status: 422 })
  }

  // Upload image to Supabase Storage
  const service = await createServiceClient()
  const imagePath = `${user.id}/${Date.now()}-${imageFile.name}`
  const imageBuffer = await imageFile.arrayBuffer()
  const { error: uploadError } = await service.storage
    .from('surgical-images')
    .upload(imagePath, imageBuffer, { contentType: imageFile.type })

  if (uploadError) {
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
  }

  const { data: signedData } = await service.storage
    .from('surgical-images')
    .createSignedUrl(imagePath, 300)

  let rotatedImagePath: string | null = null
  let rotatedSignedUrl: string | null = null
  if (rotatedImageFile) {
    rotatedImagePath = `${user.id}/${Date.now()}-rotated-${rotatedImageFile.name}`
    const rotatedBuffer = await rotatedImageFile.arrayBuffer()
    const { error: rotatedUploadError } = await service.storage
      .from('surgical-images')
      .upload(rotatedImagePath, rotatedBuffer, { contentType: rotatedImageFile.type })

    if (!rotatedUploadError) {
      const { data } = await service.storage
        .from('surgical-images')
        .createSignedUrl(rotatedImagePath, 300)
      rotatedSignedUrl = data?.signedUrl ?? null
    }
  }

  // Call OpenRouter
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
          { type: 'image_url', image_url: { url: signedData!.signedUrl } },
          ...(rotatedSignedUrl ? [{ type: 'image_url' as const, image_url: { url: rotatedSignedUrl } }] : []),
        ],
      }],
      max_tokens: 1000,
    })
    rawResponse = completion.choices[0]?.message?.content ?? ''
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al analizar imagen'
    return NextResponse.json({ error: msg }, { status: 502 })
  } finally {
    if (rotatedImagePath) {
      await service.storage.from('surgical-images').remove([rotatedImagePath])
    }
  }

  const parsed = parseAIResponse(rawResponse)
  const fields = normalizeSurgicalFields(parsed.fields)
  const record_fields = parsed.record_fields.map(field => ({
    ...field,
    ai_value: fields[field.field_name],
    final_value: fields[field.field_name],
    confidence: fields[field.field_name] !== null ? field.confidence : 0,
  }))

  // Create record in DB
  const { data: record, error: recordError } = await supabase
    .from('surgical_records')
    .insert({
      user_id: user.id,
      image_path: imagePath,
      ai_raw_response: rawResponse,
      extracted_data: fields,
      final_data: fields,
      status: 'draft',
    })
    .select()
    .single()

  if (recordError || !record) {
    return NextResponse.json({ error: 'Error al guardar registro' }, { status: 500 })
  }

  // Insert record_fields
  await supabase.from('record_fields').insert(
    record_fields.map(f => ({ ...f, record_id: record.id }))
  )

  // Audit log
  await supabase.from('audit_log').insert({
    user_id: user.id,
    record_id: record.id,
    action: 'created',
    diff: fields,
  })

  const response: AnalyzeResponse = {
    record_id: record.id,
    extracted_data: fields,
    record_fields: record_fields.map((f, i) => ({ ...f, id: `tmp-${i}`, record_id: record.id })),
  }

  return NextResponse.json(response)
}

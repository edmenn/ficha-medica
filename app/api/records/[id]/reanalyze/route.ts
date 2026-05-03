import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalUser } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'
import { parseAIResponse } from '@/lib/ai-parser'
import { buildExtractionPrompt, createOpenRouterClient, MODELS_WITH_JSON_MODE } from '@/lib/openrouter'
import { normalizeSurgicalFields } from '@/lib/record-utils'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { AnalyzeResponse } from '@/types'

function tempImagePath(userId: string, mimeType: string) {
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg').replace('heif', 'heic') ?? 'jpg'
  return `${userId}/${randomUUID()}-reanalyze.${ext}`
}

async function uploadTempImage(service: Awaited<ReturnType<typeof createServiceClient>>, userId: string, file: File) {
  const path = tempImagePath(userId, file.type)
  const buffer = await file.arrayBuffer()
  const { error } = await service.storage
    .from('surgical-images')
    .upload(path, buffer, { contentType: file.type })

  if (error) return null

  const { data } = await service.storage
    .from('surgical-images')
    .createSignedUrl(path, 300)

  if (!data?.signedUrl) {
    await service.storage.from('surgical-images').remove([path])
    return null
  }

  return { path, signedUrl: data.signedUrl }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOperationalUser()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const supabase = await createClient()
  const service = await createServiceClient()

  const { data: userSettings } = await supabase
    .from('users')
    .select('openrouter_key, preferred_model')
    .eq('id', auth.profile.id)
    .single()

  if (!userSettings?.openrouter_key) {
    return NextResponse.json({ error: 'Configure tu API key de OpenRouter en Configuración' }, { status: 422 })
  }

  let apiKey: string
  try {
    apiKey = decrypt(userSettings.openrouter_key)
  } catch {
    return NextResponse.json({ error: 'API key inválida, reconfigurala en Configuración' }, { status: 422 })
  }

  const { data: customTemplates } = await supabase
    .from('custom_field_templates')
    .select('field_name, field_type')
    .eq('user_id', auth.profile.id)
    .order('display_order')

  const formData = await req.formData()
  const imageFile = formData.get('image') as File | null
  const rotatedImageFile = formData.get('image_rotated') as File | null

  const { data: record, error: recordError } = await supabase
    .from('surgical_records')
    .select('id, image_path')
    .eq('id', params.id)
    .eq('user_id', auth.profile.id)
    .single()

  if (recordError || !record) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
  }

  let primarySignedUrl: string | null = null
  let tempPrimary: Awaited<ReturnType<typeof uploadTempImage>> | null = null
  let tempRotated: Awaited<ReturnType<typeof uploadTempImage>> | null = null

  if (imageFile) {
    tempPrimary = await uploadTempImage(service, auth.profile.id, imageFile)
    if (!tempPrimary) {
      return NextResponse.json({ error: 'No se pudo preparar la imagen para releer' }, { status: 500 })
    }
    primarySignedUrl = tempPrimary.signedUrl
  } else if (record.image_path && record.image_path !== 'manual-entry') {
    const { data: signedData, error: signedError } = await service.storage
      .from('surgical-images')
      .createSignedUrl(record.image_path, 300)
    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json({ error: 'No se pudo acceder a la imagen guardada' }, { status: 500 })
    }
    primarySignedUrl = signedData.signedUrl
  } else {
    return NextResponse.json({ error: 'Este registro no tiene imagen para releer' }, { status: 400 })
  }

  if (rotatedImageFile) {
    tempRotated = await uploadTempImage(service, auth.profile.id, rotatedImageFile)
  }

  const model = userSettings.preferred_model ?? 'anthropic/claude-3.5-sonnet'
  const client = createOpenRouterClient(apiKey)

  let rawResponse: string
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: buildExtractionPrompt(customTemplates ?? []) },
          { type: 'image_url', image_url: { url: primarySignedUrl } },
          ...(tempRotated ? [{ type: 'image_url' as const, image_url: { url: tempRotated.signedUrl } }] : []),
        ],
      }],
      max_tokens: 1000,
      ...(MODELS_WITH_JSON_MODE.has(model) ? { response_format: { type: 'json_object' as const } } : {}),
    })
    rawResponse = completion.choices[0]?.message?.content ?? ''
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al releer imagen'
    return NextResponse.json({ error: message }, { status: 502 })
  } finally {
    const tempPaths = [tempPrimary?.path, tempRotated?.path].filter(Boolean) as string[]
    if (tempPaths.length > 0) {
      await service.storage.from('surgical-images').remove(tempPaths)
    }
  }

  const fields = normalizeSurgicalFields(parseAIResponse(rawResponse).fields)
  return NextResponse.json({
    record_id: record.id,
    extracted_data: fields,
  } satisfies AnalyzeResponse)
}

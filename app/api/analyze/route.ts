import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { decrypt } from '@/lib/crypto'
import { parseAIResponse } from '@/lib/ai-parser'
import { buildExtractionPrompt, createOpenRouterClient, MODELS_WITH_JSON_MODE } from '@/lib/openrouter'
import { insertSurgicalRecord, selectRecordForMerge, updateMergedRecord } from '@/lib/records-db'
import { mergeSurgicalFieldsFillNulls, normalizeSurgicalFields } from '@/lib/record-utils'
import { createServiceClient } from '@/lib/supabase/server'
import type { AnalyzeResponse, SurgicalFields } from '@/types'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX_SIZE_BYTES = 10 * 1024 * 1024

function safeImagePath(userId: string, mimeType: string): string {
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg').replace('heif', 'heic') ?? 'jpg'
  return `${userId}/${randomUUID()}.${ext}`
}

function validateImageFile(imageFile: File | null) {
  if (!imageFile) return 'No image provided'
  if (!ALLOWED_MIME.has(imageFile.type)) {
    return 'Formato no soportado. Usá JPG, PNG, WebP o HEIC.'
  }
  if (imageFile.size > MAX_SIZE_BYTES) {
    return 'Imagen demasiado grande (máximo 10MB)'
  }
  return null
}

async function uploadAndSign(service: Awaited<ReturnType<typeof createServiceClient>>, userId: string, file: File) {
  const path = safeImagePath(userId, file.type)
  const buffer = await file.arrayBuffer()
  const { error: uploadError } = await service.storage
    .from('surgical-images')
    .upload(path, buffer, { contentType: file.type })

  if (uploadError) {
    return { error: 'Error al subir imagen' as const }
  }

  const { data: signedData, error: signedError } = await service.storage
    .from('surgical-images')
    .createSignedUrl(path, 300)

  if (signedError || !signedData?.signedUrl) {
    await service.storage.from('surgical-images').remove([path])
    return { error: 'Error al procesar imagen' as const }
  }

  return { path, signedUrl: signedData.signedUrl }
}

export async function POST(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()

  const formData = await req.formData()
  const imageFile = formData.get('image') as File | null
  const rotatedImageFile = formData.get('image_rotated') as File | null
  const existingRecordId = formData.get('record_id')?.toString() ?? null
  const confirmDuplicate = formData.get('confirm_duplicate') === '1'

  const imageError = validateImageFile(imageFile)
  if (imageError) return NextResponse.json({ error: imageError }, { status: 400 })

  const rotatedError = rotatedImageFile ? validateImageFile(rotatedImageFile) : null
  if (rotatedError) return NextResponse.json({ error: rotatedError }, { status: 400 })

  const { data: userSettings } = await service
    .from('users')
    .select('openrouter_key, preferred_model')
    .eq('id', ctx.effectiveUserId)
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

  const { data: customTemplates } = await service
    .from('custom_field_templates')
    .select('field_name, field_type')
    .eq('user_id', ctx.effectiveUserId)
    .order('display_order')

  const primaryUpload = await uploadAndSign(service, ctx.effectiveUserId, imageFile!)
  if ('error' in primaryUpload) {
    return NextResponse.json({ error: primaryUpload.error }, { status: 500 })
  }

  let rotatedUpload: Awaited<ReturnType<typeof uploadAndSign>> | null = null
  if (rotatedImageFile) {
    rotatedUpload = await uploadAndSign(service, ctx.effectiveUserId, rotatedImageFile)
    if ('error' in rotatedUpload) {
      await service.storage.from('surgical-images').remove([primaryUpload.path])
      return NextResponse.json({ error: rotatedUpload.error }, { status: 500 })
    }
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
          { type: 'image_url', image_url: { url: primaryUpload.signedUrl } },
          ...(rotatedUpload ? [{ type: 'image_url' as const, image_url: { url: rotatedUpload.signedUrl } }] : []),
        ],
      }],
      max_tokens: 1000,
      ...(MODELS_WITH_JSON_MODE.has(model) ? { response_format: { type: 'json_object' as const } } : {}),
    })
    rawResponse = completion.choices[0]?.message?.content ?? ''
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al analizar imagen'
    await service.storage.from('surgical-images').remove(
      [primaryUpload.path, rotatedUpload?.path].filter(Boolean) as string[]
    )
    return NextResponse.json({ error: message }, { status: 502 })
  } finally {
    if (rotatedUpload) {
      await service.storage.from('surgical-images').remove([rotatedUpload.path])
    }
  }

  const fields = normalizeSurgicalFields(parseAIResponse(rawResponse).fields)

  if (!existingRecordId && !confirmDuplicate && fields.paciente && fields.fecha_cirugia) {
    const { data: existing } = await service
      .from('surgical_records')
      .select('id')
      .eq('user_id', ctx.effectiveUserId)
      .eq('final_data->>paciente', fields.paciente)
      .eq('final_data->>fecha_cirugia', fields.fecha_cirugia)
      .limit(1)

    if (existing?.length) {
      await service.storage.from('surgical-images').remove([primaryUpload.path])
      const response: AnalyzeResponse = {
        record_id: existing[0].id,
        extracted_data: fields,
        warning: 'duplicate',
        existing_id: existing[0].id,
      }
      return NextResponse.json(response)
    }
  }

  if (existingRecordId) {
    const { data: existingRecord, error: existingError } = await selectRecordForMerge(
      service,
      existingRecordId,
      ctx.effectiveUserId
    )

    if (existingError || !existingRecord) {
      await service.storage.from('surgical-images').remove([primaryUpload.path])
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
    }

    const mergedExtracted = mergeSurgicalFieldsFillNulls(
      normalizeSurgicalFields(existingRecord.extracted_data as SurgicalFields),
      fields
    )
    const mergedFinal = mergeSurgicalFieldsFillNulls(
      normalizeSurgicalFields(existingRecord.final_data as SurgicalFields),
      fields
    )
    const imagePaths = [...(existingRecord.image_paths ?? []), primaryUpload.path]

    const { error: updateError } = await updateMergedRecord(service, existingRecord.id, ctx.effectiveUserId, {
      extracted_data: mergedExtracted,
      final_data: mergedFinal,
      image_paths: imagePaths,
      updated_at: new Date().toISOString(),
    })

    if (updateError) {
      await service.storage.from('surgical-images').remove([primaryUpload.path])
      return NextResponse.json({ error: 'Error al guardar registro' }, { status: 500 })
    }

    return NextResponse.json({
      record_id: existingRecord.id,
      extracted_data: mergedExtracted,
    } satisfies AnalyzeResponse)
  }

  const { data: record, error: recordError } = await insertSurgicalRecord(service, {
    user_id: ctx.effectiveUserId,
    image_path: primaryUpload.path,
    image_paths: [primaryUpload.path],
    ai_raw_response: rawResponse,
    extracted_data: fields,
    final_data: fields,
    status: 'draft',
  })

  if (recordError || !record) {
    await service.storage.from('surgical-images').remove([primaryUpload.path])
    return NextResponse.json({ error: 'Error al guardar registro' }, { status: 500 })
  }

  const { error: auditError } = await service.from('audit_log').insert({
    user_id: ctx.profile.id,
    record_id: record.id,
    action: 'created',
    diff: fields,
  })
  if (auditError) console.error('[audit_log insert]', auditError.message)

  return NextResponse.json({
    record_id: record.id,
    extracted_data: fields,
  } satisfies AnalyzeResponse)
}

import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { selectRecordImagePaths } from '@/lib/records-db'
import { normalizeSurgicalFields, validateSurgicalFields } from '@/lib/record-utils'
import { createServiceClient } from '@/lib/supabase/server'
import type { RecordStatus, SurgicalFields } from '@/types'

function getImagePaths(record: { image_paths?: string[] | null; image_path?: string | null }) {
  if (record.image_paths && record.image_paths.length > 0) return record.image_paths
  if (record.image_path) return [record.image_path]
  return []
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('surgical_records')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', ctx.effectiveUserId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const imagePaths = getImagePaths(data)
  if (imagePaths.length === 0 || imagePaths[0] === 'manual-entry') {
    return NextResponse.json({ ...data, image_url: null, image_urls: [] })
  }

  const imageUrls = await Promise.all(imagePaths.map(async imagePath => {
    const { data: signed } = await service.storage
      .from('surgical-images')
      .createSignedUrl(imagePath, 3600)
    return signed?.signedUrl ?? null
  }))

  return NextResponse.json({
    ...data,
    image_url: imageUrls[0] ?? null,
    image_urls: imageUrls.filter((value): value is string => Boolean(value)),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const body = await req.json() as { final_data?: SurgicalFields; status?: RecordStatus }
  const normalizedFinalData = body.final_data ? normalizeSurgicalFields(body.final_data) : undefined

  if (normalizedFinalData) {
    const validationErrors = validateSurgicalFields(normalizedFinalData)
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: validationErrors[0], errors: validationErrors }, { status: 400 })
    }
  }

  const { data: current } = await service
    .from('surgical_records')
    .select('final_data')
    .eq('id', params.id)
    .eq('user_id', ctx.effectiveUserId)
    .single()

  const payload: { final_data?: SurgicalFields; status?: RecordStatus; updated_at: string } = {
    updated_at: new Date().toISOString(),
  }
  if (normalizedFinalData) payload.final_data = normalizedFinalData
  if (body.status) payload.status = body.status

  const { data, error } = await service
    .from('surgical_records')
    .update(payload)
    .eq('id', params.id)
    .eq('user_id', ctx.effectiveUserId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (normalizedFinalData && current?.final_data) {
    const diff: Partial<SurgicalFields> = {}
    const previous = normalizeSurgicalFields(current.final_data as SurgicalFields)

    for (const key of Object.keys(normalizedFinalData) as (keyof SurgicalFields)[]) {
      if (normalizedFinalData[key] !== previous[key]) {
        diff[key] = normalizedFinalData[key]
      }
    }

    if (Object.keys(diff).length > 0) {
      const { error: auditError } = await service.from('audit_log').insert({
        user_id: ctx.profile.id,
        record_id: params.id,
        action: 'edited',
        diff,
      })
      if (auditError) console.error('[audit_log insert]', auditError.message)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const service = await createServiceClient()
  const { data: record } = await selectRecordImagePaths(service, params.id, ctx.effectiveUserId)

  const { error } = await service
    .from('surgical_records')
    .delete()
    .eq('id', params.id)
    .eq('user_id', ctx.effectiveUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const imagePaths = getImagePaths(record ?? {})
  const removablePaths = imagePaths.filter(path => path !== 'manual-entry')
  if (removablePaths.length > 0) {
    await service.storage.from('surgical-images').remove(removablePaths)
  }

  return NextResponse.json({ ok: true })
}

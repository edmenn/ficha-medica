'use server'

import { revalidatePath } from 'next/cache'
import { requireOperationalContext } from '@/lib/auth/guards'
import { getImagePaths, selectRecordImagePaths } from '@/lib/records-db'
import { normalizeSurgicalFields, validateSurgicalFields } from '@/lib/record-utils'
import { createServiceClient } from '@/lib/supabase/server'
import { filterValidImagePaths } from '@/lib/storage-paths'
import type { SurgicalFields } from '@/types'

export async function updateRecordAction(id: string, finalData: SurgicalFields) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) throw new Error(ctx.error)

  const normalizedFinalData = normalizeSurgicalFields(finalData)
  const validationErrors = validateSurgicalFields(normalizedFinalData)
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0])
  }

  const service = await createServiceClient()

  const { data: current } = await service
    .from('surgical_records')
    .select('final_data')
    .eq('id', id)
    .eq('user_id', ctx.effectiveUserId)
    .maybeSingle()

  const { error } = await service
    .from('surgical_records')
    .update({
      final_data: normalizedFinalData,
      status: 'final',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', ctx.effectiveUserId)

  if (error) throw new Error(error.message)

  if (current?.final_data) {
    const previous = normalizeSurgicalFields(current.final_data as SurgicalFields)
    const diff: Partial<SurgicalFields> = {}
    for (const key of Object.keys(normalizedFinalData) as (keyof SurgicalFields)[]) {
      if (previous[key] !== normalizedFinalData[key]) diff[key] = normalizedFinalData[key]
    }
    if (Object.keys(diff).length > 0) {
      const { error: auditError } = await service.from('audit_log').insert({
        user_id: ctx.profile.id,
        effective_user_id: ctx.profile.id === ctx.effectiveUserId ? null : ctx.effectiveUserId,
        record_id: id,
        action: 'edited',
        diff: { previous, current: normalizedFinalData },
      })
      if (auditError) console.error('[audit_log insert]', auditError.message)
    }
  }

  revalidatePath(`/records/${id}`)
  revalidatePath('/records')
}

export async function deleteRecordAction(id: string) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) throw new Error(ctx.error)

  const service = await createServiceClient()
  const [{ data: record }, { data: recordMeta }] = await Promise.all([
    selectRecordImagePaths(service, id, ctx.effectiveUserId),
    service.from('surgical_records').select('final_data').eq('id', id).eq('user_id', ctx.effectiveUserId).maybeSingle(),
  ])

  // Registrar el borrado ANTES de eliminar (evita perder el detalle por la FK).
  const { error: auditError } = await service.from('audit_log').insert({
    user_id: ctx.profile.id,
    effective_user_id: ctx.profile.id === ctx.effectiveUserId ? null : ctx.effectiveUserId,
    record_id: id,
    action: 'deleted',
    diff: { deleted: true },
    meta: { patient: (recordMeta as { final_data?: { paciente?: string | null } } | null)?.final_data?.paciente ?? null },
  })
  if (auditError) console.error('[audit_log insert]', auditError.message)

  const { data: deletedRecord, error } = await service
    .from('surgical_records')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.effectiveUserId)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!deletedRecord) throw new Error('No se encontró el registro a borrar')

  const imagePaths = filterValidImagePaths(getImagePaths(record ?? {}), ctx.effectiveUserId)
  if (imagePaths.length > 0) {
    await service.storage.from('surgical-images').remove(imagePaths)
  }

  revalidatePath(`/records/${id}`)
  revalidatePath('/records')
}

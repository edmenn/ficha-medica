'use server'

import { revalidatePath } from 'next/cache'
import { requireOperationalContext } from '@/lib/auth/guards'
import { normalizeSurgicalFields, validateSurgicalFields } from '@/lib/record-utils'
import { createServiceClient } from '@/lib/supabase/server'
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

  revalidatePath(`/records/${id}`)
  revalidatePath('/records')
}

export async function deleteRecordAction(id: string) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) throw new Error(ctx.error)

  const service = await createServiceClient()
  const { error } = await service
    .from('surgical_records')
    .delete()
    .eq('id', id)
    .eq('user_id', ctx.effectiveUserId)

  if (error) throw new Error(error.message)

  revalidatePath('/records')
}

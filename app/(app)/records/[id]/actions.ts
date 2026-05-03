'use server'

import { revalidatePath } from 'next/cache'
import { requireOperationalUser } from '@/lib/auth'
import { normalizeSurgicalFields, validateSurgicalFields } from '@/lib/record-utils'
import { createClient } from '@/lib/supabase/server'
import type { SurgicalFields } from '@/types'

export async function updateRecordAction(id: string, finalData: SurgicalFields) {
  const auth = await requireOperationalUser()
  if ('error' in auth) {
    throw new Error(auth.error)
  }

  const normalizedFinalData = normalizeSurgicalFields(finalData)
  const validationErrors = validateSurgicalFields(normalizedFinalData)
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0])
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('surgical_records')
    .update({
      final_data: normalizedFinalData,
      status: 'final',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', auth.profile.id)

  if (error) throw new Error(error.message)

  revalidatePath(`/records/${id}`)
  revalidatePath('/records')
}

export async function deleteRecordAction(id: string) {
  const auth = await requireOperationalUser()
  if ('error' in auth) {
    throw new Error(auth.error)
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('surgical_records')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.profile.id)

  if (error) throw new Error(error.message)

  revalidatePath('/records')
}

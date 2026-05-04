import type { SupabaseClient } from '@supabase/supabase-js'
import type { SurgicalFields } from '@/types'

type RecordLike = {
  id: string
  image_path?: string | null
  image_paths?: string[] | null
  source_image_hash?: string | null
  extracted_data?: SurgicalFields
  final_data?: SurgicalFields
}

type SupabaseErrorLike = {
  code?: string
  message?: string
}

function isMissingColumn(error: SupabaseErrorLike | null | undefined, column: string) {
  return Boolean(
    error && (
      error.code === 'PGRST204' ||
      (error.message?.includes(column) && (
        error.message.includes('does not exist') ||
        error.message.includes('schema cache')
      ))
    )
  )
}

export function isMissingImagePathsColumn(error: SupabaseErrorLike | null | undefined) {
  return isMissingColumn(error, 'image_paths')
}

export function isMissingSourceImageHashColumn(error: SupabaseErrorLike | null | undefined) {
  return isMissingColumn(error, 'source_image_hash')
}

export function getImagePaths(record: { image_paths?: string[] | null; image_path?: string | null }) {
  if (record.image_paths && record.image_paths.length > 0) return record.image_paths
  if (record.image_path) return [record.image_path]
  return []
}

export async function insertSurgicalRecord(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  let result = await supabase.from('surgical_records').insert(payload).select().single()

  if (isMissingImagePathsColumn(result.error)) {
    const legacyPayload = { ...payload }
    delete legacyPayload.image_paths
    result = await supabase.from('surgical_records').insert(legacyPayload).select().single()
  }

  return result
}

export async function findRecordBySourceImageHash(
  supabase: SupabaseClient,
  userId: string,
  sourceImageHash: string
) {
  const result = await supabase
    .from('surgical_records')
    .select('id')
    .eq('user_id', userId)
    .eq('source_image_hash', sourceImageHash)
    .limit(1)

  if (isMissingSourceImageHashColumn(result.error)) {
    return { data: [], error: null }
  }

  return result
}

export async function selectRecordForMerge(
  supabase: SupabaseClient,
  id: string,
  userId: string
) {
  const result = await supabase
    .from('surgical_records')
    .select('id, image_path, image_paths, extracted_data, final_data')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (isMissingImagePathsColumn(result.error)) {
    const legacy = await supabase
      .from('surgical_records')
      .select('id, image_path, extracted_data, final_data')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (legacy.data) {
      return {
        ...legacy,
        data: {
          ...legacy.data,
          image_paths: getImagePaths(legacy.data as RecordLike),
        },
      }
    }

    return legacy
  }

  return result
}

export async function updateMergedRecord(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  payload: Record<string, unknown>
) {
  let result = await supabase
    .from('surgical_records')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)

  if (isMissingImagePathsColumn(result.error)) {
    const legacyPayload = { ...payload }
    delete legacyPayload.image_paths
    result = await supabase
      .from('surgical_records')
      .update(legacyPayload)
      .eq('id', id)
      .eq('user_id', userId)
  }

  return result
}

export async function selectRecordImagePaths(
  supabase: SupabaseClient,
  id: string,
  userId: string
) {
  const result = await supabase
    .from('surgical_records')
    .select('image_path, image_paths')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (isMissingImagePathsColumn(result.error)) {
    const legacy = await supabase
      .from('surgical_records')
      .select('image_path')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (legacy.data) {
      return {
        ...legacy,
        data: {
          ...legacy.data,
          image_paths: getImagePaths(legacy.data as RecordLike),
        },
      }
    }

    return legacy
  }

  return result
}

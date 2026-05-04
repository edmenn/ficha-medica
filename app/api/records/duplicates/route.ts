import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { findLogicalDuplicate } from '@/lib/record-duplicates'
import { normalizeSurgicalFields } from '@/lib/record-utils'
import { createServiceClient } from '@/lib/supabase/server'
import type { SurgicalFields } from '@/types'

export async function POST(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const body = await req.json() as {
    fields?: Partial<SurgicalFields>
    exclude_record_id?: string
  }

  const normalized = normalizeSurgicalFields(body.fields ?? {})
  if (!normalized.paciente || !normalized.fecha_cirugia) {
    return NextResponse.json({ existing_id: null })
  }

  const service = await createServiceClient()
  const { data, error } = await service
    .from('surgical_records')
    .select('id, final_data')
    .eq('user_id', ctx.effectiveUserId)
    .eq('final_data->>paciente', normalized.paciente)
    .eq('final_data->>fecha_cirugia', normalized.fecha_cirugia)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const duplicate = findLogicalDuplicate(data ?? [], normalized, body.exclude_record_id)
  return NextResponse.json({ existing_id: duplicate?.id ?? null })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireOperationalContext } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import { buildWorkbook } from '@/lib/export/excel'
import { buildPDF } from '@/lib/export/pdf'
import { compareDateStringsDesc, isDateInRange } from '@/lib/record-utils'
import type { ExportQuery } from '@/types'

export async function GET(req: NextRequest) {
  const ctx = await requireOperationalContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') as ExportQuery['format']
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const sanatorio = searchParams.get('sanatorio')

  if (!format || !from || !to) {
    return NextResponse.json({ error: 'format, from, and to are required' }, { status: 400 })
  }

  const service = await createServiceClient()
  let query = service
    .from('surgical_records')
    .select('*')
    .eq('status', 'final')
    .eq('user_id', ctx.effectiveUserId)

  if (sanatorio) {
    query = query.ilike("final_data->>'sanatorio'", `%${sanatorio}%`)
  }

  const { data: records, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filteredRecords = (records ?? [])
    .filter(record => isDateInRange(record.final_data?.fecha_cirugia, from, to))
    .sort((left, right) => {
      const byDate = compareDateStringsDesc(left.final_data?.fecha_cirugia, right.final_data?.fecha_cirugia)
      if (byDate !== 0) return byDate
      return right.created_at.localeCompare(left.created_at)
    })

  await service.from('audit_log').insert({
    user_id: ctx.profile.id,
    record_id: null,
    action: 'exported',
    diff: { format, from, to, sanatorio, count: filteredRecords.length },
  })

  if (format === 'xlsx') {
    const buffer = buildWorkbook(filteredRecords)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="registros-${from}-${to}.xlsx"`,
      },
    })
  }

  if (format === 'pdf') {
    const buffer = await buildPDF(filteredRecords, from, to)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="registros-${from}-${to}.pdf"`,
      },
    })
  }

  return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
}

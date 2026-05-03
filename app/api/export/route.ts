import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildWorkbook } from '@/lib/export/excel'
import { buildPDF } from '@/lib/export/pdf'
import type { ExportQuery } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') as ExportQuery['format']
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const sanatorio = searchParams.get('sanatorio')

  if (!format || !from || !to) {
    return NextResponse.json({ error: 'format, from, and to are required' }, { status: 400 })
  }

  let query = supabase
    .from('surgical_records')
    .select('*')
    .gte('final_data->>fecha_cirugia', from)
    .lte('final_data->>fecha_cirugia', to)
    .eq('status', 'final')
    .order('final_data->>fecha_cirugia')
    .order('created_at')

  if (sanatorio) {
    query = query.ilike("final_data->>'sanatorio'", `%${sanatorio}%`)
  }

  const { data: records, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    user_id: user.id,
    record_id: null,
    action: 'exported',
    diff: { format, from, to, sanatorio, count: records.length },
  })

  if (format === 'xlsx') {
    const buffer = buildWorkbook(records)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="registros-${from}-${to}.xlsx"`,
      },
    })
  }

  if (format === 'pdf') {
    const buffer = await buildPDF(records, from, to)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="registros-${from}-${to}.pdf"`,
      },
    })
  }

  return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
}

import { requireAdmin } from '@/lib/auth/guards'
import { createServiceClient } from '@/lib/supabase/server'
import AuditLogClient from '@/components/admin/audit/AuditLogClient'

export const dynamic = 'force-dynamic'

const AUDIT_LABELS: Record<string, string> = {
  created: 'Creación',
  edited: 'Edición',
  deleted: 'Borrado',
  exported: 'Exportación',
  reanalyzed: 'Relectura IA',
  impersonation_started: 'Impersonación iniciada',
  impersonation_ended: 'Impersonación finalizada',
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; record_id?: string; action?: string; from?: string; to?: string }>
}) {
  await requireAdmin()

  const sp = await searchParams
  const service = await createServiceClient()

  const q = sp?.q?.trim() ?? ''
  const recordId = sp?.record_id?.trim() ?? ''
  const action = sp?.action ?? ''
  const from = sp?.from ?? ''
  const to = sp?.to ?? ''

  let query = service
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(200)

  if (recordId) query = query.eq('record_id', recordId)
  if (action) query = query.eq('action', action)
  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59.999`)

  const { data: entries, count, error } = await query

  if (error) {
    return <p className="text-red-400">Error al cargar la auditoría: {error.message}</p>
  }

  const [actorsResult, actionResult] = await Promise.all([
    service.from('users').select('id, email, role').order('email'),
    service.from('audit_log').select('action').limit(1000),
  ])

  const availableActions = Array.from(new Set((actionResult.data ?? []).map(row => row.action))).sort()

  let filtered = entries ?? []

  // Filtro por email de actor (los filtros de registro/acción/fecha van en la query).
  if (q) {
    const actors = (actorsResult.data ?? []).filter(actor => actor.email?.toLowerCase().includes(q.toLowerCase()))
    const actorIds = new Set(actors.map(actor => actor.id))
    filtered = filtered.filter(entry => actorIds.has(entry.user_id))
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Auditoría clínica</h1>

      <AuditLogClient
        initialEntries={filtered}
        total={count ?? 0}
        actors={actorsResult.data ?? []}
        availableActions={availableActions}
        actionLabels={AUDIT_LABELS}
        initialQuery={{ q, record_id: recordId, action, from, to }}
      />
    </div>
  )
}

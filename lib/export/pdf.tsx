import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer
} from '@react-pdf/renderer'
import type { SurgicalRecord } from '@/types'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${day}-${month}-${d.getFullYear()} ${hour}:${min}`
}

function summarize(value: string | null | undefined, max = 60): string {
  if (!value) return ''
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
  },
  header: { marginBottom: 6 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  subtitle: { fontSize: 10, color: '#475569', marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  metaText: { fontSize: 9, color: '#64748b' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#cbd5e1', marginVertical: 10 },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#94a3b8',
  },
  summaryTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 6 },
  summaryRow: { flexDirection: 'row', marginBottom: 3 },
  summaryLabel: { width: 180, color: '#475569', fontSize: 9 },
  summaryValue: { flex: 1, fontSize: 9 },
  table: { marginTop: 12 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', paddingVertical: 4 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#334155' },
  td: { fontSize: 8, color: '#1e293b' },
  colDate: { width: '12%' },
  colPatient: { width: '22%' },
  colProc: { width: '28%' },
  colSurgeon: { width: '23%' },
  colSanatorio: { width: '15%' },
  detailSection: { marginTop: 14 },
  detailTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 5 },
  detailFieldRow: { flexDirection: 'row', marginBottom: 4 },
  detailLabel: { width: 130, color: '#475569', fontSize: 9 },
  detailValue: { flex: 1, fontSize: 9, lineHeight: 1.4 },
  emptyTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 8 },
  emptyText: { fontSize: 11, color: '#475569', lineHeight: 1.5 },
})

function RecordDetail({ record }: { record: SurgicalRecord }) {
  const f = record.final_data ?? {}
  const pairs: [string, string | null | undefined][] = [
    ['Paciente', f.paciente],
    ['Fecha de cirugía', f.fecha_cirugia],
    ['Diagnóstico', f.diagnostico],
    ['Procedimiento', f.procedimiento],
    ['Cirujano', f.cirujano],
    ['Ayudantes', f.ayudantes],
    ['Anestesiólogo', f.anestesiologo],
    ['Instrumentador', f.instrumentador],
    ['Sanatorio', f.sanatorio],
    ['Observaciones', f.observaciones],
  ]

  return (
    <View style={styles.detailSection} wrap>
      <Text style={styles.detailTitle}>{f.paciente ?? 'Sin nombre'}</Text>
      {pairs.filter(([, v]) => v).map(([label, value]) => (
        <View key={label} style={styles.detailFieldRow}>
          <Text style={styles.detailLabel}>{label}</Text>
          <Text style={styles.detailValue}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

function ReportDocument({
  records, from, to, sanatorio, emittedAt,
}: {
  records: SurgicalRecord[]
  from: string
  to: string
  sanatorio?: string
  emittedAt: string
}) {
  const total = records.length
  const bySanatorio = new Map<string, number>()
  const byCirujano = new Map<string, number>()
  for (const r of records) {
    const f = r.final_data ?? {}
    const s = f.sanatorio ?? 'Sin especificar'
    bySanatorio.set(s, (bySanatorio.get(s) ?? 0) + 1)
    const c = f.cirujano ?? 'Sin especificar'
    byCirujano.set(c, (byCirujano.get(c) ?? 0) + 1)
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Registros Quirúrgicos</Text>
          <Text style={styles.subtitle}>Reporte clínico · Período {from} — {to}</Text>
          {sanatorio && <Text style={styles.subtitle}>Sanatorio: {sanatorio}</Text>}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Emitido: {formatDateTime(emittedAt)}</Text>
            <Text style={styles.metaText}>Total de cirugías: {total}</Text>
          </View>
        </View>
        <View style={styles.divider} />

        <View>
          <Text style={styles.summaryTitle}>Resumen</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total de cirugías</Text><Text style={styles.summaryValue}>{total}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total de sanatorios</Text><Text style={styles.summaryValue}>{bySanatorio.size}</Text></View>
          <Text style={{ ...styles.summaryLabel, marginTop: 4 }}>Por sanatorio</Text>
          {Array.from(bySanatorio.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
            <View key={`s-${name}`} style={styles.summaryRow}><Text style={styles.summaryLabel}>{name}</Text><Text style={styles.summaryValue}>{count}</Text></View>
          ))}
          {byCirujano.size > 0 && (
            <>
              <Text style={{ ...styles.summaryLabel, marginTop: 4 }}>Por cirujano</Text>
              {Array.from(byCirujano.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                <View key={`c-${name}`} style={styles.summaryRow}><Text style={styles.summaryLabel}>{name}</Text><Text style={styles.summaryValue}>{count}</Text></View>
              ))}
            </>
          )}
        </View>

        <View style={styles.divider} />

        {records.length === 0 ? (
          <View>
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptyText}>
              No se encontraron cirugías en el período seleccionado. Ajustá el rango de fechas o los filtros e intentá de nuevo.
            </Text>
          </View>
        ) : (
          <>
            <View>
              <Text style={styles.summaryTitle}>Detalle</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, styles.colDate]}>Fecha</Text>
                <Text style={[styles.th, styles.colPatient]}>Paciente</Text>
                <Text style={[styles.th, styles.colProc]}>Procedimiento</Text>
                <Text style={[styles.th, styles.colSurgeon]}>Cirujano</Text>
                <Text style={[styles.th, styles.colSanatorio]}>Sanatorio</Text>
              </View>
              {records.map(r => {
                const f = r.final_data ?? {}
                return (
                  <View key={`t-${r.id}`} style={styles.tableRow}>
                    <Text style={[styles.td, styles.colDate]}>{f.fecha_cirugia ?? '—'}</Text>
                    <Text style={[styles.td, styles.colPatient]}>{summarize(f.paciente)}</Text>
                    <Text style={[styles.td, styles.colProc]}>{summarize(f.procedimiento ?? f.diagnostico)}</Text>
                    <Text style={[styles.td, styles.colSurgeon]}>{summarize(f.cirujano)}</Text>
                    <Text style={[styles.td, styles.colSanatorio]}>{summarize(f.sanatorio)}</Text>
                  </View>
                )
              })}
            </View>

            <View style={styles.divider} />
            <Text style={styles.summaryTitle}>Detalle por registro</Text>
            {records.map(r => <RecordDetail key={`d-${r.id}`} record={r} />)}
          </>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => (
            <>Página {pageNumber} de {totalPages}</>
          )}
          fixed
        />
      </Page>
    </Document>
  )
}

export async function buildPDF(
  records: SurgicalRecord[],
  from: string,
  to: string,
  sanatorio?: string,
  emittedAt?: string,
): Promise<Buffer> {
  return renderToBuffer(
    <ReportDocument
      records={records}
      from={from}
      to={to}
      sanatorio={sanatorio}
      emittedAt={emittedAt ?? new Date().toISOString()}
    />
  )
}

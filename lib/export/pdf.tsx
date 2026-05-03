import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer
} from '@react-pdf/renderer'
import type { SurgicalRecord } from '@/types'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1e293b' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#64748b', marginBottom: 20 },
  recordTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 4 },
  fieldRow: { flexDirection: 'row', marginBottom: 3 },
  fieldLabel: { width: 110, color: '#64748b', fontSize: 9 },
  fieldValue: { flex: 1, fontSize: 9 },
})

function RecordBlock({ record }: { record: SurgicalRecord }) {
  const f = record.final_data
  const pairs: [string, string | null][] = [
    ['Paciente', f.paciente], ['Fecha inicio', f.fecha_cirugia],
    ['Fecha fin', f.fecha_fin ?? null],
    ['Hora inicio', f.hora_inicio], ['Hora fin', f.hora_fin],
    ['Duración', f.duracion], ['Diagnóstico', f.diagnostico],
    ['Procedimiento', f.procedimiento], ['Cirujano', f.cirujano],
    ['Ayudantes', f.ayudantes], ['Anestesiólogo', f.anestesiologo],
    ['Instrumentador', f.instrumentador], ['Sanatorio', f.sanatorio],
    ['Observaciones', f.observaciones],
  ]
  return (
    <View wrap={false}>
      <Text style={styles.recordTitle}>{f.paciente ?? 'Sin nombre'}</Text>
      {pairs.filter(([, v]) => v).map(([label, value]) => (
        <View key={label} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

function ReportDocument({ records, from, to }: {
  records: SurgicalRecord[]
  from: string
  to: string
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Registros Quirúrgicos</Text>
        <Text style={styles.subtitle}>Período: {from} — {to} · Total: {records.length}</Text>
        {records.map(r => <RecordBlock key={r.id} record={r} />)}
      </Page>
    </Document>
  )
}

export async function buildPDF(records: SurgicalRecord[], from: string, to: string): Promise<Buffer> {
  return renderToBuffer(<ReportDocument records={records} from={from} to={to} />)
}

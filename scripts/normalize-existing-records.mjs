// Normaliza los campos de personas de los registros existentes aplicando la
// misma normalización que usa la app (MAYÚSCULAS, limpieza de nombres, títulos,
// ruido, dígitos). Dry-run por defecto; usá --apply para escribir en la DB.
//
// Uso:
//   set -a; source .env.local.prod-backup; set +a
//   node scripts/normalize-existing-records.mjs            # dry-run
//   node scripts/normalize-existing-records.mjs --apply    # escribe
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
}

const APPLY = process.argv.includes('--apply')
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Replica la normalización de lib/record-utils.ts (solo limpieza de personas).
const NOISE = new Set(['NO APLICA', 'SIN DATOS', 'S/D', 'SIN ESPECIFICAR', 'NO CORRESPONDE'])
const TITLES = { DR: 'DR.', DRA: 'DRA.', LIC: 'LIC.', ENF: 'ENF.', PROF: 'PROF.', PROFA: 'PROF.', TEC: 'TEC.' }
const PERSON_FIELDS = ['paciente', 'cirujano', 'ayudantes', 'anestesiologo', 'instrumentador']

function normalizePerson(value) {
  if (typeof value !== 'string') return value ?? null
  let text = value.trim().replace(/\s+/g, ' ')
  if (text === '') return null
  text = text.replace(/\d+/g, '').replace(/\s+/g, ' ').trim()
  text = text.replace(/^[\s,;.]+/, '').replace(/[\s,;.]+$/, '').trim()
  if (text === '') return null
  text = text.split(',').map(p => p.trim()).filter(p => p !== '' && !NOISE.has(p.toLocaleUpperCase('es'))).join(', ')
  text = text.replace(/(^|[\s,(])(DR\.?|DRA\.?|LIC\.?|ENF\.?|PROF\.?|PROFA\.?|TEC\.?)(?=[\s,]|$)/gi, (m, prefix, title) => {
    return `${prefix}${TITLES[title.toLocaleUpperCase('es')] ?? title}`
  })
  text = text.replace(/(DR\.|DRA\.|LIC\.|ENF\.|PROF\.)\s+(?=DR\.|DRA\.|LIC\.|ENF\.|PROF\.)/gi, '').trim()
  if (text === '') return null
  return text.toLocaleUpperCase('es')
}

function normalizeFields(fields) {
  if (!fields || typeof fields !== 'object') return fields
  const out = { ...fields }
  for (const field of PERSON_FIELDS) {
    const raw = fields[field]
    if (Array.isArray(raw)) {
      const parts = raw.map(normalizePerson).filter(Boolean)
      out[field] = parts.length > 0 ? parts.join(', ') : null
    } else {
      out[field] = normalizePerson(raw)
    }
  }
  return out
}

async function main() {
  const { data: records, error } = await supabase
    .from('surgical_records')
    .select('id, final_data, extracted_data')
    .in('status', ['final', 'reviewed'])

  if (error) throw new Error(`select: ${error.message}`)
  console.log(`Registros a revisar: ${records?.length ?? 0} (modo: ${APPLY ? 'APLICAR' : 'DRY-RUN'})`)

  let changed = 0
  for (const record of records ?? []) {
    const newFinal = normalizeFields(record.final_data)
    const newExtracted = normalizeFields(record.extracted_data)
    const finalChanged = JSON.stringify(newFinal) !== JSON.stringify(record.final_data)
    const extractedChanged = JSON.stringify(newExtracted) !== JSON.stringify(record.extracted_data)

    if (!finalChanged && !extractedChanged) continue
    changed++

    console.log(`\n[${record.id}]`)
    if (finalChanged) {
      for (const f of PERSON_FIELDS) {
        const before = record.final_data?.[f]
        const after = newFinal?.[f]
        if (before !== after) console.log(`  final_data.${f}: "${before}" -> "${after}"`)
      }
    }
    if (extractedChanged) {
      for (const f of PERSON_FIELDS) {
        const before = record.extracted_data?.[f]
        const after = newExtracted?.[f]
        if (before !== after) console.log(`  extracted_data.${f}: "${before}" -> "${after}"`)
      }
    }

    if (APPLY) {
      const payload = {}
      if (finalChanged) payload.final_data = newFinal
      if (extractedChanged) payload.extracted_data = newExtracted
      const { error: upErr } = await supabase.from('surgical_records').update(payload).eq('id', record.id)
      if (upErr) console.error(`  ERROR actualizando ${record.id}: ${upErr.message}`)
    }
  }

  console.log(`\nRegistros con cambios: ${changed}${APPLY ? ' (aplicados)' : ' (dry-run, usá --apply para escribir)'}`)
}

main().catch(err => { console.error(err.message); process.exit(1) })

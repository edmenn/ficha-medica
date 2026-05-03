import OpenAI from 'openai'
import type { CustomFieldTemplate } from '@/types'

export function createOpenRouterClient(apiKey: string) {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      'X-Title': 'Ficha Médica',
    },
  })
}

export const MODELS_WITH_JSON_MODE = new Set([
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-haiku',
  'google/gemini-pro-1.5',
])

export const BASE_EXTRACTION_PROMPT = `Analizá la imagen de este documento médico/quirúrgico y extraé los datos en formato JSON.

Devolvé SOLO el JSON con estos campos (usá null para los que no encuentres, nunca inventes):
{
  "paciente": string | null,
  "fecha_cirugia": string | null,
  "fecha_fin": string | null,
  "hora_inicio": string | null,
  "hora_fin": string | null,
  "duracion": string | null,
  "diagnostico": string | null,
  "procedimiento": string | null,
  "cirujano": string | null,
  "ayudantes": string | null,
  "anestesiologo": string | null,
  "instrumentador": string | null,
  "sanatorio": string | null,
  "observaciones": string | null
}

Reglas:
- La imagen puede venir rotada; imaginá rotarla hasta leerla correctamente antes de extraer
- No inventes información que no esté en el documento
- No confundas la fecha/hora de impresión de la hoja con la fecha/hora clínica de la cirugía
- fecha_cirugia es la fecha de inicio
- fecha_fin es la fecha de finalización si figura; si no figura, usá null
- Si ves una fecha corta como 21-04-26 o 21/04/26, interpretala como DD-MM-AA => 2026-04-21
- Fechas en formato YYYY-MM-DD si es posible
- Horas en formato HH:MM
- Si hay múltiples ayudantes, devolvelos todos en un solo string separados por coma
- Si el documento lista ayudantes en varias líneas, incluí todas las líneas
- Revisá todo el documento antes de responder; no omitas campos visibles aunque estén en tablas o columnas
- "instrumentador" puede aparecer como "instrumentadora", "instrumentista", "instrumentalista" o "arsenalera"
- "anestesiologo" puede aparecer como "anestesista" o "anestesiólogo/a"
- "fecha_fin" puede aparecer como fecha de finalización, fecha de cierre, fecha final o fecha de terminación
- "hora_fin" puede aparecer como hora final, hora de salida o hora de terminación
- "sanatorio" también puede aparecer como hospital o clínica`

export function buildExtractionPrompt(
  customFields: Pick<CustomFieldTemplate, 'field_name' | 'field_type'>[]
) {
  const customSection = customFields.length > 0
    ? `\nAdemás extraé estos campos adicionales:\n${customFields.map(field => `- "${field.field_name}": ${field.field_type}`).join('\n')}`
    : ''

  return `${BASE_EXTRACTION_PROMPT}${customSection}`
}

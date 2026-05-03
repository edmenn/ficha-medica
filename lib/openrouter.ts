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
- No confundas la fecha de impresión, emisión o cierre con la fecha clínica de la cirugía
- fecha_cirugia es solamente la fecha de inicio clínica del acto quirúrgico
- Si hay múltiples fechas, priorizá la fecha de cirugía/inicio/procedimiento
- Si ves una fecha corta como 21-04-26 o 21/04/26, interpretala como DD-MM-AA => 21-04-2026
- Devolvé fecha_cirugia siempre en formato DD-MM-AAAA
- Si hay múltiples ayudantes, devolvelos todos en un solo string separados por coma
- Si el documento lista ayudantes en varias líneas, incluí todas las líneas
- Revisá todo el documento antes de responder; no omitas campos visibles aunque estén en tablas o columnas
- "instrumentador" puede aparecer como "instrumentadora", "instrumentista", "instrumentalista" o "arsenalera"
- "anestesiologo" puede aparecer como "anestesista" o "anestesiólogo/a"
- "sanatorio" también puede aparecer como hospital o clínica`

export function buildExtractionPrompt(
  customFields: Pick<CustomFieldTemplate, 'field_name' | 'field_type'>[]
) {
  const customSection = customFields.length > 0
    ? `\nAdemás extraé estos campos adicionales:\n${customFields.map(field => `- "${field.field_name}": ${field.field_type}`).join('\n')}`
    : ''

  return `${BASE_EXTRACTION_PROMPT}${customSection}`
}

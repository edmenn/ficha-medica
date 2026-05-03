import OpenAI from 'openai'

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

export const EXTRACTION_PROMPT = `Analizá la imagen de este documento médico/quirúrgico y extraé los datos en formato JSON.

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
- No inventes información que no esté en el documento
- fecha_cirugia es la fecha de inicio
- fecha_fin es la fecha de finalización si figura; si no figura, usá null
- Fechas en formato YYYY-MM-DD si es posible
- Horas en formato HH:MM
- Si hay múltiples ayudantes, devolvelos todos en un solo string separados por coma
- Si el documento lista ayudantes en varias líneas, incluí todas las líneas`

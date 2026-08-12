export type UserRole = 'admin' | 'user'
export type RecordStatus = 'draft' | 'reviewed' | 'final'
export type AuditAction = 'created' | 'edited' | 'deleted' | 'exported' | 'reanalyzed' | 'impersonation_started' | 'impersonation_ended'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  is_active: boolean
  openrouter_key: string | null  // AES-256 encrypted ciphertext
  preferred_model: string | null
  created_at: string
}

export interface SurgicalFields {
  paciente: string | null
  fecha_cirugia: string | null
  diagnostico: string | null
  procedimiento: string | null
  cirujano: string | null
  ayudantes: string | null
  anestesiologo: string | null
  instrumentador: string | null
  sanatorio: string | null
  observaciones: string | null
  [key: string]: string | null  // custom fields
}

export interface SurgicalRecord {
  id: string
  user_id: string
  image_path: string
  image_paths: string[]
  source_image_hash?: string | null
  image_url?: string | null
  image_urls?: string[]
  ai_raw_response: unknown
  extracted_data: SurgicalFields
  final_data: SurgicalFields
  status: RecordStatus
  created_at: string
  updated_at: string
}

export interface Invitation {
  id: string
  email: string
  token: string
  invited_by: string
  accepted_at: string | null
  expires_at: string
  created_at?: string
}

export interface AuditEntry {
  id: string
  user_id: string
  record_id: string
  action: AuditAction
  diff: Partial<SurgicalFields>
  created_at: string
}

export interface AiUsageSummary {
  total_cost_usd: number | null
  total_requests: number
  total_tokens: number | null
  last_cost_usd: number | null
  last_at: string | null
}

// API response shapes
export interface AnalyzeResponse {
  record_id: string
  extracted_data: SurgicalFields
  warning?: 'duplicate'
  existing_id?: string | null
  duplicate_score?: number
}

export interface ExportQuery {
  format: 'xlsx' | 'pdf'
  from: string
  to: string
  sanatorio?: string
  status?: RecordStatus
}

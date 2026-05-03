export type UserRole = 'admin' | 'user'
export type RecordStatus = 'draft' | 'reviewed' | 'final'
export type AuditAction = 'created' | 'edited' | 'exported'
export type FieldType = 'text' | 'number' | 'date' | 'bool'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  openrouter_key: string | null  // AES-256 encrypted ciphertext
  preferred_model: string | null
  created_at: string
}

export interface SurgicalFields {
  paciente: string | null
  fecha_cirugia: string | null
  fecha_fin: string | null
  hora_inicio: string | null
  hora_fin: string | null
  duracion: string | null
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
  image_url?: string | null
  image_urls?: string[]
  ai_raw_response: unknown
  extracted_data: SurgicalFields
  final_data: SurgicalFields
  status: RecordStatus
  created_at: string
  updated_at: string
}

export interface CustomFieldTemplate {
  id: string
  user_id: string
  field_name: string
  field_type: FieldType
  is_required: boolean
  display_order: number
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

// API response shapes
export interface AnalyzeResponse {
  record_id: string
  extracted_data: SurgicalFields
  warning?: 'duplicate'
  existing_id?: string
}

export interface ExportQuery {
  format: 'xlsx' | 'pdf'
  from: string   // ISO date
  to: string     // ISO date
  sanatorio?: string
  status?: RecordStatus
}

import { render, screen } from '@testing-library/react'
import RecordDetailClient from '@/components/records/RecordDetailClient'
import type { CustomFieldTemplate, SurgicalRecord } from '@/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/app/(user)/records/[id]/actions', () => ({
  updateRecordAction: vi.fn(),
  deleteRecordAction: vi.fn(),
}))

vi.mock('@/components/records/RecordForm', () => ({
  default: () => <div>Record form</div>,
}))

const baseRecord: SurgicalRecord = {
  id: 'record-1',
  user_id: 'user-1',
  image_path: 'manual-entry',
  image_paths: ['manual-entry'],
  image_url: null,
  image_urls: [],
  ai_raw_response: null,
  extracted_data: {
    paciente: 'Juan',
    fecha_cirugia: '04-05-2026',
    diagnostico: null,
    procedimiento: 'Artroscopia',
    cirujano: null,
    ayudantes: null,
    anestesiologo: null,
    instrumentador: null,
    sanatorio: null,
    observaciones: null,
  },
  final_data: {
    paciente: 'Juan',
    fecha_cirugia: '04-05-2026',
    diagnostico: null,
    procedimiento: 'Artroscopia',
    cirujano: null,
    ayudantes: null,
    anestesiologo: null,
    instrumentador: null,
    sanatorio: null,
    observaciones: null,
  },
  status: 'draft',
  created_at: '2026-05-04T00:00:00.000Z',
  updated_at: '2026-05-04T00:00:00.000Z',
}

describe('RecordDetailClient', () => {
  it('hides the AI reread action for manual-only records', () => {
    render(<RecordDetailClient record={baseRecord} customFields={[] as CustomFieldTemplate[]} />)

    expect(screen.queryByRole('button', { name: /releer con ia/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /borrar/i })).toBeInTheDocument()
  })
})

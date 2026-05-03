import Image from 'next/image'
import Link from 'next/link'
import RecordForm from '@/components/records/RecordForm'
import type { CustomFieldTemplate, SurgicalRecord } from '@/types'

interface Props {
  userId: string
  record: SurgicalRecord
  customFields: CustomFieldTemplate[]
}

export default function AdminRecordDetailPage({ userId, record, customFields }: Props) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Registro supervisado</p>
          <h1 className="text-2xl font-bold text-white">{record.final_data.paciente ?? 'Sin nombre'}</h1>
          <p className="mt-1 text-sm text-slate-400">{record.final_data.fecha_cirugia ?? 'Sin fecha'}</p>
        </div>
        <Link href={`/admin/users/${userId}`} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">
          Volver
        </Link>
      </div>

      {record.image_urls && record.image_urls.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {record.image_urls.map((imageUrl, index) => (
            <div key={`${imageUrl}-${index}`} className="relative h-72 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
              <Image
                src={imageUrl}
                alt={`Documento ${index + 1}`}
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
        Vista de solo lectura para administración.
      </div>

      <RecordForm
        fields={record.final_data}
        extractedFields={record.extracted_data}
        customFields={customFields}
        onChange={() => undefined}
        onSave={() => undefined}
        readOnly
      />
    </div>
  )
}

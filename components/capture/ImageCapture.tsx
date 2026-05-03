'use client'

import { useRef } from 'react'

interface Props {
  onImageSelected: (file: File) => void
  disabled?: boolean
}

export default function ImageCapture({ onImageSelected, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onImageSelected(file)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-200">
        Para mejores resultados, subí la ficha derecha y en posición vertical. Las imágenes rotadas suelen extraer peor.
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => cameraInputRef.current?.click()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-4 rounded-xl flex items-center justify-center gap-3 text-lg"
      >
        📷 Tomar foto
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2"
      >
        🖼️ Subir imagen existente
      </button>
      <p className="text-center text-xs text-slate-500">JPG · PNG · HEIC · PDF</p>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

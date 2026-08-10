'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onImageSelected: (file: File) => void
  onManualEntry?: () => void
  disabled?: boolean
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export default function ImageCapture({ onImageSelected, onManualEntry, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [folderImages, setFolderImages] = useState<File[]>([])
  const [folderPreviews, setFolderPreviews] = useState<string[]>([])

  useEffect(() => {
    return () => {
      folderPreviews.forEach(url => URL.revokeObjectURL(url))
    }
  }, [folderPreviews])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onImageSelected(file)
  }

  function handleFolderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const images = files.filter(file => ALLOWED_TYPES.has(file.type))
    if (images.length === 0) return

    folderPreviews.forEach(url => URL.revokeObjectURL(url))
    setFolderImages(images)
    setFolderPreviews(images.map(file => URL.createObjectURL(file)))
    e.target.value = ''
  }

  function handlePickFromFolder(file: File) {
    onImageSelected(file)
    closeFolderPicker()
  }

  function closeFolderPicker() {
    setFolderImages([])
    setFolderPreviews([])
  }

  if (folderImages.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">
            {folderImages.length} imagen{folderImages.length !== 1 ? 'es' : ''} encontrada{folderImages.length !== 1 ? 's' : ''}
          </h2>
          <button
            type="button"
            disabled={disabled}
            onClick={closeFolderPicker}
            className="text-sm text-slate-400 hover:text-white"
          >
            Volver
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {folderImages.map((file, index) => (
            <button
              key={index}
              type="button"
              disabled={disabled}
              onClick={() => handlePickFromFolder(file)}
              className="relative aspect-square overflow-hidden rounded-lg border border-slate-700 bg-slate-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={folderPreviews[index]}
                alt={`Captura ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-slate-500">Tocá una imagen para cargarla</p>
      </div>
    )
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
      <button
        type="button"
        disabled={disabled}
        onClick={() => folderInputRef.current?.click()}
        className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2"
      >
        📁 Importar de una carpeta (capturas)
      </button>
      {onManualEntry && (
        <button
          type="button"
          disabled={disabled}
          onClick={onManualEntry}
          className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 text-sm font-medium text-slate-200 disabled:opacity-50"
        >
          Cargar manualmente
        </button>
      )}
      <p className="text-center text-xs text-slate-500">JPG · PNG · HEIC</p>
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
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory no está tipado en el DOM
        webkitdirectory=""
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={handleFolderChange}
      />
    </div>
  )
}

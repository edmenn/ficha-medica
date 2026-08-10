const MAX_SIZE_BYTES = 500 * 1024  // 500KB
const MAX_DIMENSION = 1920
export const UPLOAD_MAX_SIZE_BYTES = 10 * 1024 * 1024  // 10MB

const ACCEPTED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export type DetectedImageType = 'jpeg' | 'png' | 'webp' | 'heic' | null

export async function detectImageType(file: File): Promise<DetectedImageType> {
  try {
    const buf = await file.slice(0, 16).arrayBuffer()
    const bytes = new Uint8Array(buf)

    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'jpeg'
    }
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'png'
    }
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return 'webp'
    }
    const ascii = Array.from(bytes).map(b => String.fromCharCode(b)).join('')
    if (ascii.includes('ftyp')) return 'heic'
    return null
  } catch {
    return null
  }
}

export async function validateImageForUpload(file: File): Promise<string | null> {
  if (!file) return 'No se seleccionó ninguna imagen'

  if (file.size > UPLOAD_MAX_SIZE_BYTES) {
    return 'Imagen demasiado grande (máximo 10MB)'
  }

  const type = await detectImageType(file)
  const mimeOk = ACCEPTED_MIME.has(file.type)

  if (!mimeOk && !type) {
    return 'Formato no soportado. Usá JPG, PNG, WebP o HEIC.'
  }

  return null
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = reject
    img.src = url
  })
}

function drawToCanvas(img: HTMLImageElement, rotate = false) {
  const canvas = document.createElement('canvas')
  let width = img.width
  let height = img.height

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  canvas.width = rotate ? height : width
  canvas.height = rotate ? width : height

  const ctx = canvas.getContext('2d')!
  if (rotate) {
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(img, -width / 2, -height / 2, width, height)
  } else {
    ctx.drawImage(img, 0, 0, width, height)
  }

  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, maxBytes = MAX_SIZE_BYTES): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let quality = 0.85
    const tryCompress = () => {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Canvas toBlob failed')); return }
        if (blob.size <= maxBytes || quality <= 0.3) { resolve(blob); return }
        quality -= 0.1
        tryCompress()
      }, 'image/jpeg', quality)
    }
    tryCompress()
  })
}

export function needsHeicConversion(file: File): boolean {
  return file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 }) as Blob
  return new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' })
}

export async function compressImage(file: File, maxBytes = MAX_SIZE_BYTES): Promise<Blob> {
  const img = await loadImage(file)
  const canvas = drawToCanvas(img)
  return canvasToBlob(canvas, maxBytes)
}

export async function prepareImageForUpload(file: File): Promise<File> {
  let processed: File = file
  if (needsHeicConversion(file)) {
    processed = await convertHeicToJpeg(file)
  }
  const compressed = await compressImage(processed)
  return new File([compressed], processed.name, { type: 'image/jpeg' })
}

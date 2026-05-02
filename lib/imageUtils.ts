const MAX_SIZE_BYTES = 500 * 1024  // 500KB
const MAX_DIMENSION = 1920

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
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

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
    }
    img.onerror = reject
    img.src = url
  })
}

export async function prepareImageForUpload(file: File): Promise<File> {
  let processed: File = file
  if (needsHeicConversion(file)) {
    processed = await convertHeicToJpeg(file)
  }
  const compressed = await compressImage(processed)
  return new File([compressed], processed.name, { type: 'image/jpeg' })
}

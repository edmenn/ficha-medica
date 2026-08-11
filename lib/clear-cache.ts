'use client'

// Limpia las caches del service worker y los registros de SW para forzar
// que la app cargue la última versión desplegada. No borra datos del usuario
// en Supabase: solo el caché local de archivos estáticos de la app.

export async function clearAppCache(): Promise<{ cleared: number; swUnregistered: boolean }> {
  let cleared = 0

  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map(async key => {
      await caches.delete(key)
      cleared += 1
    }))
  }

  let swUnregistered = false
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(async reg => {
      await reg.unregister()
      swUnregistered = true
    }))
  }

  return { cleared, swUnregistered }
}

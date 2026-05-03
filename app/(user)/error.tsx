'use client'

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-12 text-center">
      <p className="mb-4 text-red-400">{error.message}</p>
      <button onClick={reset} className="text-sm text-slate-400 underline">
        Reintentar
      </button>
    </div>
  )
}

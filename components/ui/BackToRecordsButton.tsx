'use client'

import { useRouter } from 'next/navigation'

export default function BackToRecordsButton() {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.push('/records')}
      className="text-slate-400"
      aria-label="←"
    >
      ←
    </button>
  )
}

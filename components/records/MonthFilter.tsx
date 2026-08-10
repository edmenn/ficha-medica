'use client'

import { useRouter } from 'next/navigation'

export interface MonthOption {
  value: string
  label: string
}

interface MonthFilterProps {
  months: MonthOption[]
  currentMonth?: string
  pageSize: number
}

export default function MonthFilter({ months, currentMonth, pageSize }: MonthFilterProps) {
  const router = useRouter()

  function handleChange(month: string) {
    const params = new URLSearchParams()
    params.set('page', '1')
    params.set('pageSize', String(pageSize))
    if (month) params.set('month', month)
    const qs = params.toString()
    router.push(qs ? `/records?${qs}` : '/records')
  }

  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">Mes</label>
      <select
        value={currentMonth ?? ''}
        onChange={e => handleChange(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
      >
        <option value="">Todos</option>
        {months.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

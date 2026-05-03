'use client'

import { useEffect, useId, useState, useDeferredValue } from 'react'

interface Props {
  field: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function Combobox({ field, value, onChange, placeholder = '—', className }: Props) {
  const listId = useId()
  const deferredQuery = useDeferredValue(value)
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    const controller = new AbortController()
    const query = deferredQuery.trim()

    fetch(`/api/search/suggestions?field=${encodeURIComponent(field)}&q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar sugerencias')
        setSuggestions(data.suggestions ?? [])
      })
      .catch(() => setSuggestions([]))

    return () => controller.abort()
  }, [deferredQuery, field])

  return (
    <>
      <input
        type="text"
        list={listId}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className={className}
      />
      <datalist id={listId}>
        {suggestions.map(option => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  )
}

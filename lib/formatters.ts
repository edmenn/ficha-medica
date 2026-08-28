const paraguayanDecimal = new Intl.NumberFormat('es-PY', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

export function formatUsd(value: number): string {
  return `US$ ${paraguayanDecimal.format(value)}`
}

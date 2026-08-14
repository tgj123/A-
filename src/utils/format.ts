export function formatAmount(value: number, signed = true): string {
  const abs = Math.abs(value)
  const sign = signed ? (value > 0 ? '+' : value < 0 ? '−' : '') : ''
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}亿`
  if (abs >= 10_000) return `${sign}${(abs / 10_000).toFixed(0)}万`
  return `${sign}${abs.toFixed(0)}`
}

export function formatDate(date: string): string {
  return date.replaceAll('-', '.')
}

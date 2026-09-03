export interface MarketFlowPoint {
  time: string
  main: number
  superLarge: number
  large: number
  medium: number
  small: number
}

function toFiniteNumber(value: string | undefined): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseMarketFlowRows(rows: string[]): MarketFlowPoint[] {
  return rows.flatMap((row) => {
    const fields = row.split(',')
    const values = fields.slice(1, 6).map(toFiniteNumber)
    if (values.length !== 5 || values.some((value) => value === null)) return []
    const [main, small, medium, large, superLarge] = values
    return [{
      time: fields[0] ?? '',
      main: main ?? 0,
      small: small ?? 0,
      medium: medium ?? 0,
      large: large ?? 0,
      superLarge: superLarge ?? 0,
    }]
  })
}

export function mergeMarketFlowSeries(series: MarketFlowPoint[][]): MarketFlowPoint[] {
  const merged = new Map<string, MarketFlowPoint>()
  for (const points of series) {
    for (const point of points) {
      const current = merged.get(point.time)
      if (!current) {
        merged.set(point.time, { ...point })
        continue
      }
      current.main += point.main
      current.superLarge += point.superLarge
      current.large += point.large
      current.medium += point.medium
      current.small += point.small
    }
  }
  return [...merged.values()].sort((left, right) => left.time.localeCompare(right.time))
}

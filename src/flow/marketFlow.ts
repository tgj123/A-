export interface MarketFlowPoint {
  time: string
  inflow: number
  outflow: number
  net: number
  largeBuy: number
  largeSell: number
}

export function getMarketFlowAtOrBefore(series: MarketFlowPoint[], targetTime: string): MarketFlowPoint | null {
  let active: MarketFlowPoint | null = null
  for (const point of series) {
    if (point.time > targetTime) break
    active = point
  }
  return active
}

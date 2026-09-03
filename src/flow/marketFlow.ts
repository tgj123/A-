export interface MarketFlowPoint {
  time: string
  inflow: number
  outflow: number
  net: number
  largeBuy: number
  largeSell: number
}

export interface MarketFlowCard {
  label: string
  value: number
  progress: number
}

function progressRatio(value: number, scaleMax: number): number {
  if (scaleMax <= 0) return 0
  return Math.min(1, Math.abs(value) / scaleMax)
}

function asOutflow(value: number): number {
  return value === 0 ? 0 : -Math.abs(value)
}

export function buildMarketFlowCards(point: MarketFlowPoint): MarketFlowCard[] {
  const marketScale = Math.max(Math.abs(point.inflow), Math.abs(point.outflow))
  const largeOrderScale = Math.max(Math.abs(point.largeBuy), Math.abs(point.largeSell))

  return [
    { label: '市场流入', value: point.inflow, progress: progressRatio(point.inflow, marketScale) },
    { label: '市场流出', value: asOutflow(point.outflow), progress: progressRatio(point.outflow, marketScale) },
    { label: '市场净额', value: point.net, progress: progressRatio(point.net, marketScale) },
    { label: '大单买入', value: point.largeBuy, progress: progressRatio(point.largeBuy, largeOrderScale) },
    { label: '大单卖出', value: asOutflow(point.largeSell), progress: progressRatio(point.largeSell, largeOrderScale) },
  ]
}

export function getMarketFlowAtOrBefore(series: MarketFlowPoint[], targetTime: string): MarketFlowPoint | null {
  let active: MarketFlowPoint | null = null
  for (const point of series) {
    if (point.time > targetTime) break
    active = point
  }
  return active
}

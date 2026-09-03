export type SessionKey = 'morning' | 'afternoon' | 'summary'

export interface MinuteFlowPoint {
  time: string
  value: number
}

export type BoardSourceType = 'industry' | 'concept'

export interface SectorFlow {
  code: string
  name: string
  sourceType: BoardSourceType
  inflow: number
  outflow: number
  netInflow: number
  mainInflow?: number
  mainOutflow?: number
  changePercent: number
  leadingStock: string
  rank: number
  turnover: number
  turnoverRate: number
  amplitude: number
  heatScore: number
  minuteFlow: MinuteFlowPoint[]
}

export interface SessionFlow {
  key: Exclude<SessionKey, 'summary'>
  label: string
  range: string
  totalNetInflow: number
  sectors: SectorFlow[]
}

export interface MarketFlowSnapshot {
  time: string
  inflow: number
  outflow: number
  net: number
  largeBuy: number
  largeSell: number
}

export interface DailyFundFlow {
  tradingDate: string
  source: 'mock' | 'tonghuashun'
  sourceLabel: string
  sessionMethod: 'official-snapshot' | 'mock'
  marketFlow: MarketFlowSnapshot[]
  morning: SessionFlow
  afternoon: SessionFlow
}

export interface TencentFundFlowConfig {
  endpoint?: string
  appId?: string
  timeoutMs?: number
}

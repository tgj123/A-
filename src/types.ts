export type SessionKey = 'morning' | 'afternoon' | 'summary'

export interface MinuteFlowPoint {
  time: string
  value: number
}

export interface SectorFlow {
  code: string
  name: string
  netInflow: number
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

export interface DailyFundFlow {
  tradingDate: string
  source: 'mock' | 'tencent'
  sourceLabel: string
  sessionMethod: 'official-snapshot' | 'turnover-estimate' | 'mock'
  morning: SessionFlow
  afternoon: SessionFlow
}

export interface TencentFundFlowConfig {
  endpoint?: string
  appId?: string
  timeoutMs?: number
}

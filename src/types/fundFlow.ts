export type MarketSession = 'morning' | 'afternoon' | 'summary'
export type PlaybackState = 'playing' | 'paused' | 'ended'
export type DataMode = 'mock' | 'tencent'

export interface SectorFundFlow {
  sectorCode: string
  sectorName: string
  netInflow: number
  mainInflow: number
  mainOutflow: number
  changePercent: number
  rank: number
  leadingStock?: string
}

export interface SessionFundFlow {
  session: Exclude<MarketSession, 'summary'>
  label: string
  timeRange: string
  totalNetInflow: number
  sectors: SectorFundFlow[]
}

export interface DailyFundFlow {
  tradingDate: string
  sourceLabel: string
  dataMode: DataMode
  fetchedAt: string
  morning: SessionFundFlow
  afternoon: SessionFundFlow
}

export interface TencentAdapterConfig {
  endpoint: string
  appId?: string
  timeoutMs?: number
}

import { describe, expect, it } from 'vitest'
import { getMarketFlowAtOrBefore, type MarketFlowPoint } from './marketFlow'

const series: MarketFlowPoint[] = [
  { time: '09:30', inflow: 10, outflow: 8, net: 2, largeBuy: 4, largeSell: 3 },
  { time: '09:32', inflow: 20, outflow: 12, net: 8, largeBuy: 7, largeSell: 5 },
  { time: '13:30', inflow: 30, outflow: 18, net: 12, largeBuy: 10, largeSell: 6 },
]

describe('getMarketFlowAtOrBefore', () => {
  it('按实际播放时间取不晚于目标分钟的最近快照', () => {
    expect(getMarketFlowAtOrBefore(series, '09:31')?.time).toBe('09:30')
    expect(getMarketFlowAtOrBefore(series, '09:32')?.net).toBe(8)
  })

  it('午休缺口沿用上午最后一份有效快照', () => {
    expect(getMarketFlowAtOrBefore(series, '12:00')?.time).toBe('09:32')
  })

  it('目标早于第一份快照时返回空', () => {
    expect(getMarketFlowAtOrBefore(series, '09:29')).toBeNull()
  })
})

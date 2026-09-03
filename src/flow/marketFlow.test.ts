import { describe, expect, it } from 'vitest'
import { buildMarketFlowCards, getMarketFlowAtOrBefore, type MarketFlowPoint } from './marketFlow'

const series: MarketFlowPoint[] = [
  { time: '09:30', inflow: 10, outflow: 8, net: 2, largeBuy: 4, largeSell: 3 },
  { time: '09:32', inflow: 20, outflow: 12, net: 8, largeBuy: 7, largeSell: 5 },
  { time: '13:30', inflow: 30, outflow: 18, net: 12, largeBuy: 10, largeSell: 6 },
]

describe('buildMarketFlowCards', () => {
  it('市场流入流出共用比例尺，净额按同一市场总额比例计算', () => {
    expect(buildMarketFlowCards({
      time: '09:30',
      inflow: 80,
      outflow: 100,
      net: -20,
      largeBuy: 0,
      largeSell: 0,
    })).toEqual([
      { label: '市场流入', value: 80, progress: 0.8 },
      { label: '市场流出', value: -100, progress: 1 },
      { label: '市场净额', value: -20, progress: 0.2 },
      { label: '大单买入', value: 0, progress: 0 },
      { label: '大单卖出', value: 0, progress: 0 },
    ])
  })

  it('大单买入卖出使用独立比例尺，不受市场总额量级影响', () => {
    const cards = buildMarketFlowCards({
      time: '09:31',
      inflow: 1_000,
      outflow: 900,
      net: 100,
      largeBuy: 30,
      largeSell: 60,
    })

    expect(cards[3]).toEqual({ label: '大单买入', value: 30, progress: 0.5 })
    expect(cards[4]).toEqual({ label: '大单卖出', value: -60, progress: 1 })
  })
})

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

import { describe, expect, it } from 'vitest'
import { mergeMarketFlowSeries, parseMarketFlowRows } from './marketFlow'

describe('parseMarketFlowRows', () => {
  it('解析分钟资金字段并保留时间顺序', () => {
    expect(parseMarketFlowRows([
      '09:31,-100,10,20,-30,40',
      '09:32,-80,12,18,-20,30',
    ])).toEqual([
      { time: '09:31', main: -100, small: 10, medium: 20, large: -30, superLarge: 40 },
      { time: '09:32', main: -80, small: 12, medium: 18, large: -20, superLarge: 30 },
    ])
  })

  it('忽略字段不完整或包含非数字的行', () => {
    expect(parseMarketFlowRows([
      '09:31,-100,10,20,-30',
      '09:32,-80,12,18,-20,30',
      '09:33,bad,1,2,3,4',
    ])).toHaveLength(1)
  })
})

describe('mergeMarketFlowSeries', () => {
  it('按分钟合并沪深市场资金数据', () => {
    expect(mergeMarketFlowSeries([
      [{ time: '09:31', main: 1, small: 2, medium: 3, large: 4, superLarge: 5 }],
      [{ time: '09:31', main: 10, small: 20, medium: 30, large: 40, superLarge: 50 }],
    ])).toEqual([
      { time: '09:31', main: 11, small: 22, medium: 33, large: 44, superLarge: 55 },
    ])
  })
})

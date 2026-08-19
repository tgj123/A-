import { describe, expect, it } from 'vitest'
import { calculateBoardHeatScore, selectPinnedBoards, selectPublicBoards } from './boardScoring'

describe('calculateBoardHeatScore', () => {
  it('只按资金流、涨跌幅和振幅的 70/20/10 权重计算', () => {
    expect(calculateBoardHeatScore({
      flow: 0.8,
      change: 0.5,
      amplitude: 0.3,
    })).toBeCloseTo(0.69)
  })
})

describe('selectPinnedBoards', () => {
  it('固定保留七个指定方向并用评分靠前板块补足名额', () => {
    const boards = [
      '医药', '创新药', '白酒', '半导体', 'CPO', '存储芯片', '人形机器人',
      '高分A', '高分B', '低分C',
    ].map((name, index) => ({ name, heatScore: index < 7 ? 0 : 10 - index }))

    const selected = selectPinnedBoards(boards, 8)

    expect(selected.map((item) => item.name)).toEqual([
      '医药', '创新药', '白酒', '半导体', 'CPO', '存储芯片', '人形机器人', '高分A',
    ])
  })
})

describe('selectPublicBoards', () => {
  it('同时保留固定板块及资金和涨跌幅前后四名', () => {
    const pinned = ['医药', '创新药', '白酒', '半导体', 'CPO', '存储芯片', '人形机器人']
      .map((name) => ({ name, heatScore: 0, netInflow: 0, changePercent: 0 }))
    const inflows = Array.from({ length: 4 }, (_, index) => ({
      name: `流入${index}`, heatScore: 0, netInflow: 100 - index, changePercent: 0,
    }))
    const outflows = Array.from({ length: 4 }, (_, index) => ({
      name: `流出${index}`, heatScore: 0, netInflow: -100 + index, changePercent: 0,
    }))
    const gains = Array.from({ length: 4 }, (_, index) => ({
      name: `涨幅${index}`, heatScore: 0, netInflow: 0, changePercent: 10 - index,
    }))
    const losses = Array.from({ length: 4 }, (_, index) => ({
      name: `跌幅${index}`, heatScore: 0, netInflow: 0, changePercent: -10 + index,
    }))

    const selected = selectPublicBoards([...pinned, ...inflows, ...outflows, ...gains, ...losses], 24)
    const names = new Set(selected.map((item) => item.name))

    expect(pinned.every((item) => names.has(item.name))).toBe(true)
    expect(inflows.every((item) => names.has(item.name))).toBe(true)
    expect(outflows.every((item) => names.has(item.name))).toBe(true)
    expect(gains.every((item) => names.has(item.name))).toBe(true)
    expect(losses.every((item) => names.has(item.name))).toBe(true)
  })
})

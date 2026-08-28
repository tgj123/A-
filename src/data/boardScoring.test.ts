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
  it('固定保留九个指定方向并用评分靠前板块补足名额', () => {
    const boards = [
      '医药', '创新药', '白酒', '半导体', 'CPO', '存储芯片', '人形机器人', '商业航天', '黄金',
      '高分A', '高分B', '低分C',
    ].map((name, index) => ({ name, heatScore: index < 9 ? 0 : 12 - index }))

    const selected = selectPinnedBoards(boards, 10)

    expect(selected.map((item) => item.name)).toEqual([
      '医药', '创新药', '白酒', '半导体', 'CPO', '存储芯片', '人形机器人', '商业航天', '黄金', '高分A',
    ])
  })
})

describe('selectPublicBoards', () => {
  it('候选池容量有限时优先保留九个固定板块', () => {
    const pinned = ['医药', '创新药', '白酒', '半导体', 'CPO', '存储芯片', '人形机器人', '商业航天', '黄金']
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
    const boards = [...pinned, ...inflows, ...outflows, ...gains, ...losses]

    const limited = selectPublicBoards(boards, 24)
    const complete = selectPublicBoards(boards, 25)
    const limitedNames = new Set(limited.map((item) => item.name))
    const completeNames = new Set(complete.map((item) => item.name))

    expect(pinned.every((item) => limitedNames.has(item.name))).toBe(true)
    expect(inflows.every((item) => completeNames.has(item.name))).toBe(true)
    expect(outflows.every((item) => completeNames.has(item.name))).toBe(true)
    expect(gains.every((item) => completeNames.has(item.name))).toBe(true)
    expect(losses.every((item) => completeNames.has(item.name))).toBe(true)
  })
})

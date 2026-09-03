import { describe, expect, it } from 'vitest'
import type { TonghuashunBoardSnapshot } from './fundFlow'
import { alignSectorsToTimeline, buildDailyFlowFromSnapshots, buildSessionTimeline, selectTonghuashunBoards } from './fundFlow'

function board(code: string, name: string, sourceType: 'industry' | 'concept', netInflow: number): TonghuashunBoardSnapshot {
  return {
    code, name, sourceType, netInflow, inflow: Math.max(0, netInflow), outflow: Math.max(0, -netInflow),
    changePercent: 0, leadingStock: '',
  }
}

describe('selectTonghuashunBoards', () => {
  it('军工口径只采用行业军工装备并保留原名', () => {
    const rows = [
      board('885700', '军工', 'concept', 100),
      board('881001', '军工电子', 'industry', 200),
      board('881002', '军工装备', 'industry', 300),
    ]
    expect(selectTonghuashunBoards(rows, 24).filter((item) => item.name.includes('军工'))).toEqual([
      expect.objectContaining({ code: '881002', name: '军工装备', sourceType: 'industry' }),
    ])
  })

  it('行业和概念重名时精确行业优先', () => {
    const rows = [board('I1', '半导体', 'industry', 1), board('C1', '半导体', 'concept', 10)]
    expect(selectTonghuashunBoards(rows, 1)[0]?.code).toBe('I1')
  })

  it('按调用参数隔离 28 与 24 个候选数量', () => {
    const rows = Array.from({ length: 32 }, (_, index) => board(String(index), `测试板块${index}`, 'industry', 100 - index))
    expect(selectTonghuashunBoards(rows, 28)).toHaveLength(28)
    expect(selectTonghuashunBoards(rows, 24)).toHaveLength(24)
  })

  it('军工装备缺失时也不回退到军工或军工电子', () => {
    const rows = [board('C1', '军工', 'concept', 10), board('I1', '军工电子', 'industry', 20)]
    expect(selectTonghuashunBoards(rows, 24)).toEqual([])
  })
})

describe('alignSectorsToTimeline', () => {
  it('稀疏快照按全局交易分钟轴使用最近历史值且不伪造边界外数据', () => {
    const source = selectTonghuashunBoards([board('A', '测试板块A', 'industry', 30)], 1)[0]!
    source.minuteFlow = [{ time: '09:31', value: 0 }, { time: '09:33', value: 20 }]
    const timeline = buildSessionTimeline('morning').slice(0, 5)
    expect(alignSectorsToTimeline([source], timeline)[0]?.minuteFlow).toEqual([
      { time: '09:31', value: 0 }, { time: '09:32', value: 0 }, { time: '09:33', value: 20 },
    ])
  })
})

describe('buildDailyFlowFromSnapshots', () => {
  it('从同花顺真实快照构建分钟轨迹并忽略旧来源', () => {
    const response = {
      schemaVersion: 2 as const,
      source: 'tonghuashun' as const,
      date: '2026-09-03',
      snapshots: [
        { time: '09:30', capturedAt: '', boards: [board('A', '测试板块A', 'industry', 10)], marketFlow: { inflow: 10, outflow: 5, net: 5, largeBuy: 3, largeSell: 2 } },
        { time: '09:31', capturedAt: '', boards: [board('A', '测试板块A', 'industry', 30)], marketFlow: { inflow: 30, outflow: 8, net: 22, largeBuy: 6, largeSell: 4 } },
      ],
    }
    const result = buildDailyFlowFromSnapshots(response, 24)
    expect(result.source).toBe('tonghuashun')
    expect(result.morning.sectors[0]?.minuteFlow).toEqual([{ time: '09:30', value: 0 }, { time: '09:31', value: 20 }])
    expect(result.marketFlow).toHaveLength(2)
  })

  it('拒绝没有同花顺版本标记的旧快照', () => {
    expect(() => buildDailyFlowFromSnapshots({ date: '2026-09-03', snapshots: [] } as never, 24)).toThrow(/不兼容/u)
  })
})

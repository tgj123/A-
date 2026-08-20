import { describe, expect, it } from 'vitest'
import type { SectorFlow } from '../types'
import {
  FLOW_VISIBLE_SECTORS,
  buildTodaySectors,
  getFlowRoute,
  getRotationFrame,
} from './rotationModel'

function sector(
  code: string,
  values: number[],
  netInflow = values.at(-1) ?? 0,
): SectorFlow {
  return {
    code,
    name: code,
    netInflow,
    changePercent: 0,
    leadingStock: '',
    rank: 0,
    turnover: 0,
    turnoverRate: 0,
    amplitude: 0,
    heatScore: 0,
    minuteFlow: values.map((value, index) => ({ time: `09:${30 + index}`, value })),
  }
}

describe('getFlowRoute', () => {
  it('只识别新增资金轮动路径', () => {
    expect(getFlowRoute('/flow/am')).toBe('am')
    expect(getFlowRoute('/flow/today/')).toBe('today')
    expect(getFlowRoute('/am')).toBeNull()
    expect(getFlowRoute('/all')).toBeNull()
  })
})

describe('buildTodaySectors', () => {
  it('将下午累计值衔接在上午收盘值之后', () => {
    const morning = sector('AI', [1, 3])
    const afternoon = {
      ...sector('AI', [2, -1]),
      minuteFlow: [
        { time: '13:30', value: 2 },
        { time: '15:00', value: -1 },
      ],
    }

    const result = buildTodaySectors([morning], [afternoon])

    expect(result[0].minuteFlow).toEqual([
      { time: '09:30', value: 1 },
      { time: '09:31', value: 3 },
      { time: '13:30', value: 5 },
      { time: '15:00', value: 2 },
    ])
  })
})

describe('getRotationFrame', () => {
  it('按当前时刻累计净流入排名并保留强流出板块', () => {
    const sectors = [
      sector('A', [2, 12]),
      sector('B', [10, 4]),
      sector('C', [-20, -30]),
      sector('D', [-2, -3]),
    ]

    const frame = getRotationFrame(sectors, 0, 3)

    expect(frame.map((item) => item.sector.code)).toEqual(['B', 'A', 'C'])
    expect(frame.map((item) => item.value)).toEqual([10, 2, -20])
    expect(frame.find((item) => item.sector.code === 'B')?.rankChange).toBe(0)
  })

  it('可见榜单始终使用连续序号而不是候选池全局排名', () => {
    const sectors = Array.from({ length: 24 }, (_, index) =>
      sector(String(index + 1), [24 - index]),
    )

    const frame = getRotationFrame(sectors, 0, 16)

    expect(frame.map((item) => item.rank)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    )
  })

  it('固定八个板块始终进入可见 16 项', () => {
    const pinnedNames = ['医药', '创新药', '白酒', '半导体', 'CPO', '存储芯片', '人形机器人', '商业航天']
    const pinned = pinnedNames.map((name, index) => ({ ...sector(`P${index}`, [-100 - index]), name }))
    const stronger = Array.from({ length: 20 }, (_, index) => sector(`S${index}`, [1000 - index]))

    const frame = getRotationFrame([...stronger, ...pinned], 0, 16)

    expect(pinnedNames.every((name) => frame.some((item) => item.sector.name === name))).toBe(true)
    expect(frame.map((item) => item.rank)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    )
  })

  it('按固定八个、资金流入流出及涨跌幅代表组成均衡榜单', () => {
    const pinnedNames = ['医药', '创新药', '白酒', '半导体', 'CPO', '存储芯片', '人形机器人', '商业航天']
    const pinned = pinnedNames.map((name, index) => ({
      ...sector(`P${index}`, [index - 3]), name, changePercent: 0,
    }))
    const inflows = Array.from({ length: 5 }, (_, index) => ({
      ...sector(`I${index}`, [100 - index]), changePercent: index,
    }))
    const outflows = Array.from({ length: 5 }, (_, index) => ({
      ...sector(`O${index}`, [-100 + index]), changePercent: -index,
    }))
    const gain = { ...sector('GAIN', [1]), changePercent: 20 }
    const loss = { ...sector('LOSS', [-1]), changePercent: -20 }

    const frame = getRotationFrame([...pinned, ...inflows, ...outflows, gain, loss], 0, 16)
    const codes = new Set(frame.map((item) => item.sector.code))

    expect(pinned.every((item) => codes.has(item.code))).toBe(true)
    expect(['I0', 'I1', 'I2'].every((code) => codes.has(code))).toBe(true)
    expect(['O0', 'O1', 'O2'].every((code) => codes.has(code))).toBe(true)
    expect(codes.has('GAIN')).toBe(true)
    expect(codes.has('LOSS')).toBe(true)
  })

  it('页面默认展示 20 个板块', () => {
    const sectors = Array.from({ length: 24 }, (_, index) => sector(String(index + 1), [index - 12]))

    const frame = getRotationFrame(sectors, 0, FLOW_VISIBLE_SECTORS)

    expect(FLOW_VISIBLE_SECTORS).toBe(20)
    expect(frame).toHaveLength(20)
    expect(new Set(frame.map((item) => item.sector.code)).size).toBe(20)
  })

  it('以整轮最大绝对金额生成统一且稳定的左右刻度', () => {
    const sectors = [sector('A', [2, 12]), sector('B', [-4, -30])]

    const frame = getRotationFrame(sectors, 1, 2)

    expect(frame[0].scaleMax).toBe(30)
    expect(frame[1].scaleMax).toBe(30)
  })
})

import { describe, expect, it } from 'vitest'
import { buildAllDaySectors, selectHotBoards, selectSessionPoints } from './fundFlow'

function board(code: string, name: string, stockType: string, netInflow: number) {
  return {
    code,
    name,
    stock_type: stockType,
    zdf: '1',
    zf: '2',
    hsl: '3',
    turnover: '1000',
    zljlr: String(netInflow),
    zllr: '600',
    zllc: '400',
  }
}

describe('全天累计资金', () => {
  it('下午从13点开始，保留13点至13点半的全部分钟', () => {
    expect(selectSessionPoints([
      { time: '11:30', value: 9 }, { time: '13:00', value: 10 },
      { time: '13:15', value: 12 }, { time: '13:30', value: 19 },
    ], 'afternoon')).toEqual([
      { time: '13:00', value: 0 }, { time: '13:15', value: 2 }, { time: '13:30', value: 9 },
    ])
  })

  it('商业航天直接采用完整累计序列，末点对齐接口15.6亿而非分段后4.x亿', () => {
    const sector = selectHotBoards([board('pt02GN2306', '商业航天', 'BK-GN', 156000)], 28)[0]
    const source = [
      { time: '09:30', value: 0 }, { time: '11:30', value: 856652700 },
      { time: '13:00', value: 900000000 }, { time: '13:30', value: 1950423700 },
      { time: '14:45', value: 1571544600 },
    ]
    const [result] = buildAllDaySectors([sector], new Map([[sector.code, source]]))
    expect(result.code).toBe('pt02GN2306')
    expect(result.minuteFlow.map((point) => point.time)).toEqual(source.map((point) => point.time))
    expect(result.minuteFlow[3].value).toBe(1950423700)
    expect(result.minuteFlow.at(-1)?.value).toBe(1560000000)
    expect(source.at(-1)?.value).toBe(1571544600)
  })
})

describe('selectHotBoards', () => {
  it('军工只采用腾讯一级行业国防军工并保留该名称', () => {
    const selected = selectHotBoards([
      board('pt01801740', '国防军工', 'BK-HY-1', -50_946.85),
      board('pt01801745', '军工电子Ⅱ', 'BK-HY-2', -39_217.59),
      board('pt02003490', '军工', 'BK-GN', -263_578.7),
    ], 24)

    expect(selected.filter((item) => /军工/u.test(item.name))).toEqual([
      expect.objectContaining({
        code: 'pt01801740',
        name: '国防军工',
        netInflow: -509_468_500,
      }),
    ])
  })

  it('一级行业缺失时不使用军工电子或军工概念冒充国防军工', () => {
    const selected = selectHotBoards([
      board('pt01801745', '军工电子Ⅱ', 'BK-HY-2', 20_000),
      board('pt02003490', '军工', 'BK-GN', 30_000),
    ], 24)

    expect(selected.some((item) => /军工/u.test(item.name))).toBe(false)
  })
})

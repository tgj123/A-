import { describe, expect, it } from 'vitest'
import { selectHotBoards } from './fundFlow'

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

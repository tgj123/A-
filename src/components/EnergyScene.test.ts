import { describe, expect, it } from 'vitest'
import { makeTicks, MAX_VISIBLE_SECTORS } from './EnergyScene'

describe('makeTicks', () => {
  it('ALL 模式只显示三个间距清晰的关键时间刻度', () => {
    expect(makeTicks('summary')).toEqual([
      { text: '09:30', position: 0 },
      { text: '13:00', position: 121 / 241 },
      { text: '15:00', position: 1 },
    ])
  })

  it('AM 模式仅保留开盘、中点和收盘三个刻度', () => {
    expect(makeTicks('morning')).toEqual([
      { text: '09:30', position: 0 },
      { text: '10:30', position: 0.5 },
      { text: '11:30', position: 1 },
    ])
  })

  it('AM 和 ALL 都允许显示超过 24 个板块', () => {
    expect(MAX_VISIBLE_SECTORS).toBe(28)
  })
})

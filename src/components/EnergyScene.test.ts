import { describe, expect, it } from 'vitest'
import { makeTicks } from './EnergyScene'

describe('makeTicks', () => {
  it('ALL 模式只显示三个间距清晰的关键时间刻度', () => {
    expect(makeTicks('summary')).toEqual([
      { text: '09:30', position: 0 },
      { text: '13:30', position: 121 / 211 },
      { text: '15:00', position: 1 },
    ])
  })

  it('AM 模式保留五个时间刻度', () => {
    expect(makeTicks('morning')).toHaveLength(5)
  })
})

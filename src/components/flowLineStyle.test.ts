import { describe, expect, it } from 'vitest'
import { getFlowLineStyle } from './flowLineStyle'

describe('getFlowLineStyle', () => {
  it('以细线区分密集走势，用颜色实度而非过度加粗保持清晰', () => {
    const small = getFlowLineStyle(0, 100)
    const large = getFlowLineStyle(100, 100)
    expect(small.linewidth).toBeGreaterThanOrEqual(0.8)
    expect(small.linewidth).toBeLessThanOrEqual(1)
    expect(small.opacity).toBeGreaterThanOrEqual(0.72)
    expect(large.linewidth).toBeGreaterThanOrEqual(1.2)
    expect(large.linewidth).toBeLessThanOrEqual(1.4)
    expect(large.opacity).toBeGreaterThanOrEqual(0.95)
  })

  it('正负资金都按绝对金额增强线宽和清晰度', () => {
    const nearZero = getFlowLineStyle(-1, 10)
    const largeOutflow = getFlowLineStyle(-10, 10)
    const largeInflow = getFlowLineStyle(10, 10)

    expect(largeOutflow.linewidth).toBeGreaterThan(nearZero.linewidth)
    expect(largeOutflow.opacity).toBeGreaterThan(nearZero.opacity)
    expect(largeOutflow).toEqual(largeInflow)
  })
})

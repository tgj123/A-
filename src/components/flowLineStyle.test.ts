import { describe, expect, it } from 'vitest'
import { getFlowLineStyle } from './flowLineStyle'

describe('getFlowLineStyle', () => {
  it('正负资金都按绝对金额增强线宽和清晰度', () => {
    const nearZero = getFlowLineStyle(-1, 10)
    const largeOutflow = getFlowLineStyle(-10, 10)
    const largeInflow = getFlowLineStyle(10, 10)

    expect(largeOutflow.linewidth).toBeGreaterThan(nearZero.linewidth)
    expect(largeOutflow.opacity).toBeGreaterThan(nearZero.opacity)
    expect(largeOutflow).toEqual(largeInflow)
  })
})

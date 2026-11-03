import { describe, expect, it } from 'vitest'
import { getFlowLabelPosition } from './flowLabelLayout'

describe('getFlowLabelPosition', () => {
  it('按实际卡片高度计算顶部，让连接线指向卡片中心', () => {
    const position = getFlowLabelPosition(1080, 1600, 50, 46, 1)
    expect(position).toEqual({ left: 605, top: 777, centerY: 800 })
  })

  it('在高像素密度屏幕按设备像素对齐', () => {
    const position = getFlowLabelPosition(393, 1000, 33.333, 32, 2)
    expect(position.left * 2).toBe(Math.round(position.left * 2))
    expect(position.top * 2).toBe(Math.round(position.top * 2))
    expect(position.centerY).toBe(position.top + 16)
  })

  it('首尾标签都在画布内部，28 个标签有足够的间距', () => {
    const positions = Array.from({ length: 28 }, (_, rank) =>
      getFlowLabelPosition(720, 1000, 3 + rank * 92 / 27, 32, 1))
    expect(positions[0].top).toBeGreaterThanOrEqual(0)
    expect(positions.at(-1)!.top + 32).toBeLessThanOrEqual(1000)
    positions.slice(1).forEach((position, index) => {
      expect(position.top - positions[index].top).toBeGreaterThanOrEqual(34)
    })
  })
})

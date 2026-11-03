export interface FlowLineStyle {
  linewidth: number
  opacity: number
}

/**
 * 线条强调程度只取决于资金绝对值，保证同等规模的流入与流出视觉权重一致。
 */
export function getFlowLineStyle(value: number, maxAbsValue: number): FlowLineStyle {
  const ratio = Math.min(1, Math.abs(value) / Math.max(Math.abs(maxAbsValue), 1))
  const emphasis = Math.sqrt(ratio)

  return {
    // 密集走势保持细线，靠颜色实度与高分屏采样维持清晰，而非堆叠线宽。
    linewidth: 0.9 + emphasis * 0.4,
    opacity: 0.74 + emphasis * 0.24,
  }
}

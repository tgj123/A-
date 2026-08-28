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
    linewidth: 1.18 + emphasis * 0.87,
    opacity: 0.4 + emphasis * 0.5,
  }
}

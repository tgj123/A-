/** 标签与连接线共用像素对齐后的坐标，避免文字发虚或连线偏离中心。 */
export function getFlowLabelPosition(
  width: number,
  height: number,
  topPercent: number,
  labelHeight: number,
  pixelRatio: number,
): { left: number; top: number; centerY: number } {
  const ratio = Math.max(1, pixelRatio || 1)
  const snap = (value: number) => Math.round(value * ratio) / ratio
  const top = snap(Math.max(0, Math.min(height - labelHeight, height * topPercent / 100 - labelHeight / 2)))
  return { left: snap(width * 0.56), top, centerY: top + labelHeight / 2 }
}

import type { SectorFlow } from '../types'
import { PINNED_BOARD_NAMES } from '../data/boardScoring'

export type FlowRoute = 'am' | 'today'

export interface RotationFrameItem {
  sector: SectorFlow
  value: number
  rank: number
  rankChange: number
  scaleMax: number
}

export function getFlowRoute(pathname: string): FlowRoute | null {
  const route = pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
  if (route === 'flow/am') return 'am'
  if (route === 'flow/today') return 'today'
  return null
}

export function buildTodaySectors(morning: SectorFlow[], afternoon: SectorFlow[]): SectorFlow[] {
  const afternoonByCode = new Map(afternoon.map((sector) => [sector.code, sector]))

  return morning.map((morningSector) => {
    const afternoonSector = afternoonByCode.get(morningSector.code)
    if (!afternoonSector) return { ...morningSector, minuteFlow: [...morningSector.minuteFlow] }

    const morningEnd = morningSector.minuteFlow.at(-1)?.value ?? 0
    const minuteFlow = [
      ...morningSector.minuteFlow,
      ...afternoonSector.minuteFlow.map((point) => ({
        ...point,
        value: morningEnd + point.value,
      })),
    ]

    return {
      ...afternoonSector,
      netInflow: minuteFlow.at(-1)?.value ?? morningEnd,
      minuteFlow,
    }
  })
}

function valueAt(sector: SectorFlow, pointIndex: number): number {
  if (sector.minuteFlow.length === 0) return sector.netInflow
  return sector.minuteFlow[Math.min(Math.max(pointIndex, 0), sector.minuteFlow.length - 1)]?.value ?? 0
}

function selectVisible(sectors: SectorFlow[], pointIndex: number, limit: number): SectorFlow[] {
  const ranked = [...sectors].sort((left, right) => valueAt(right, pointIndex) - valueAt(left, pointIndex))
  if (ranked.length <= limit) return ranked

  const pinnedNames = new Set<string>(PINNED_BOARD_NAMES)
  const pinned = ranked.filter((sector) => pinnedNames.has(sector.name))
  const dynamicCandidates = ranked.filter((sector) => !pinnedNames.has(sector.name))
  const useBalancedQuotas = limit >= 15
  const outflowSlots = useBalancedQuotas ? 3 : Math.max(1, Math.round(limit * 0.32))
  const inflowSlots = useBalancedQuotas ? 3 : Math.max(0, limit - outflowSlots)
  const strongestInflows = dynamicCandidates.filter((sector) => valueAt(sector, pointIndex) >= 0)
    .slice(0, inflowSlots)
  const strongestOutflows = dynamicCandidates.filter((sector) => valueAt(sector, pointIndex) < 0)
    .slice(-outflowSlots)
  const strongestGain = useBalancedQuotas
    ? [...dynamicCandidates].sort((left, right) => right.changePercent - left.changePercent).slice(0, 1)
    : []
  const strongestLoss = useBalancedQuotas
    ? [...dynamicCandidates].sort((left, right) => left.changePercent - right.changePercent).slice(0, 1)
    : []
  const prioritized = [...new Map([
    ...pinned, ...strongestInflows, ...strongestOutflows, ...strongestGain, ...strongestLoss,
  ].map((sector) => [sector.code, sector])).values()]
  const prioritizedCodes = new Set(prioritized.map((sector) => sector.code))
  const remainingSlots = Math.max(0, limit - prioritized.length)
  const remaining = dynamicCandidates.filter((sector) => !prioritizedCodes.has(sector.code))
    .sort((left, right) => right.heatScore - left.heatScore)
    .slice(0, remainingSlots)

  // 先确定最终集合，再按当前资金值排序；排序后不可再次裁剪，否则会挤掉固定项和强流出项。
  return [...prioritized, ...remaining]
    .sort((left, right) => valueAt(right, pointIndex) - valueAt(left, pointIndex))
}

export function getRotationFrame(
  sectors: SectorFlow[],
  pointIndex: number,
  visibleLimit = 16,
): RotationFrameItem[] {
  const scaleMax = Math.max(
    1,
    ...sectors.flatMap((sector) => sector.minuteFlow.map((point) => Math.abs(point.value))),
    ...sectors.map((sector) => Math.abs(sector.netInflow)),
  )
  const visible = selectVisible(sectors, pointIndex, visibleLimit)
  const previousVisibleRanks = new Map(
    selectVisible(sectors, Math.max(0, pointIndex - 1), visibleLimit)
      .map((sector, index) => [sector.code, index + 1]),
  )

  return visible.map((sector, index) => {
    const rank = index + 1
    const previousRank = previousVisibleRanks.get(sector.code) ?? rank
    return {
      sector,
      value: valueAt(sector, pointIndex),
      rank,
      rankChange: previousRank - rank,
      scaleMax,
    }
  })
}

import type {
  BoardSourceType,
  DailyFundFlow,
  MarketFlowSnapshot,
  MinuteFlowPoint,
  SectorFlow,
  SessionFlow,
} from '../types'
import { calculateBoardHeatScore, selectPublicBoards } from './boardScoring'

const DEFAULT_SELECTED_COUNT = 24
const SNAPSHOT_ENDPOINT = '/fund-flow-api/api/fund-flow/snapshots'

export interface TonghuashunBoardSnapshot {
  code: string
  name: string
  sourceType: BoardSourceType
  inflow: number
  outflow: number
  netInflow: number
  changePercent: number
  leadingStock: string
}

interface TonghuashunSnapshot {
  time: string
  capturedAt: string
  boards: TonghuashunBoardSnapshot[]
  marketFlow: Omit<MarketFlowSnapshot, 'time'>
}

export interface TonghuashunSnapshotResponse {
  schemaVersion: 2
  source: 'tonghuashun'
  date: string
  incompatibleSource?: string
  snapshots: TonghuashunSnapshot[]
}

export function buildTradingTimeline(sectors: SectorFlow[]): string[] {
  return [...new Set(sectors.flatMap((sector) => sector.minuteFlow.map((point) => point.time)))].sort()
}

export function buildSessionTimeline(key: 'morning' | 'afternoon' | 'summary'): string[] {
  const ranges = key === 'morning' ? [[570, 690]] : key === 'afternoon' ? [[810, 900]] : [[570, 690], [810, 900]]
  return ranges.flatMap(([start, finish]) => Array.from({ length: finish - start + 1 }, (_, offset) => {
    const minute = start + offset
    return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
  }))
}

export function valueAtOrBefore(sector: SectorFlow, targetTime: string): number {
  let value = 0
  for (const point of sector.minuteFlow) {
    if (point.time > targetTime) break
    value = point.value
  }
  return value
}

export function alignSectorsToTimeline(sectors: SectorFlow[], timeline: string[]): SectorFlow[] {
  if (!timeline.length) return []
  const firstTime = timeline[0]
  const lastTime = timeline.at(-1)!
  return sectors.flatMap((sector) => {
    const firstSectorTime = sector.minuteFlow[0]?.time
    const lastSectorTime = sector.minuteFlow.at(-1)?.time
    if (!firstSectorTime || !lastSectorTime || lastSectorTime < firstTime || firstSectorTime > lastTime) return []
    return [{
      ...sector,
      minuteFlow: timeline
        .filter((time) => time >= firstSectorTime && time <= lastSectorTime)
        .map((time) => ({ time, value: valueAtOrBefore(sector, time) })),
    }]
  })
}

const EXCLUDED_NAMES = /昨日|涨停|连板|首板|新股|次新股|高送转|融资融券|转融券|沪股通|深股通|MSCI|预亏|预增|重仓|持股|增持|减持|破净|破发|ST板块/u
const REPLACED_MILITARY_NAMES = new Set(['军工', '军工电子'])

interface SelectionRule {
  key: string
  candidates: ReadonlyArray<{ sourceType: BoardSourceType; name: string }>
}

const SELECTION_RULES: SelectionRule[] = [
  { key: '军工', candidates: [{ sourceType: 'industry', name: '军工装备' }] },
  { key: '医药', candidates: [{ sourceType: 'industry', name: '化学制药' }, { sourceType: 'industry', name: '中药' }, { sourceType: 'concept', name: '医药电商' }] },
  { key: '创新药', candidates: [{ sourceType: 'concept', name: '创新药' }] },
  { key: '白酒', candidates: [{ sourceType: 'industry', name: '白酒' }, { sourceType: 'concept', name: '白酒概念' }] },
  { key: '半导体', candidates: [{ sourceType: 'industry', name: '半导体' }] },
  { key: 'CPO', candidates: [{ sourceType: 'concept', name: 'CPO概念' }, { sourceType: 'concept', name: '共封装光学(CPO)' }] },
  { key: '存储芯片', candidates: [{ sourceType: 'concept', name: '存储芯片' }] },
  { key: '人形机器人', candidates: [{ sourceType: 'concept', name: '人形机器人' }] },
  { key: '商业航天', candidates: [{ sourceType: 'concept', name: '商业航天' }] },
  { key: '黄金', candidates: [{ sourceType: 'industry', name: '贵金属' }, { sourceType: 'concept', name: '黄金概念' }] },
]

function selectionKey(row: TonghuashunBoardSnapshot): string {
  const rule = SELECTION_RULES.find(({ candidates }) => candidates.some(
    (candidate) => candidate.sourceType === row.sourceType && candidate.name === row.name,
  ))
  return rule?.key ?? row.name
}

function sourcePriority(row: TonghuashunBoardSnapshot): number {
  const rule = SELECTION_RULES.find(({ candidates }) => candidates.some(
    (candidate) => candidate.sourceType === row.sourceType && candidate.name === row.name,
  ))
  if (rule) {
    const index = rule.candidates.findIndex((candidate) => candidate.sourceType === row.sourceType && candidate.name === row.name)
    return 100 - index
  }
  return row.sourceType === 'industry' ? 20 : 10
}

function normalize(values: number[]): number[] {
  const max = Math.max(...values, 1)
  return values.map((value) => Math.min(1, value / max))
}

export function selectTonghuashunBoards(rows: TonghuashunBoardSnapshot[], selectedCount: number): SectorFlow[] {
  const valid = rows.filter((row) => {
    if (!row.code || !row.name || EXCLUDED_NAMES.test(row.name)) return false
    return !REPLACED_MILITARY_NAMES.has(row.name)
  })
  const flows = normalize(valid.map((row) => Math.abs(row.netInflow)))
  const changes = normalize(valid.map((row) => Math.abs(row.changePercent)))
  const scored = valid.map((row, index) => ({
    ...row,
    selectionKey: selectionKey(row),
    sourcePriority: sourcePriority(row),
    rank: 0,
    turnover: row.inflow + row.outflow,
    turnoverRate: 0,
    amplitude: 0,
    heatScore: calculateBoardHeatScore({ flow: flows[index], change: changes[index], amplitude: 0 }),
    minuteFlow: [] as MinuteFlowPoint[],
  }))

  const representatives = [...scored]
    .sort((left, right) => right.sourcePriority - left.sourcePriority || right.heatScore - left.heatScore)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.selectionKey === item.selectionKey) === index)
  const selected = selectPublicBoards(representatives, selectedCount)
  selected.forEach((sector, index) => { sector.rank = index + 1 })
  return selected
}

function sessionPoints(points: MinuteFlowPoint[], key: 'morning' | 'afternoon'): MinuteFlowPoint[] {
  const filtered = key === 'morning'
    ? points.filter((point) => point.time >= '09:30' && point.time <= '11:30')
    : points.filter((point) => point.time >= '13:30' && point.time <= '15:00')
  if (!filtered.length) return []
  const baseline = filtered[0].value
  return filtered.map((point) => ({ ...point, value: point.value - baseline }))
}

function createSession(
  key: 'morning' | 'afternoon',
  sectors: SectorFlow[],
  snapshots: TonghuashunSnapshot[],
): SessionFlow {
  const result = sectors.map((sector) => {
    const points = snapshots.flatMap((snapshot) => {
      const board = snapshot.boards.find((item) => item.code === sector.code && item.sourceType === sector.sourceType)
      return board ? [{ time: snapshot.time, value: board.netInflow }] : []
    })
    return { ...sector, minuteFlow: sessionPoints(points, key) }
  }).filter((sector) => sector.minuteFlow.length)
  result.forEach((sector, index) => { sector.rank = index + 1 })
  return {
    key,
    label: key === 'morning' ? '上午盘' : '下午盘',
    range: key === 'morning' ? '09:30—11:30' : '13:30—15:00',
    totalNetInflow: result.reduce((sum, sector) => sum + sector.netInflow, 0),
    sectors: result,
  }
}

export function buildDailyFlowFromSnapshots(
  response: TonghuashunSnapshotResponse,
  selectedCount = DEFAULT_SELECTED_COUNT,
): DailyFundFlow {
  if (response.schemaVersion !== 2 || response.source !== 'tonghuashun') {
    throw new Error('历史资金快照来源不兼容，请启动同花顺采集器生成新数据')
  }
  if (!response.snapshots.length) throw new Error('同花顺实时快照暂不可用')
  const latest = response.snapshots.at(-1)!
  const sectors = selectTonghuashunBoards(latest.boards, selectedCount)
  const marketFlow = response.snapshots.map((snapshot) => ({ time: snapshot.time, ...snapshot.marketFlow }))
  return {
    tradingDate: response.date,
    source: 'tonghuashun',
    sourceLabel: '同花顺资金流向',
    sessionMethod: 'official-snapshot',
    marketFlow,
    morning: createSession('morning', sectors, response.snapshots),
    afternoon: createSession('afternoon', sectors, response.snapshots),
  }
}

export async function loadDailyFlow(signal?: AbortSignal, selectedCount = DEFAULT_SELECTED_COUNT): Promise<DailyFundFlow> {
  const response = await fetch(SNAPSHOT_ENDPOINT, { signal })
  if (!response.ok) throw new Error(`同花顺资金快照请求失败：HTTP ${response.status}`)
  return buildDailyFlowFromSnapshots(await response.json() as TonghuashunSnapshotResponse, selectedCount)
}

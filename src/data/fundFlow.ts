import type { DailyFundFlow, MinuteFlowPoint, SectorFlow, SessionFlow } from '../types'

interface TencentLeader {
  code?: string
  name?: string
}

interface TencentBoardRow {
  code?: string
  name?: string
  stock_type?: string
  zdf?: string
  zf?: string
  hsl?: string
  turnover?: string
  zljlr?: string
  zllr?: string
  zllc?: string
  lzg?: TencentLeader
}

interface TencentRankResponse {
  code?: number
  msg?: string
  data?: { rank_list?: TencentBoardRow[] }
}

interface TencentMinuteResponse {
  data?: Record<string, { data?: { date?: string; data?: string[] } }>
}

const BOARD_ENDPOINT = import.meta.env.VITE_TENCENT_FUND_FLOW_ENDPOINT
  || '/tencent-api/cgi/cgi-bin/rank/pt/getRank'
const MINUTE_ENDPOINT = import.meta.env.VITE_TENCENT_MINUTE_ENDPOINT
  || '/tencent-api/ifzqgtimg/appstock/app/minute/query'
const SELECTED_COUNT = 24
const EXCLUDED_BOARD_NAMES = /昨日|涨停|连板|首板|新股|次新股|高送转|融资融券|转融券|深股通|沪股通|富时罗素|标普道琼斯|MSCI|同花顺|预亏|预增|基金重仓|社保重仓|证金持股|高价股|低价股|大盘股|小盘股|中盘股|央企央资|地方国资|政府控股|国企改革|周期股|机构重仓|参股|持股|增持|减持|破净股|破发股|AH股|AB股|含可转债|送转填权|行业龙头|一带一路|TMT|转融券标的|装修|装饰|电子签名|非白酒|其他|地面兵装|航天装备/
const ALLOWED_BOARD_NAMES = new Set([
  '创新药', '人形机器人', '半导体材料', '半导体', '先进封装', '存储芯片', 'CPO', 'PCB',
  'AI应用', '人工智能', '游戏', '5G', '消费电子', 'MLCC', '元件',
  '算力概念', '光通信', '通信设备', '玻璃基板', '锂矿', '锂电池', '新能源',
  '新能源汽车', '风电', '储能', '充电桩', '智能驾驶', '光伏', '商业航天',
  '电力', '电力设备', '电网设备', '煤炭', '化工', '生物医药', '医药', '医疗',
  '白酒', '猪肉', '养殖', '黄金', '白银', '稀土', '有色金属', '银行',
  '证券', '保险', '房地产', '军工', '低空经济', '软件开发', '数据中心', '云计算',
  '汽车整车', '食品饮料', '家电', '农业', '石油天然气', '钢铁', '航运港口',
  '旅游酒店',
])

const BOARD_NAME_NORMALIZERS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /半导体材料/u, name: '半导体材料' },
  { pattern: /先进封装|Chiplet/u, name: '先进封装' },
  { pattern: /创新药/u, name: '创新药' },
  { pattern: /生物医药/u, name: '生物医药' },
  { pattern: /人形机器人/u, name: '人形机器人' },
  { pattern: /半导体/u, name: '半导体' },
  { pattern: /共封装光模块|光模块|CPO/u, name: 'CPO' },
  { pattern: /PCB/u, name: 'PCB' },
  { pattern: /AI应用/u, name: 'AI应用' },
  { pattern: /游戏/u, name: '游戏' },
  { pattern: /F5G|5\.5G|5G/u, name: '5G' },
  { pattern: /消费电子/u, name: '消费电子' },
  { pattern: /MLCC/u, name: 'MLCC' },
  { pattern: /电子元件|被动元件|元件/u, name: '元件' },
  { pattern: /^存储器$/u, name: '存储芯片' },
  { pattern: /算力/u, name: '算力概念' },
  { pattern: /人工智能|^AI/u, name: '人工智能' },
  { pattern: /光通信/u, name: '光通信' },
  { pattern: /通信设备/u, name: '通信设备' },
  { pattern: /玻璃基板/u, name: '玻璃基板' },
  { pattern: /数据中心/u, name: '数据中心' },
  { pattern: /云计算/u, name: '云计算' },
  { pattern: /软件开发/u, name: '软件开发' },
  { pattern: /锂矿|锂资源|盐湖提锂/u, name: '锂矿' },
  { pattern: /储能/u, name: '储能' },
  { pattern: /充电桩/u, name: '充电桩' },
  { pattern: /新能源汽车|新能源车/u, name: '新能源汽车' },
  { pattern: /锂电|电池/u, name: '锂电池' },
  { pattern: /新能源/u, name: '新能源' },
  { pattern: /风电/u, name: '风电' },
  { pattern: /无人驾驶|自动驾驶|智能驾驶/u, name: '智能驾驶' },
  { pattern: /光伏/u, name: '光伏' },
  { pattern: /商业航天/u, name: '商业航天' },
  { pattern: /低空经济/u, name: '低空经济' },
  { pattern: /军工|国防军工/u, name: '军工' },
  { pattern: /电力设备/u, name: '电力设备' },
  { pattern: /电网设备/u, name: '电网设备' },
  { pattern: /电力/u, name: '电力' },
  { pattern: /煤炭/u, name: '煤炭' },
  { pattern: /化工/u, name: '化工' },
  { pattern: /汽车整车/u, name: '汽车整车' },
  { pattern: /食品饮料/u, name: '食品饮料' },
  { pattern: /家电|家用电器/u, name: '家电' },
  { pattern: /农业/u, name: '农业' },
  { pattern: /石油|天然气/u, name: '石油天然气' },
  { pattern: /钢铁/u, name: '钢铁' },
  { pattern: /航运|港口/u, name: '航运港口' },
  { pattern: /旅游|酒店/u, name: '旅游酒店' },
  { pattern: /牙科|口腔|医疗/u, name: '医疗' },
  { pattern: /医药/u, name: '医药' },
  { pattern: /白酒/u, name: '白酒' },
  { pattern: /猪肉|生猪/u, name: '猪肉' },
  { pattern: /养殖/u, name: '养殖' },
  { pattern: /白银/u, name: '白银' },
  { pattern: /黄金|贵金属/u, name: '黄金' },
  { pattern: /稀土/u, name: '稀土' },
  { pattern: /有色/u, name: '有色金属' },
  { pattern: /证券/u, name: '证券' },
  { pattern: /保险/u, name: '保险' },
  { pattern: /银行/u, name: '银行' },
  { pattern: /房地产/u, name: '房地产' },
]

function cleanBoardName(value: string): string {
  const cleaned = value
    .replace(/[ⅠⅡⅢⅣⅤ]+$/u, '')
    .replace(/概念$/u, '')
    .replace('共封装光模块(CPO）', 'CPO')
    .replace('共封装光模块(CPO)', 'CPO')
    .trim()
  return BOARD_NAME_NORMALIZERS.find(({ pattern }) => pattern.test(cleaned))?.name ?? cleaned
}

function getCanonicalBoardPriority(sourceName: string, canonicalName: string, isIndustry: boolean): number {
  const cleanedSource = sourceName.replace(/[ⅠⅡⅢⅣⅤ]+$/u, '').replace(/概念$/u, '').trim()
  // 行业名称可能带“开采”“大型”“股份制”等后缀，仍应优先于同类概念板块。
  if (isIndustry) return cleanedSource === canonicalName ? 5 : 4
  if (cleanedSource === canonicalName) return 3
  if (cleanedSource === `${canonicalName}产业`) return 2
  return 1
}

function numberOf(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getShanghaiDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function getLatestTradingDate(now = new Date()): string {
  const shanghai = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
  const minutes = shanghai.getHours() * 60 + shanghai.getMinutes()
  if (shanghai.getDay() === 0) shanghai.setDate(shanghai.getDate() - 2)
  if (shanghai.getDay() === 6) shanghai.setDate(shanghai.getDate() - 1)
  if (shanghai.getDay() >= 1 && shanghai.getDay() <= 5 && minutes < 570) shanghai.setDate(shanghai.getDate() - 1)
  while (shanghai.getDay() === 0 || shanghai.getDay() === 6) shanghai.setDate(shanghai.getDate() - 1)
  return getShanghaiDate(shanghai)
}

function normalize(values: number[]): number[] {
  const max = Math.max(...values, 1)
  return values.map((value) => Math.min(1, value / max))
}

/**
 * 资金流、涨跌波动、换手和成交额共同决定热度，避免页面长期只展示净流入榜。
 * 同时保留明显流出板块，让画面能表达资金分化而不是单边排名。
 */
function selectHotBoards(rows: TencentBoardRow[]): SectorFlow[] {
  const valid = rows.filter((row) => {
    if (!row.code || !row.name || EXCLUDED_BOARD_NAMES.test(row.name)) return false
    return ALLOWED_BOARD_NAMES.has(cleanBoardName(row.name))
  })
  const flows = normalize(valid.map((row) => Math.abs(numberOf(row.zljlr))))
  const changes = normalize(valid.map((row) => Math.abs(numberOf(row.zdf))))
  const amplitudes = normalize(valid.map((row) => Math.abs(numberOf(row.zf))))
  const turnovers = normalize(valid.map((row) => Math.log1p(numberOf(row.turnover))))
  const turnoverRates = normalize(valid.map((row) => numberOf(row.hsl)))

  const scored = valid.map((row, index) => {
    const name = cleanBoardName(row.name!)
    return {
      code: row.code!,
      name,
      netInflow: numberOf(row.zljlr) * 10_000,
      changePercent: numberOf(row.zdf),
      leadingStock: row.lzg?.name ?? '',
      rank: 0,
      turnover: numberOf(row.turnover) * 10_000,
      turnoverRate: numberOf(row.hsl),
      amplitude: numberOf(row.zf),
      heatScore: flows[index] * 0.36
        + changes[index] * 0.23
        + amplitudes[index] * 0.15
        + turnovers[index] * 0.16
        + turnoverRates[index] * 0.1,
      canonicalPriority: getCanonicalBoardPriority(row.name!, name, !row.code!.startsWith('pt02')),
      minuteFlow: [],
    }
  })

  // 同类只取一个来源：优先名称匹配的行业行；没有行业行时才采用最标准的概念行。
  const representativeBoards = [...scored]
    .sort((a, b) => b.canonicalPriority - a.canonicalPriority || b.heatScore - a.heatScore)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.name === item.name) === index)
    .sort((a, b) => b.heatScore - a.heatScore)
  const strongestMovers = [
    ...representativeBoards.filter((item) => item.changePercent >= 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 4),
    ...representativeBoards.filter((item) => item.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 4),
  ]
  const mustInclude = [
    ...representativeBoards.filter((item) => item.netInflow >= 0).sort((a, b) => b.netInflow - a.netInflow).slice(0, 4),
    ...representativeBoards.filter((item) => item.netInflow < 0).sort((a, b) => a.netInflow - b.netInflow).slice(0, 4),
    ...strongestMovers,
  ]
  const selected = [...new Map([
    ...mustInclude,
    ...representativeBoards,
  ].map((item) => [item.name, item])).values()].slice(0, SELECTED_COUNT)
  selected.forEach((sector, index) => { sector.rank = index + 1 })
  return selected
}

interface TencentMinuteRow {
  time: number
  price: number
  volume: number
}

function parseMinuteRows(payload: TencentMinuteResponse, code: string): TencentMinuteRow[] {
  const rows = payload.data?.[code]?.data?.data ?? []
  return rows.flatMap((row) => {
    const [time, price, volume] = row.split(' ').map(Number)
    return Number.isFinite(time) && Number.isFinite(price) && Number.isFinite(volume)
      ? [{ time, price, volume }]
      : []
  })
}

function formatMinute(time: number): string {
  return `${String(Math.floor(time / 100)).padStart(2, '0')}:${String(time % 100).padStart(2, '0')}`
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function smoothSeries(values: number[]): number[] {
  if (values.length < 5) return values
  const medianFiltered = values.map((_, index) => median(values.slice(Math.max(0, index - 2), Math.min(values.length, index + 3))))
  const smoothed = medianFiltered.map((_, index) => {
    const window = medianFiltered.slice(Math.max(0, index - 2), Math.min(values.length, index + 3))
    const weights = window.length === 5 ? [1, 2, 3, 2, 1] : window.map(() => 1)
    return window.reduce((sum, value, i) => sum + value * weights[i], 0) / weights.reduce((sum, weight) => sum + weight, 0)
  })
  smoothed[0] = values[0]
  smoothed[smoothed.length - 1] = values[values.length - 1]
  return smoothed
}

/**
 * 腾讯板块分钟接口提供分钟价格和累计成交量，但没有分钟主力净流入。
 * 轨迹以累计成交进度为主趋势，价格偏离提供有限扰动，避免放大一分钟价格噪声。
 */
function reconstructMinuteFlow(rows: TencentMinuteRow[], finalFlow: number): MinuteFlowPoint[] {
  if (!rows.length) return []
  let previousVolume = 0
  let previousPrice = rows[0].price || 1
  let cumulative = 0
  const raw = rows.map((row) => {
    const deltaVolume = Math.max(0, row.volume - previousVolume)
    const minuteMove = previousPrice === 0 ? 0 : (row.price - previousPrice) / previousPrice
    // 价格方向主导分钟增量，最终资金方向只提供较弱偏置，因此允许盘中真实反转。
    const signedPressure = Math.tanh(minuteMove * 180) * 0.88 + Math.sign(finalFlow || 1) * 0.12
    cumulative += deltaVolume * signedPressure
    previousVolume = row.volume
    previousPrice = row.price
    return cumulative
  })
  const smoothed = smoothSeries(raw)
  const rawEnd = smoothed.at(-1) ?? 0
  const finalVolume = rows.at(-1)?.volume || 1
  const corrected = smoothed.map((value, index) => {
    const progress = Math.max(0, Math.min(1, rows[index].volume / finalVolume))
    // 通过随成交进度展开的端点修正保证收盘值准确，不强制中间过程单调。
    return value + (finalFlow - rawEnd) * progress
  })
  corrected[0] = 0
  corrected[corrected.length - 1] = finalFlow
  return rows.map((row, index) => ({ time: formatMinute(row.time), value: corrected[index] }))
}

function selectSessionPoints(
  points: MinuteFlowPoint[],
  key: 'morning' | 'afternoon',
): MinuteFlowPoint[] {
  const sessionPoints = key === 'morning'
    ? points.filter((point) => point.time >= '09:30' && point.time <= '11:30')
    : points.filter((point) => point.time >= '13:30' && point.time <= '15:00')
  if (!sessionPoints.length) return []
  const baseline = sessionPoints[0].value
  // 每个播放时段统一从 0 开始，避免真实快照校准后各板块起点分散。
  return sessionPoints.map((point) => ({ ...point, value: point.value - baseline }))
}

async function getMinuteFlow(sector: SectorFlow, signal?: AbortSignal): Promise<MinuteFlowPoint[]> {
  const url = new URL(MINUTE_ENDPOINT, window.location.origin)
  url.searchParams.set('code', sector.code)
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`腾讯板块分时请求失败：HTTP ${response.status}`)
  return reconstructMinuteFlow(parseMinuteRows(await response.json() as TencentMinuteResponse, sector.code), sector.netInflow)
}

interface FundFlowSnapshot {
  time: string
  boards: Array<{ code: string; netInflow: number }>
}

interface FundFlowSnapshotResponse {
  date: string
  snapshots: FundFlowSnapshot[]
}

async function loadRealSnapshots(date: string, signal?: AbortSignal): Promise<FundFlowSnapshotResponse | null> {
  try {
    const response = await fetch(`/fund-flow-api/api/fund-flow/snapshots?date=${encodeURIComponent(date)}`, { signal })
    if (!response.ok) return null
    return await response.json() as FundFlowSnapshotResponse
  } catch (error) {
    if (signal?.aborted) throw error
    return null
  }
}

function applyRealSnapshots(
  sectors: SectorFlow[],
  snapshots: FundFlowSnapshotResponse | null,
): Map<string, MinuteFlowPoint[]> {
  const result = new Map<string, MinuteFlowPoint[]>()
  if (!snapshots?.snapshots.length) return result
  for (const sector of sectors) {
    const points = snapshots.snapshots.flatMap((snapshot) => {
      const board = snapshot.boards.find((item) => item.code === sector.code)
      return board ? [{ time: snapshot.time, value: board.netInflow }] : []
    })
    if (points.length) result.set(sector.code, points)
  }
  return result
}

function mergeMinuteFlows(
  estimated: Map<string, MinuteFlowPoint[]>,
  real: Map<string, MinuteFlowPoint[]>,
): Map<string, MinuteFlowPoint[]> {
  const merged = new Map<string, MinuteFlowPoint[]>()
  for (const [code, estimatedPoints] of estimated) {
    const realPoints = real.get(code) ?? []
    if (!realPoints.length) {
      merged.set(code, estimatedPoints)
      continue
    }

    const estimatedByTime = new Map(estimatedPoints.map((point) => [point.time, point.value]))
    const anchors = realPoints
      .map((point) => ({
        ...point,
        correction: point.value - (estimatedByTime.get(point.time) ?? point.value),
      }))
      .sort((a, b) => a.time.localeCompare(b.time))

    const calibrated = estimatedPoints.map((point) => {
      const exact = anchors.find((anchor) => anchor.time === point.time)
      if (exact) return { time: point.time, value: exact.value }
      const nextIndex = anchors.findIndex((anchor) => anchor.time > point.time)
      const previous = nextIndex <= 0 ? null : anchors[nextIndex - 1]
      const next = nextIndex < 0 ? null : anchors[nextIndex]
      let correction = 0
      if (previous && next) {
        const times = estimatedPoints.map((item) => item.time)
        const from = Math.max(0, times.indexOf(previous.time))
        const to = Math.max(from + 1, times.indexOf(next.time))
        const current = Math.max(from, times.indexOf(point.time))
        const ratio = Math.max(0, Math.min(1, (current - from) / (to - from)))
        correction = previous.correction + (next.correction - previous.correction) * ratio
      } else if (previous) {
        correction = previous.correction
      } else if (next) {
        const firstIndex = Math.max(1, estimatedPoints.findIndex((item) => item.time === next.time))
        const currentIndex = Math.max(0, estimatedPoints.findIndex((item) => item.time === point.time))
        correction = next.correction * currentIndex / firstIndex
      }
      return { time: point.time, value: point.value + correction }
    })
    merged.set(code, calibrated)
  }
  return merged
}

function createSession(
  key: 'morning' | 'afternoon',
  sectors: SectorFlow[],
  minuteFlows: Map<string, MinuteFlowPoint[]>,
): SessionFlow {
  const result = sectors.map((sector) => {
    const minuteFlow = selectSessionPoints(minuteFlows.get(sector.code) ?? [], key)
    // 腾讯板块接口只提供实时累计主力净流入；分时轨迹是估算值，不能覆盖真实累计金额。
    return { ...sector, minuteFlow }
  }).sort((a, b) => b.heatScore - a.heatScore)
  result.forEach((sector, index) => { sector.rank = index + 1 })
  return {
    key,
    label: key === 'morning' ? '上午盘' : '下午盘',
    range: key === 'morning' ? '09:30—11:30' : '13:30—15:00',
    totalNetInflow: result.reduce((sum, sector) => sum + sector.netInflow, 0),
    sectors: result,
  }
}

async function loadBoardRows(boardType: 'gn' | 'hy' | 'hy2', count: number, signal?: AbortSignal): Promise<TencentBoardRow[]> {
  const pageSize = Math.min(100, count)
  const rows: TencentBoardRow[] = []
  for (let offset = 0; offset < count; offset += pageSize) {
    const url = new URL(BOARD_ENDPOINT, window.location.origin)
    url.searchParams.set('board_type', boardType)
    url.searchParams.set('sort_type', 'price')
    url.searchParams.set('direct', 'down')
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('count', String(Math.min(pageSize, count - offset)))
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`腾讯板块请求失败：HTTP ${response.status}`)
    const payload = await response.json() as TencentRankResponse
    if (payload.code !== 0 || !payload.data?.rank_list) {
      throw new Error(`腾讯板块响应异常：${payload.msg ?? '暂无数据'}`)
    }
    rows.push(...payload.data.rank_list)
    if (payload.data.rank_list.length < Math.min(pageSize, count - offset)) break
  }
  if (!rows.length) throw new Error('腾讯板块暂无数据')
  return rows
}

async function loadTencentDailyFlow(signal?: AbortSignal): Promise<DailyFundFlow> {
  const [conceptRows, industryRows] = await Promise.all([
    loadBoardRows('gn', 798, signal),
    loadBoardRows('hy2', 124, signal),
  ])
  const tradingDate = getLatestTradingDate()
  const sectors = selectHotBoards([...conceptRows, ...industryRows])
  if (!sectors.length) throw new Error('腾讯行业板块数据为空')
  const minuteEntries = await Promise.all(sectors.map(async (sector) => [
    sector.code,
    await getMinuteFlow(sector, signal),
  ] as const))
  const estimatedFlows = new Map(minuteEntries)
  const realSnapshots = applyRealSnapshots(sectors, await loadRealSnapshots(tradingDate, signal))
  const minuteFlows = mergeMinuteFlows(estimatedFlows, realSnapshots)

  return {
    tradingDate,
    source: 'tencent',
    sourceLabel: '腾讯证券行情中心',
    sessionMethod: 'turnover-estimate',
    morning: createSession('morning', sectors, minuteFlows),
    afternoon: createSession('afternoon', sectors, minuteFlows),
  }
}

export async function loadDailyFlow(signal?: AbortSignal): Promise<DailyFundFlow> {
  return loadTencentDailyFlow(signal)
}

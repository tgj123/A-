import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TonghuashunClient } from './tonghuashunClient.mjs'
import { parseTonghuashunBoardTable, parseTonghuashunLargeOrderTable, parseTonghuashunStockTable } from './tonghuashunParser.mjs'
import {
  SNAPSHOT_SCHEMA_VERSION,
  SNAPSHOT_SOURCE,
  createTonghuashunSnapshot,
  isCompatibleDay,
} from './fundFlowSnapshot.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = join(ROOT, '.data', 'fund-flow')
const PORT = Number(process.env.FUND_FLOW_COLLECTOR_PORT || 8787)
const client = new TonghuashunClient()

const BOARD_URLS = {
  industry: (page) => `https://data.10jqka.com.cn/funds/hyzjl/field/tradezdf/order/desc/page/${page}/ajax/1/free/1/`,
  concept: (page) => `https://data.10jqka.com.cn/funds/gnzjl/field/tradezdf/order/desc/page/${page}/ajax/1/free/1/`,
}
const STOCK_URL = (page) => `https://data.10jqka.com.cn/funds/ggzjl/field/zjjlr/order/desc/page/${page}/ajax/1/free/1/`
const LARGE_ORDER_URL = (page) => `https://data.10jqka.com.cn/funds/ddzz/field/stockcode/order/desc/page/${page}/ajax/1/free/1/`
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function shanghaiParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(now)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

function marketMoment(now = new Date()) {
  const parts = shanghaiParts(now)
  const date = `${parts.year}-${parts.month}-${parts.day}`
  const time = `${parts.hour}:${parts.minute}`
  const minute = Number(parts.hour) * 60 + Number(parts.minute)
  const tradingDay = parts.weekday !== 'Sat' && parts.weekday !== 'Sun'
  const morning = minute >= 570 && minute <= 690
  const afternoon = minute >= 810 && minute <= 900
  return { date, time, minute, tradingDay, active: tradingDay && (morning || afternoon) }
}

function emptyDay(date) {
  return { schemaVersion: SNAPSHOT_SCHEMA_VERSION, source: SNAPSHOT_SOURCE, date, snapshots: [] }
}

async function readStoredDay(date) {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, `${date}.json`), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function readDay(date) {
  const day = await readStoredDay(date)
  if (!day) return emptyDay(date)
  if (!isCompatibleDay(day)) {
    return { ...emptyDay(date), incompatibleSource: day.source || 'tencent' }
  }
  return day
}

async function saveSnapshot(date, snapshot) {
  const stored = await readStoredDay(date)
  const day = isCompatibleDay(stored) ? stored : emptyDay(date)
  const snapshots = day.snapshots.filter((item) => item.time !== snapshot.time)
  snapshots.push(snapshot)
  snapshots.sort((left, right) => left.time.localeCompare(right.time))
  const nextDay = { ...emptyDay(date), snapshots }
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(join(DATA_DIR, `${date}.json`), JSON.stringify(nextDay, null, 2))
  return snapshots.length
}

async function fetchBoardRows(sourceType) {
  const pages = await client.fetchPages(BOARD_URLS[sourceType], ['流入资金', '流出资金', '净额'])
  const rows = pages.flatMap((html) => parseTonghuashunBoardTable(html, sourceType))
  if (!rows.length) throw new Error(`同花顺${sourceType === 'industry' ? '行业' : '概念'}资金数据为空`)
  return rows
}

async function fetchStockRows() {
  const pages = await client.fetchPages(STOCK_URL, ['股票代码', '流入资金', '流出资金', '净额'])
  const rows = pages.flatMap(parseTonghuashunStockTable)
  if (!rows.length) throw new Error('同花顺个股资金数据为空')
  return rows
}

async function fetchLargeOrders() {
  const pages = await client.fetchPages(LARGE_ORDER_URL, ['成交时间', '股票代码', '成交额', '大单性质'])
  const rows = pages.flatMap(parseTonghuashunLargeOrderTable)
  if (!rows.length) throw new Error('同花顺大单追踪数据为空')
  return rows
}

async function fetchTonghuashunSnapshot(date, time) {
  // 同一会话页面内串行请求，避免失败分支遗留请求污染下一轮采集。
  const industryBoards = await fetchBoardRows('industry')
  const conceptBoards = await fetchBoardRows('concept')
  const stocks = await fetchStockRows()
  const largeOrders = await fetchLargeOrders()
  return createTonghuashunSnapshot(date, time, [...industryBoards, ...conceptBoards], stocks, largeOrders)
}

let collecting = false
let lastResult = null
let lastSuccessfulResult = null
async function collect({ closingSnapshot = false } = {}) {
  if (collecting) return lastResult
  collecting = true
  try {
    const moment = marketMoment()
    if (!moment.tradingDay) return { skipped: true, reason: 'non-trading-day' }
    const time = closingSnapshot ? '15:00' : moment.time
    const snapshot = await fetchTonghuashunSnapshot(moment.date, time)
    const count = await saveSnapshot(moment.date, snapshot)
    lastResult = {
      ok: true,
      source: SNAPSHOT_SOURCE,
      date: moment.date,
      time,
      capturedAt: snapshot.capturedAt,
      boards: snapshot.boards.length,
      snapshots: count,
      stale: false,
    }
    lastSuccessfulResult = lastResult
    console.log(`[collector] ${moment.date} ${time} · ${snapshot.boards.length} 同花顺板块 · ${count} snapshots`)
    return lastResult
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    lastResult = {
      ok: false,
      source: SNAPSHOT_SOURCE,
      error: message,
      stale: true,
      lastSuccessAt: lastSuccessfulResult?.capturedAt ?? null,
    }
    console.error('[collector]', message)
    return lastResult
  } finally {
    collecting = false
  }
}

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host}`)
    if (request.method === 'GET' && url.pathname === '/api/fund-flow/snapshots') {
      const date = url.searchParams.get('date') || marketMoment().date
      if (!isValidDate(date)) return json(response, 400, { error: 'date 必须是有效的 YYYY-MM-DD' })
      return json(response, 200, await readDay(date))
    }
    if (request.method === 'GET' && url.pathname === '/api/fund-flow/status') {
      return json(response, 200, { source: SNAPSHOT_SOURCE, market: marketMoment(), lastResult })
    }
    if (request.method === 'POST' && url.pathname === '/api/fund-flow/collect') {
      return json(response, 200, await collect())
    }
    return json(response, 404, { error: 'Not found' })
  } catch (error) {
    return json(response, 500, { error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[collector] 同花顺 API http://127.0.0.1:${PORT}`)
})

const current = marketMoment()
if (current.active) {
  void collect()
} else if (current.tradingDay && current.minute > 900) {
  void collect({ closingSnapshot: true })
}

setInterval(() => {
  if (marketMoment().active) void collect()
}, 60_000)

async function shutdown() {
  await client.close()
  server.close()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

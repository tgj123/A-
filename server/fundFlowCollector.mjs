import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = join(ROOT, '.data', 'fund-flow')
const PORT = Number(process.env.FUND_FLOW_COLLECTOR_PORT || 8787)
const TENCENT_BASE = 'https://proxy.finance.qq.com/cgi/cgi-bin/rank/pt/getRank'
const BOARD_SOURCES = [
  { boardType: 'gn', count: 798 },
  { boardType: 'hy2', count: 124 },
]

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
  const weekday = parts.weekday
  const tradingDay = weekday !== 'Sat' && weekday !== 'Sun'
  const morning = minute >= 570 && minute <= 690
  const afternoon = minute >= 810 && minute <= 900
  return { date, time, minute, tradingDay, active: tradingDay && (morning || afternoon) }
}

async function readDay(date) {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, `${date}.json`), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return { date, snapshots: [] }
    throw error
  }
}

async function saveSnapshot(date, snapshot) {
  const day = await readDay(date)
  const withoutSameMinute = day.snapshots.filter((item) => item.time !== snapshot.time)
  withoutSameMinute.push(snapshot)
  withoutSameMinute.sort((a, b) => a.time.localeCompare(b.time))
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(join(DATA_DIR, `${date}.json`), JSON.stringify({ date, snapshots: withoutSameMinute }, null, 2))
  return withoutSameMinute.length
}

async function fetchBoardSource({ boardType, count }) {
  const pageSize = Math.min(100, count)
  const rows = []
  for (let offset = 0; offset < count; offset += pageSize) {
    const url = new URL(TENCENT_BASE)
    url.searchParams.set('board_type', boardType)
    url.searchParams.set('sort_type', 'price')
    url.searchParams.set('direct', 'down')
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('count', String(Math.min(pageSize, count - offset)))
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Referer: 'https://stockapp.finance.qq.com/',
        'User-Agent': 'Mozilla/5.0 FundFlowCollector/1.0',
      },
    })
    if (!response.ok) throw new Error(`Tencent ${boardType} HTTP ${response.status}`)
    const payload = await response.json()
    if (payload.code !== 0 || !Array.isArray(payload.data?.rank_list)) {
      throw new Error(`Tencent ${boardType} response error: ${payload.msg || 'empty rank_list'}`)
    }
    rows.push(...payload.data.rank_list)
    if (payload.data.rank_list.length < Math.min(pageSize, count - offset)) break
  }
  return rows
}

async function fetchTencentBoards() {
  const sources = await Promise.all(BOARD_SOURCES.map(fetchBoardSource))
  return sources.flat().map((row) => ({
    code: String(row.code || ''),
    name: String(row.name || '').replace(/[ⅠⅡⅢⅣⅤ]+$/u, '').replace(/概念$/u, ''),
    boardType: String(row.stock_type || ''),
    netInflow: Number(row.zljlr || 0) * 10_000,
    changePercent: Number(row.zdf || 0),
    turnover: Number(row.turnover || 0) * 10_000,
  })).filter((row) => row.code && row.name)
}

let collecting = false
let lastResult = null
async function collect({ closingSnapshot = false } = {}) {
  if (collecting) return lastResult
  collecting = true
  try {
    const moment = marketMoment()
    if (!moment.tradingDay) return { skipped: true, reason: 'non-trading-day' }
    const time = closingSnapshot ? '15:00' : moment.time
    const boards = await fetchTencentBoards()
    const count = await saveSnapshot(moment.date, {
      time,
      capturedAt: new Date().toISOString(),
      boards,
    })
    lastResult = { ok: true, date: moment.date, time, boards: boards.length, snapshots: count }
    console.log(`[collector] ${moment.date} ${time} · ${boards.length} boards · ${count} snapshots`)
    return lastResult
  } catch (error) {
    lastResult = { ok: false, error: error instanceof Error ? error.message : String(error) }
    console.error('[collector]', lastResult.error)
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
      return json(response, 200, await readDay(date))
    }
    if (request.method === 'GET' && url.pathname === '/api/fund-flow/status') {
      return json(response, 200, { market: marketMoment(), lastResult })
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
  console.log(`[collector] API http://127.0.0.1:${PORT}`)
})

const current = marketMoment()
if (current.active) {
  void collect()
} else if (current.tradingDay && current.minute > 900) {
  // 收盘后启动时至少保存真实收盘累计值，不伪造早前分钟。
  void collect({ closingSnapshot: true })
}

setInterval(() => {
  if (marketMoment().active) void collect()
}, 60_000)

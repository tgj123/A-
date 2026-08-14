import type {
  DailyFundFlow,
  SectorFundFlow,
  SessionFundFlow,
  TencentAdapterConfig,
} from '../types/fundFlow'

interface TencentRawSector {
  code?: unknown
  name?: unknown
  netInflow?: unknown
  mainInflow?: unknown
  mainOutflow?: unknown
  changePercent?: unknown
  leadingStock?: unknown
}

interface TencentRawResponse {
  date?: unknown
  morning?: unknown
  afternoon?: unknown
}

function finiteNumber(value: unknown, field: string): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) {
    throw new Error(`腾讯资金流响应字段 ${field} 不是有效数字`)
  }
  return number
}

function normalizeSession(
  raw: unknown,
  session: SessionFundFlow['session'],
): SessionFundFlow {
  if (!Array.isArray(raw)) {
    throw new Error(`腾讯资金流响应缺少 ${session} 数组`)
  }

  const sectors: SectorFundFlow[] = raw.map((item, index) => {
    const sector = item as TencentRawSector
    const sectorName = typeof sector.name === 'string' ? sector.name.trim() : ''
    if (!sectorName) throw new Error(`腾讯资金流第 ${index + 1} 个板块缺少名称`)

    return {
      sectorCode: typeof sector.code === 'string' ? sector.code : `UNKNOWN-${index}`,
      sectorName,
      netInflow: finiteNumber(sector.netInflow, 'netInflow'),
      mainInflow: finiteNumber(sector.mainInflow, 'mainInflow'),
      mainOutflow: finiteNumber(sector.mainOutflow, 'mainOutflow'),
      changePercent: finiteNumber(sector.changePercent, 'changePercent'),
      rank: index + 1,
      leadingStock: typeof sector.leadingStock === 'string' ? sector.leadingStock : undefined,
    }
  })

  sectors.sort((left, right) => right.netInflow - left.netInflow)
  sectors.forEach((sector, index) => { sector.rank = index + 1 })

  return {
    session,
    label: session === 'morning' ? '上午盘' : '下午盘',
    timeRange: session === 'morning' ? '09:30–11:30' : '13:30–15:00',
    totalNetInflow: sectors.reduce((total, sector) => total + sector.netInflow, 0),
    sectors,
  }
}

/**
 * 腾讯具体字段和签名方式需要以正式开放接口文档为准。
 * 当前适配器只定义前端所需的标准响应契约，不猜测或调用非公开接口。
 */
export class TencentFundFlowAdapter {
  private readonly config: Required<Pick<TencentAdapterConfig, 'endpoint' | 'timeoutMs'>> & TencentAdapterConfig

  constructor(config: TencentAdapterConfig) {
    this.config = { timeoutMs: 10_000, ...config }
  }

  async getDailyFundFlow(date: string, signal?: AbortSignal): Promise<DailyFundFlow> {
    if (!this.config.endpoint) {
      throw new Error('未配置 VITE_TENCENT_FUND_FLOW_ENDPOINT')
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), this.config.timeoutMs)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })

    try {
      const url = new URL(this.config.endpoint, window.location.origin)
      url.searchParams.set('date', date)
      const response = await fetch(url, {
        headers: this.config.appId ? { 'X-App-Id': this.config.appId } : undefined,
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`腾讯资金流请求失败：HTTP ${response.status}`)

      const raw = (await response.json()) as TencentRawResponse
      return {
        tradingDate: typeof raw.date === 'string' ? raw.date : date,
        sourceLabel: '腾讯开放接口',
        dataMode: 'tencent',
        fetchedAt: new Date().toISOString(),
        morning: normalizeSession(raw.morning, 'morning'),
        afternoon: normalizeSession(raw.afternoon, 'afternoon'),
      }
    } finally {
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }
}

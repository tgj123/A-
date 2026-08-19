import type { DailyFundFlow, SectorFundFlow, SessionFundFlow } from '../types/fundFlow'

const sectorNames = [
  '半导体', '人工智能', '证券', '通信设备', '新能源车', '银行', '医药生物', '机器人',
  '消费电子', '有色金属', '软件开发', '国防军工', '电力设备', '光伏设备', '汽车整车',
  '计算机设备', '传媒', '房地产', '煤炭', '食品饮料', '基础化工', '家用电器', '保险', '钢铁',
  '数据中心',
]

function hashDate(value: string): number {
  return [...value].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let result = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function createSectors(date: string, sessionSeed: number): SectorFundFlow[] {
  const random = mulberry32(hashDate(date) + sessionSeed)
  const generated = sectorNames.map((sectorName, index) => {
    const direction = random() > 0.42 ? 1 : -1
    const magnitude = (0.7 + Math.pow(random(), 1.8) * 15) * 100_000_000
    const netInflow = direction * magnitude
    const gross = magnitude * (2.4 + random() * 3.8)

    return {
      sectorCode: `BK${String(1000 + index)}`,
      sectorName,
      netInflow,
      mainInflow: gross + Math.max(netInflow, 0),
      mainOutflow: gross + Math.max(-netInflow, 0),
      changePercent: direction * (0.3 + random() * 4.8),
      rank: 0,
      leadingStock: `${sectorName}龙头`,
    }
  })

  return generated
    .sort((left, right) => right.netInflow - left.netInflow)
    .map((sector, index) => ({ ...sector, rank: index + 1 }))
}

function createSession(
  date: string,
  session: SessionFundFlow['session'],
  seed: number,
): SessionFundFlow {
  const sectors = createSectors(date, seed)
  return {
    session,
    label: session === 'morning' ? '上午盘' : '下午盘',
    timeRange: session === 'morning' ? '09:30–11:30' : '13:30–15:00',
    totalNetInflow: sectors.reduce((total, sector) => total + sector.netInflow, 0),
    sectors,
  }
}

export function createMockDailyFundFlow(date: string): DailyFundFlow {
  return {
    tradingDate: date,
    sourceLabel: '演示数据 · 等待腾讯接口配置',
    dataMode: 'mock',
    fetchedAt: new Date().toISOString(),
    morning: createSession(date, 'morning', 930),
    afternoon: createSession(date, 'afternoon', 1330),
  }
}

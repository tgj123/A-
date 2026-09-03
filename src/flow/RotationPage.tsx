import { useEffect, useMemo, useRef, useState } from 'react'
import { loadDailyFlow } from '../data/fundFlow'
import type { DailyFundFlow, SectorFlow } from '../types'
import { formatAmount } from '../utils/format'
import {
  FLOW_VISIBLE_SECTORS,
  buildTodaySectors,
  getRotationFrame,
  hasPlayableSectors,
  type FlowRoute,
} from './rotationModel'
import { mergeMarketFlowSeries, parseMarketFlowRows, type MarketFlowPoint } from './marketFlow'
import './rotation.css'

const PLAYBACK_MS = 8_000
const ROW_HEIGHT = 24
const BAR_MAX_PERCENT = 82

const FLOW_SELECTED_COUNT = 28

interface RotationPageProps {
  mode: FlowRoute
}

interface MarketFlowResponse {
  data?: { klines?: string[] }
}

const MARKET_FLOW_ENDPOINT = '/market-flow-api/api/qt/stock/fflow/kline/get'

async function loadMarketFlow(signal: AbortSignal): Promise<MarketFlowPoint[]> {
  const indexIds = ['1.000001', '0.399001']
  const results = await Promise.all(indexIds.map(async (secid) => {
    const url = new URL(MARKET_FLOW_ENDPOINT, window.location.origin)
    url.searchParams.set('lmt', '240')
    url.searchParams.set('klt', '1')
    url.searchParams.set('secid', secid)
    url.searchParams.set('fields1', 'f1,f2')
    url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57')
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error(`市场资金请求失败：HTTP ${response.status}`)
    const payload = await response.json() as MarketFlowResponse
    return parseMarketFlowRows(payload.data?.klines ?? [])
  }))
  return mergeMarketFlowSeries(results)
}

function getActiveMarketFlow(series: MarketFlowPoint[], pointIndex: number, pointCount: number): MarketFlowPoint | null {
  if (!series.length) return null
  const ratio = pointCount <= 1 ? 0 : pointIndex / (pointCount - 1)
  const index = Math.min(series.length - 1, Math.round(ratio * (series.length - 1)))
  return series[index] ?? null
}

function getPointCount(sectors: SectorFlow[]): number {
  return Math.max(1, ...sectors.map((sector) => sector.minuteFlow.length))
}

export function RotationPage({ mode }: RotationPageProps) {
  const [data, setData] = useState<DailyFundFlow | null>(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [marketFlowSeries, setMarketFlowSeries] = useState<MarketFlowPoint[]>([])
  const animationRef = useRef<number | null>(null)
  const hasStartedPlaybackRef = useRef(false)
  const hiddenAtRef = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let hasLoaded = false
    const refresh = async () => {
      try {
        const nextData = await loadDailyFlow(controller.signal, FLOW_SELECTED_COUNT)
        if (!controller.signal.aborted) {
          hasLoaded = true
          setData(nextData)
          setError('')
        }
      } catch (reason: unknown) {
        if (!controller.signal.aborted && !hasLoaded) {
          setError(reason instanceof Error ? reason.message : '数据加载失败')
        }
      }
    }

    void refresh()
    void loadMarketFlow(controller.signal).then((series) => {
      if (series.length) setMarketFlowSeries(series)
    }).catch(() => undefined)
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void refresh()
        void loadMarketFlow(controller.signal).then((series) => {
          if (series.length) setMarketFlowSeries(series)
        }).catch(() => undefined)
      }
    }, 60_000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [])

  const sectors = useMemo(() => {
    if (!data) return []
    return mode === 'am'
      ? data.morning.sectors
      : buildTodaySectors(data.morning.sectors, data.afternoon.sectors)
  }, [data, mode])

  const pointCount = getPointCount(sectors)
  const canPlay = hasPlayableSectors(sectors)
  const pointIndex = Math.min(pointCount - 1, Math.floor(progress * pointCount))
  const activeMarketFlow = getActiveMarketFlow(marketFlowSeries, pointIndex, pointCount)
  const flowCards = activeMarketFlow
    ? [
      { label: '主力', value: activeMarketFlow.main },
      { label: '超大', value: activeMarketFlow.superLarge },
      { label: '大单', value: activeMarketFlow.large },
      { label: '中单', value: activeMarketFlow.medium },
      { label: '小单', value: activeMarketFlow.small },
    ]
    : []
  const frame = useMemo(
    () => getRotationFrame(sectors, pointIndex, FLOW_VISIBLE_SECTORS),
    [pointIndex, sectors],
  )
  useEffect(() => {
    if (!canPlay || hasStartedPlaybackRef.current) return
    hasStartedPlaybackRef.current = true
    let startedAt = performance.now()
    let lastRenderedProgress = -1

    const tick = (now: number) => {
      if (document.hidden) {
        hiddenAtRef.current ??= now
        animationRef.current = requestAnimationFrame(tick)
        return
      }
      if (hiddenAtRef.current !== null) {
        startedAt += now - hiddenAtRef.current
        hiddenAtRef.current = null
      }
      const nextProgress = Math.min(1, (now - startedAt) / PLAYBACK_MS)
      if (nextProgress === 1 || nextProgress - lastRenderedProgress >= 0.002) {
        lastRenderedProgress = nextProgress
        setProgress(nextProgress)
      }
      if (nextProgress < 1) animationRef.current = requestAnimationFrame(tick)
    }

    animationRef.current = requestAnimationFrame(tick)
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    }
  }, [canPlay])

  if (error) return <main className="rotation-message">{error}</main>
  if (!data) return <main className="rotation-message">加载中</main>

  return (
    <main className="rotation-page">
      <header className="rotation-header" aria-hidden="true" />

      <section className="rotation-summary" aria-label="交易时间和资金方向说明">
        <strong className="rotation-session-time">
          {mode === 'am' ? '09:30—11:30' : '09:30—15:00'}
        </strong>
        <div className="rotation-legends">
          <span className="rotation-legend inflow"><i />资金流入</span>
          <span className="rotation-legend outflow"><i />资金流出</span>
        </div>
      </section>

      <section className="rotation-flow-cards" aria-label="沪深市场资金分类">
        {flowCards.length > 0 ? flowCards.map((card) => (
          <article className={`rotation-flow-card ${card.value >= 0 ? 'positive' : 'negative'}`} key={card.label}>
            <strong>{card.label}</strong>
            <span className="rotation-flow-card-line" />
            <b>{formatAmount(card.value)}</b>
          </article>
        )) : <p className="rotation-flow-card-loading">资金分类加载中</p>}
      </section>

      <section className="rotation-board" aria-label="板块资金动态榜单">
        {frame.map((item, index) => {
          const width = `${Math.min(BAR_MAX_PERCENT, Math.abs(item.value) / item.scaleMax * BAR_MAX_PERCENT)}%`
          const positive = item.value >= 0
          return (
            <article
              className={`rotation-row ${positive ? 'positive' : 'negative'} ${index === 0 ? 'leader' : ''}`}
              style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
              key={item.sector.code}
            >
              <div className="rotation-sector-meta">
                <span className="rotation-sector-name">{item.sector.name}</span>
              </div>
              <div className="rotation-bar-area">
                <div className="rotation-bar-track" style={{ width }}>
                  <span className="rotation-bar" />
                  <strong className="rotation-amount">{formatAmount(item.value)}</strong>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <footer className="rotation-disclaimer">
        <p>以上内容仅供参考，不构成任何投资建议</p>
      </footer>
    </main>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { loadDailyFlow } from '../data/fundFlow'
import type { DailyFundFlow, SectorFlow } from '../types'
import { formatAmount } from '../utils/format'
import {
  FLOW_VISIBLE_SECTORS,
  buildTodaySectors,
  getRotationFrame,
  type FlowRoute,
} from './rotationModel'
import './rotation.css'

const PLAYBACK_MS = 8_000
const END_HOLD_MS = 4_000
const ROW_HEIGHT = 34
const BAR_MAX_PERCENT = 78

interface RotationPageProps {
  mode: FlowRoute
}

function getPointCount(sectors: SectorFlow[]): number {
  return Math.max(1, ...sectors.map((sector) => sector.minuteFlow.length))
}

export function RotationPage({ mode }: RotationPageProps) {
  const [data, setData] = useState<DailyFundFlow | null>(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [cycle, setCycle] = useState(0)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let hasLoaded = false
    const refresh = async () => {
      try {
        const nextData = await loadDailyFlow(controller.signal)
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
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh()
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
  const pointIndex = Math.min(pointCount - 1, Math.floor(progress * pointCount))
  const frame = useMemo(
    () => getRotationFrame(sectors, pointIndex, FLOW_VISIBLE_SECTORS),
    [pointIndex, sectors],
  )
  useEffect(() => {
    if (sectors.length === 0) return
    const startedAt = performance.now()
    let lastRenderedProgress = -1

    const tick = (now: number) => {
      if (document.hidden) {
        animationRef.current = requestAnimationFrame(tick)
        return
      }
      const elapsed = now - startedAt
      if (elapsed < PLAYBACK_MS) {
        const nextProgress = Math.min(1, elapsed / PLAYBACK_MS)
        if (nextProgress - lastRenderedProgress >= 0.002) {
          lastRenderedProgress = nextProgress
          setProgress(nextProgress)
        }
        animationRef.current = requestAnimationFrame(tick)
        return
      }
      setProgress(1)
      if (elapsed < PLAYBACK_MS + END_HOLD_MS) {
        animationRef.current = requestAnimationFrame(tick)
        return
      }
      setCycle((value) => value + 1)
    }

    animationRef.current = requestAnimationFrame(tick)
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    }
  }, [cycle, sectors])

  if (error) return <main className="rotation-message">{error}</main>
  if (!data) return <main className="rotation-message">加载中</main>

  return (
    <main className="rotation-page">
      <header className="rotation-header" aria-hidden="true" />

      <section className="rotation-summary" aria-label="资金方向说明">
        <span className="rotation-legend outflow"><i />资金流出</span>
        <span className="rotation-zero-label">0 亿</span>
        <span className="rotation-legend inflow"><i />资金流入</span>
      </section>

      <section className="rotation-board" aria-label="板块资金动态排名">
        <div className="rotation-axis" aria-hidden="true" />
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
                <div className="rotation-half negative-half">
                  {!positive && (
                    <div className="rotation-bar-track" style={{ width }}>
                      <strong className="rotation-amount">{formatAmount(item.value)}</strong>
                      <span className="rotation-bar" />
                    </div>
                  )}
                </div>
                <div className="rotation-half positive-half">
                  {positive && (
                    <div className="rotation-bar-track" style={{ width }}>
                      <span className="rotation-bar" />
                      <strong className="rotation-amount">{formatAmount(item.value)}</strong>
                    </div>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <footer className="rotation-disclaimer">
        以上内容仅供参考，不构成任何投资建议
      </footer>
    </main>
  )
}

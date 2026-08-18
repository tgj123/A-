import { useCallback, useEffect, useMemo, useState } from 'react'
import { EnergyScene } from './components/EnergyScene'
import { loadDailyFlow } from './data/fundFlow'
import type { DailyFundFlow, SectorFlow, SessionKey } from './types'

export type ViewMode = 'am' | 'pm' | 'all'

function getMode(): ViewMode {
  const route = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase()
  if (route === 'pm' || route === 'all') return route
  return 'am'
}

function combineAll(data: DailyFundFlow): SectorFlow[] {
  const map = new Map<string, SectorFlow>()
  for (const morning of data.morning.sectors) map.set(morning.code, { ...morning })
  for (const afternoon of data.afternoon.sectors) {
    const morning = map.get(afternoon.code)
    if (!morning) continue
    const morningEnd = morning.minuteFlow.at(-1)?.value ?? 0
    const minuteFlow = [
      ...morning.minuteFlow,
      ...afternoon.minuteFlow.map((point) => ({ ...point, value: morningEnd + point.value })),
    ]
    map.set(afternoon.code, {
      ...afternoon,
      minuteFlow,
    })
  }
  return [...map.values()].sort((a, b) => b.heatScore - a.heatScore)
}

export function App() {
  const [data, setData] = useState<DailyFundFlow | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<ViewMode>(getMode)
  const [playbackTime, setPlaybackTime] = useState('')
  const [playbackProgress, setPlaybackProgress] = useState(0)
  const [replayCycle, setReplayCycle] = useState(0)

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
    // 每分钟刷新候选板块池；单轮播放内保持稳定，刷新后热点模块自动进入下一轮。
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh()
    }, 60_000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const update = () => setMode(getMode())
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  const sectors = useMemo(() => {
    if (!data) return []
    if (mode === 'am') return data.morning.sectors
    if (mode === 'pm') return data.afternoon.sectors
    return combineAll(data)
  }, [data, mode])

  const session: SessionKey = mode === 'am' ? 'morning' : mode === 'pm' ? 'afternoon' : 'summary'
  const sessionStart = mode === 'pm' ? '13:30' : '09:30'
  const sessionEnd = mode === 'am' ? '11:30' : '15:00'
  const onPlaybackTime = useCallback((time: string) => setPlaybackTime(time), [])
  const onPlaybackProgress = useCallback((progress: number) => setPlaybackProgress(progress), [])
  const onReplay = useCallback(() => {
    setPlaybackTime(sessionStart)
    setPlaybackProgress(0)
    setReplayCycle((value) => value + 1)
  }, [sessionStart])
  const onHighlight = useCallback(() => undefined, [])

  if (error) return <main className="chart-message">{error}</main>
  if (!data) return <main className="chart-message">加载中</main>

  return (
    <main className="chart-page">
      <header className="chart-header">
        <div className="playback-control" aria-label="行情回放进度">
          <div className="playback-meta">
            <span className="playback-label">
              资金流入流出追踪
            </span>
            <strong className="playback-time">{playbackTime || sessionStart}</strong>
          </div>
          <div className="playback-row">
            <span className="playback-boundary">{sessionStart}</span>
            <div
              className="playback-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(playbackProgress * 100)}
            >
              <span className="playback-fill" style={{ width: `${playbackProgress * 100}%` }} />
              <span className="playback-thumb" style={{ left: `${playbackProgress * 100}%` }} />
            </div>
            <span className="playback-boundary">{sessionEnd}</span>
            <button className="replay-button" type="button" onClick={onReplay} aria-label="重新播放行情动画">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 11a8 8 0 1 1-2.34-5.66L20 7.68M20 3v4.68h-4.68" />
              </svg>
              <span>重新播放</span>
            </button>
          </div>
        </div>
      </header>
      <section className="chart-stage">
        <EnergyScene
          sectors={sectors}
          session={session}
          playing
          cycle={(mode === 'am' ? 1 : mode === 'pm' ? 2 : 3) * 1_000 + replayCycle}
          onHighlight={onHighlight}
          onPlaybackTime={onPlaybackTime}
          onPlaybackProgress={onPlaybackProgress}
        />
      </section>
      <footer className="chart-disclaimer">
        <p>以上内容仅供参考，不构成任何投资建议</p>
        <p>市场有风险，投资需谨慎</p>
      </footer>
    </main>
  )
}

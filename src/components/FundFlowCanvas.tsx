import { useEffect, useRef } from 'react'
import { FundFlowScene, type SceneFrame } from '../three/FundFlowScene'
import type { SectorFundFlow } from '../types/fundFlow'

interface FundFlowCanvasProps {
  sectors: SectorFundFlow[]
  frameRef: React.MutableRefObject<SceneFrame>
}

export function FundFlowCanvas({ sectors, frameRef }: FundFlowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<FundFlowScene | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const scene = new FundFlowScene(containerRef.current)
    sceneRef.current = scene
    scene.start(() => frameRef.current)

    const onVisibilityChange = () => {
      frameRef.current.isPaused = document.hidden || frameRef.current.isPaused
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      scene.dispose()
      sceneRef.current = null
    }
  }, [frameRef])

  useEffect(() => {
    sceneRef.current?.setSectors(sectors)
  }, [sectors])

  return <div ref={containerRef} className="canvas-host" aria-hidden="true" />
}

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import type { SectorFlow, SessionKey } from '../types'
import { formatAmount } from '../utils/format'

interface EnergySceneProps {
  sectors: SectorFlow[]
  session: SessionKey
  playing: boolean
  cycle: number
  onHighlight: (sector: SectorFlow | null) => void
  onPlaybackTime: (time: string) => void
  onPlaybackProgress: (progress: number) => void
}

interface FlowVisual {
  sector: SectorFlow
  line: Line2
  connector: Line2
  marker: THREE.Mesh
  points: THREE.Vector3[]
  linePositions: Float32Array
  label: HTMLButtonElement
  labelTopPercent: number
  currentValue: number
  isPositive: boolean
}

const RED = new THREE.Color('#e06b68')
const GREEN = new THREE.Color('#57a985')
const WORLD_LEFT = -5
const WORLD_RIGHT = 5
const WORLD_TOP = 8.25
const WORLD_BOTTOM = -6.75
const PLAYBACK_SECONDS = 8
const FRAME_UPDATE_INTERVAL_MS = 1000 / 30
const RANKING_STEP_MINUTES = 10

function createLabel(sector: SectorFlow): HTMLButtonElement {
  const label = document.createElement('button')
  label.className = `flow-label ${sector.netInflow >= 0 ? 'inflow' : 'outflow'}`
  label.innerHTML = `<strong>${sector.name}</strong><span>${formatAmount(sector.netInflow)}</span>`
  label.type = 'button'
  return label
}

function makeTicks(session: SessionKey): Array<{ text: string; position: number }> {
  if (session === 'morning') return [
    { text: '09:30', position: 0 }, { text: '10:00', position: 0.25 }, { text: '10:30', position: 0.5 },
    { text: '11:00', position: 0.75 }, { text: '11:30', position: 1 },
  ]
  if (session === 'afternoon') return [
    { text: '13:30', position: 0 }, { text: '14:00', position: 1 / 3 },
    { text: '14:30', position: 2 / 3 }, { text: '15:00', position: 1 },
  ]
  // 全天压缩午休区间，但保留 11:30 / 13:30 两个相邻断点。
  return [
    { text: '09:30', position: 0 }, { text: '10:30', position: 60 / 211 },
    { text: '11:30', position: 120 / 211 }, { text: '13:30', position: 121 / 211 },
    { text: '14:30', position: 181 / 211 }, { text: '15:00', position: 1 },
  ]
}

export function EnergyScene({
  sectors,
  session,
  playing,
  cycle,
  onHighlight,
  onPlaybackTime,
  onPlaybackProgress,
}: EnergySceneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playingRef = useRef(playing)
  const callbackRef = useRef(onPlaybackTime)
  const progressCallbackRef = useRef(onPlaybackProgress)

  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { callbackRef.current = onPlaybackTime }, [onPlaybackTime])
  useEffect(() => { progressCallbackRef.current = onPlaybackProgress }, [onPlaybackProgress])

  useEffect(() => {
    const host = hostRef.current
    if (!host || sectors.length === 0) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#ffffff')
    const camera = new THREE.OrthographicCamera(WORLD_LEFT, WORLD_RIGHT, WORLD_TOP, WORLD_BOTTOM, 0.1, 20)
    camera.position.z = 8
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)

    const labelLayer = document.createElement('div')
    labelLayer.className = 'flow-label-layer'
    host.appendChild(labelLayer)
    const axisLayer = document.createElement('div')
    axisLayer.className = 'flow-axis-layer'
    host.appendChild(axisLayer)

    const ranked = [...sectors].filter((item) => item.minuteFlow.length > 1).sort((a, b) => b.netInflow - a.netInflow).slice(0, 24)
    const positive = ranked.filter((item) => item.netInflow >= 0)
    const negative = ranked.filter((item) => item.netInflow < 0)
    const allValues = ranked.flatMap((sector) => sector.minuteFlow.map((point) => point.value))
    const observedPositive = Math.max(...allValues, 1)
    const observedNegative = Math.max(...allValues.map((value) => -value), 1)
    const positiveMaxYi = Math.max(10, Math.ceil(observedPositive / 100_000_000 / 10) * 10)
    const negativeMaxYi = Math.max(50, Math.ceil(observedNegative / 100_000_000 / 50) * 50)
    const axisMax = positiveMaxYi * 100_000_000
    const axisMin = -negativeMaxYi * 100_000_000
    const plotTop = 5.5
    const plotBottom = -5.9
    const chartLeft = -3.25
    // 折线终点提前收在左侧，为动态点到固定标签的细连接线留出明显距离。
    const chartRight = -0.15
    const gridLeft = -3.55
    const gridRight = 4.7
    const yAxisX = -3.62
    const xAxisY = -6.1

    // 正负资金共用同一金额比例，0 亿的位置由真实上下限决定。
    const toY = (value: number) => plotBottom
      + ((value - axisMin) / Math.max(axisMax - axisMin, 1)) * (plotTop - plotBottom)

    const yTickValues = [
      positiveMaxYi,
      0,
      -Math.round(negativeMaxYi / 3),
      -Math.round(negativeMaxYi * 2 / 3),
      -negativeMaxYi,
    ]
    const yTickWorldPositions = yTickValues.map((value) => toY(value * 100_000_000))
    const zeroY = toY(0)

    const gradientTop = WORLD_TOP - 0.25
    const gradientBottom = plotBottom

    // 渐变覆盖顶部标签区域，并以真实的 0 亿坐标切分正负颜色。
    const gradientCanvas = document.createElement('canvas')
    gradientCanvas.width = 2
    gradientCanvas.height = 256
    const gradientContext = gradientCanvas.getContext('2d')
    if (gradientContext) {
      const zeroRatio = (gradientTop - zeroY) / (gradientTop - gradientBottom)
      const gradient = gradientContext.createLinearGradient(0, 0, 0, gradientCanvas.height)
      gradient.addColorStop(0, 'rgb(255, 245, 244)')
      gradient.addColorStop(zeroRatio, 'rgb(255, 255, 255)')
      gradient.addColorStop(1, 'rgb(244, 251, 248)')
      gradientContext.fillStyle = gradient
      gradientContext.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height)
    }
    const areaGradientTexture = new THREE.CanvasTexture(gradientCanvas)
    areaGradientTexture.colorSpace = THREE.SRGBColorSpace
    const areaGradientGeometry = new THREE.PlaneGeometry(gridRight - gridLeft, gradientTop - gradientBottom)
    const areaGradientMaterial = new THREE.MeshBasicMaterial({
      map: areaGradientTexture,
      transparent: true,
      depthWrite: false,
    })
    const areaGradient = new THREE.Mesh(areaGradientGeometry, areaGradientMaterial)
    areaGradient.position.set((gridLeft + gridRight) / 2, (gradientTop + gradientBottom) / 2, -0.5)
    scene.add(areaGradient)

    const gridMaterial = new THREE.LineBasicMaterial({ color: '#d9dde2', transparent: true, opacity: 0.7 })
    const gridLines: THREE.Line[] = []
    yTickWorldPositions.forEach((y, index) => {
      if (index === 1) return
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(gridLeft, y, 0), new THREE.Vector3(gridRight, y, 0)]),
        gridMaterial,
      )
      scene.add(line)
      gridLines.push(line)
    })
    const zeroLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(gridLeft, zeroY, 0), new THREE.Vector3(gridRight, zeroY, 0)]),
      new THREE.LineDashedMaterial({ color: '#87919c', dashSize: 0.12, gapSize: 0.09 }),
    )
    zeroLine.computeLineDistances()
    scene.add(zeroLine)

    const xTicks = makeTicks(session).map(({ text, position }) => {
      const tick = document.createElement('span')
      tick.className = 'x-axis-tick'
      tick.textContent = text
      axisLayer.appendChild(tick)
      return { element: tick, position }
    })

    const yTicks = yTickValues.map((value) => {
      const tick = document.createElement('span')
      tick.className = 'y-axis-tick'
      tick.textContent = `${value} 亿`
      axisLayer.appendChild(tick)
      return tick
    })

    const visuals: FlowVisual[] = []
    const createVisual = (sector: SectorFlow, order: number, total: number, isPositive: boolean) => {
      const count = sector.minuteFlow.length
      const points = sector.minuteFlow.map((point, index) => new THREE.Vector3(
        chartLeft + index / Math.max(count - 1, 1) * (chartRight - chartLeft),
        toY(point.value),
        0,
      ))
      const lineGeometry = new LineGeometry()
      const linePositions = new Float32Array(points.length * 3)
      for (let index = 0; index < points.length; index += 1) {
        linePositions[index * 3] = points[0].x
        linePositions[index * 3 + 1] = points[0].y
      }
      lineGeometry.setPositions(linePositions)
      const lineMaterial = new LineMaterial({
        color: isPositive ? RED.getHex() : GREEN.getHex(),
        linewidth: order < 3 ? 2.05 : order < 8 ? 1.5 : 1.18,
        transparent: true,
        opacity: order < 3 ? 0.9 : order < 8 ? 0.66 : 0.4,
        worldUnits: false,
      })
      lineMaterial.resolution.set(host.clientWidth, host.clientHeight)
      const line = new Line2(lineGeometry, lineMaterial)
      line.computeLineDistances()
      scene.add(line)
      const marker = new THREE.Mesh(
        new THREE.CircleGeometry(order < 3 ? 0.07 : 0.052, 20),
        new THREE.MeshBasicMaterial({ color: isPositive ? RED : GREEN }),
      )
      marker.position.copy(points[0])
      scene.add(marker)
      const connectorGeometry = new LineGeometry()
      connectorGeometry.setPositions([points[0].x, points[0].y, 0, points[0].x, points[0].y, 0])
      const connectorMaterial = new LineMaterial({
        color: isPositive ? 0xe4aaa7 : 0x9bcbb5,
        linewidth: 1.15,
        transparent: true,
        opacity: 0.62,
        worldUnits: false,
      })
      connectorMaterial.resolution.set(host.clientWidth, host.clientHeight)
      const connector = new Line2(connectorGeometry, connectorMaterial)
      connector.computeLineDistances()
      scene.add(connector)
      const label = createLabel(sector)
      label.style.opacity = '1'
      label.addEventListener('click', () => onHighlight(sector))
      labelLayer.appendChild(label)
      const labelTopPercent = 0
      visuals.push({
        sector,
        line,
        connector,
        marker,
        points,
        linePositions,
        label,
        labelTopPercent,
        currentValue: 0,
        isPositive,
      })
    }
    positive.forEach((sector, index) => createVisual(sector, index, positive.length, true))
    negative.forEach((sector, index) => createVisual(sector, index, negative.length, false))

    let elapsed = 0
    let lastTime = performance.now()
    let frame = 0
    let lastReportedIndex = -1
    let lastRenderedAt = 0
    let completed = false
    progressCallbackRef.current(0)

    const resize = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      renderer.setSize(width, height, false)
      camera.left = WORLD_LEFT
      camera.right = WORLD_RIGHT
      camera.top = WORLD_TOP
      camera.bottom = WORLD_BOTTOM
      camera.updateProjectionMatrix()

      const worldToPercent = (point: THREE.Vector3) => ({
        x: (point.x - WORLD_LEFT) / (WORLD_RIGHT - WORLD_LEFT) * 100,
        y: (WORLD_TOP - point.y) / (WORLD_TOP - WORLD_BOTTOM) * 100,
      })
      xTicks.forEach(({ element, position }) => {
        const screen = worldToPercent(new THREE.Vector3(
          chartLeft + position * (chartRight - chartLeft),
          xAxisY,
          0,
        ))
        element.style.left = `${screen.x}%`
        element.style.top = `${screen.y}%`
      })
      yTicks.forEach((element, index) => {
        const screen = worldToPercent(new THREE.Vector3(yAxisX, yTickWorldPositions[index], 0))
        element.style.left = `${screen.x}%`
        element.style.top = `${screen.y}%`
      })

      visuals.forEach((visual) => {
        const material = visual.line.material as LineMaterial
        material.resolution.set(width, height)
        const connectorMaterial = visual.connector.material as LineMaterial
        connectorMaterial.resolution.set(width, height)
      })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    const updateRanking = () => {
      const inflows = visuals
        .filter((visual) => visual.currentValue >= 0)
        .sort((a, b) => b.currentValue - a.currentValue)
      // 数值从大到小：较小流出在上，较大流出在下。
      const outflows = visuals
        .filter((visual) => visual.currentValue < 0)
        .sort((a, b) => b.currentValue - a.currentValue)
      const ordered = [...inflows, ...outflows]
      const top = 5
      const bottom = 96
      const groupGap = inflows.length > 0 && outflows.length > 0 ? 0.5 : 0
      const step = ordered.length > 1
        ? (bottom - top - groupGap) / (ordered.length - 1)
        : 0

      inflows.forEach((visual, rank) => {
        visual.labelTopPercent = top + rank * step
      })
      outflows.forEach((visual, rank) => {
        visual.labelTopPercent = top + (inflows.length + rank) * step + groupGap
      })
    }

    const updateVisualStyle = (visual: FlowVisual, value: number) => {
      const isPositive = value >= 0
      if (visual.isPositive === isPositive) return
      visual.isPositive = isPositive
      const color = isPositive ? RED : GREEN
      ;(visual.line.material as LineMaterial).color.copy(color)
      ;(visual.marker.material as THREE.MeshBasicMaterial).color.copy(color)
      const connectorMaterial = visual.connector.material as LineMaterial
      connectorMaterial.color.setHex(isPositive ? 0xe4aaa7 : 0x9bcbb5)
      visual.label.classList.toggle('inflow', isPositive)
      visual.label.classList.toggle('outflow', !isPositive)
    }

    const updateLabel = (
      visual: FlowVisual,
      point: THREE.Vector3,
      value: number,
      updateContent: boolean,
      updatePosition: boolean,
    ) => {
      const targetX = host.clientWidth * 0.58
      const targetY = host.clientHeight * visual.labelTopPercent / 100
      if (updatePosition) {
        visual.label.style.transform = `translate3d(${targetX}px, ${targetY - 12}px, 0)`
      }
      if (updateContent) {
        const amount = visual.label.querySelector('span')
        if (amount) amount.textContent = formatAmount(value)
      }
      const labelWorld = new THREE.Vector3(
        (targetX / host.clientWidth) * 2 - 1,
        -(targetY / host.clientHeight) * 2 + 1,
        0,
      ).unproject(camera)
      visual.connector.geometry.setPositions([
        point.x, point.y, point.z,
        labelWorld.x + 0.015, labelWorld.y, 0,
      ])
      ;(visual.connector.material as LineMaterial).opacity = 0.62
    }

    const animate = (now: number) => {
      if (completed) return
      frame = requestAnimationFrame(animate)
      const delta = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      if (playingRef.current) elapsed = Math.min(PLAYBACK_SECONDS, elapsed + delta)
      const progress = elapsed / PLAYBACK_SECONDS
      // 24 条宽线和连接线的几何更新较重，稳定在 30 FPS 比满帧抢占主线程更顺滑。
      if (now - lastRenderedAt < FRAME_UPDATE_INTERVAL_MS && progress < 1) return
      lastRenderedAt = now
      progressCallbackRef.current(progress)
      const referenceLength = Math.max(...visuals.map((visual) => visual.points.length), 2)
      const playbackIndex = Math.min(referenceLength - 1, Math.floor(progress * (referenceLength - 1)))
      const rankingChanged = playbackIndex !== lastReportedIndex
      if (rankingChanged) {
        lastReportedIndex = playbackIndex
        const reference = visuals.find((visual) => visual.sector.minuteFlow[playbackIndex])
        if (reference) callbackRef.current(reference.sector.minuteFlow[playbackIndex].time)
      }

      let polarityChanged = false
      visuals.forEach((visual) => {
        const pointCount = visual.points.length
        if (pointCount < 2) return
        const exactIndex = progress * (pointCount - 1)
        const fromIndex = Math.max(0, Math.min(pointCount - 1, Math.floor(exactIndex)))
        const toIndex = Math.min(pointCount - 1, fromIndex + 1)
        const ratio = exactIndex - fromIndex
        const fromPoint = visual.points[fromIndex]
        const toPoint = visual.points[toIndex] ?? fromPoint
        if (!fromPoint || !toPoint) return
        visual.marker.position.copy(fromPoint).lerp(toPoint, ratio)
        const fromValue = visual.sector.minuteFlow[fromIndex]?.value ?? 0
        const toValue = visual.sector.minuteFlow[toIndex]?.value ?? fromValue
        visual.currentValue = fromValue + (toValue - fromValue) * ratio
        const nextPositive = visual.currentValue >= 0
        polarityChanged ||= visual.isPositive !== nextPositive
        updateVisualStyle(visual, visual.currentValue)
      })

      const rankingUpdated = polarityChanged
        || (rankingChanged && (playbackIndex % RANKING_STEP_MINUTES === 0 || progress >= 1))
      if (rankingUpdated) updateRanking()

      visuals.forEach((visual) => {
        const pointCount = visual.points.length
        if (pointCount < 2) return
        const fromIndex = Math.max(0, Math.min(pointCount - 1, Math.floor(progress * (pointCount - 1))))
        const current = visual.marker.position
        for (let index = 0; index < pointCount; index += 1) {
          const point = index <= fromIndex ? visual.points[index] : current
          const offset = index * 3
          visual.linePositions[offset] = point.x
          visual.linePositions[offset + 1] = point.y
          visual.linePositions[offset + 2] = point.z
        }
        visual.line.geometry.setPositions(visual.linePositions)
        updateLabel(visual, current, visual.currentValue, rankingChanged, rankingUpdated)
      })
      renderer.render(scene, camera)
      if (progress >= 1) {
        completed = true
        cancelAnimationFrame(frame)
      }
    }
    frame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      visuals.forEach((visual) => {
        visual.line.geometry.dispose(); (visual.line.material as THREE.Material).dispose()
        visual.connector.geometry.dispose(); (visual.connector.material as LineMaterial).dispose()
        visual.marker.geometry.dispose(); (visual.marker.material as THREE.Material).dispose()
        visual.label.remove()
      })
      gridLines.forEach((line) => line.geometry.dispose())
      gridMaterial.dispose()
      areaGradientGeometry.dispose(); areaGradientMaterial.dispose(); areaGradientTexture.dispose()
      zeroLine.geometry.dispose(); (zeroLine.material as THREE.Material).dispose()
      labelLayer.remove(); axisLayer.remove()
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove()
    }
  }, [sectors, session, cycle, onHighlight])

  return <div className="energy-scene flow-chart" ref={hostRef} aria-label="A股板块分钟资金流向动画图" />
}

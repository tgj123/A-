import * as THREE from 'three'
import type { MarketSession, SectorFundFlow } from '../types/fundFlow'

const RED = new THREE.Color(0xff3f33)
const GREEN = new THREE.Color(0x14d78b)
const DARK_RED = new THREE.Color(0x6f1714)
const DARK_GREEN = new THREE.Color(0x075f42)

interface SectorVisual {
  sector: SectorFundFlow
  position: THREE.Vector3
  baseHeight: number
}

export interface SceneFrame {
  session: MarketSession
  localProgress: number
  elapsedSeconds: number
  isPaused: boolean
}

export class FundFlowScene {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  private readonly renderer: THREE.WebGLRenderer
  private readonly clock = new THREE.Clock()
  private readonly root = new THREE.Group()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2(10, 10)
  private readonly baseGeometry = new THREE.CylinderGeometry(0.82, 0.98, 0.22, 6)
  private readonly towerGeometry = new THREE.CylinderGeometry(0.48, 0.62, 1, 6)
  private readonly baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d201b,
    metalness: 0.55,
    roughness: 0.45,
  })
  private readonly positiveMaterial = new THREE.MeshStandardMaterial({
    color: RED,
    emissive: DARK_RED,
    emissiveIntensity: 1.4,
    metalness: 0.25,
    roughness: 0.3,
  })
  private readonly negativeMaterial = new THREE.MeshStandardMaterial({
    color: GREEN,
    emissive: DARK_GREEN,
    emissiveIntensity: 1.2,
    metalness: 0.25,
    roughness: 0.34,
  })
  private readonly ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x3b6b5d,
    transparent: true,
    opacity: 0.28,
  })
  private readonly particleMaterial = new THREE.PointsMaterial({
    size: 0.055,
    vertexColors: true,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })

  private bases?: THREE.InstancedMesh
  private positiveTowers?: THREE.InstancedMesh
  private negativeTowers?: THREE.InstancedMesh
  private particles?: THREE.Points
  private visuals: SectorVisual[] = []
  private animationFrame = 0
  private resizeObserver?: ResizeObserver
  private disposed = false

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.renderer.setClearColor(0x020907, 1)
    this.renderer.domElement.className = 'scene-canvas'
    this.container.appendChild(this.renderer.domElement)

    this.scene.fog = new THREE.FogExp2(0x020907, 0.055)
    this.scene.add(this.root)
    this.camera.position.set(0, 8.6, 14.5)
    this.camera.lookAt(0, 0, 0)

    const ambient = new THREE.HemisphereLight(0x8fffe2, 0x08110e, 1.7)
    const key = new THREE.DirectionalLight(0xffffff, 3.5)
    key.position.set(-4, 10, 7)
    const redRim = new THREE.PointLight(0xff493f, 20, 22)
    redRim.position.set(6, 4, -2)
    const greenRim = new THREE.PointLight(0x17e499, 16, 20)
    greenRim.position.set(-6, 2, 2)
    this.scene.add(ambient, key, redRim, greenRim)

    this.createEnvironment()
    this.bindEvents()
    this.resize()
  }

  setSectors(sectors: SectorFundFlow[]): void {
    this.clearDataObjects()
    const selected = sectors.slice(0, 24)
    const maxAbs = Math.max(...selected.map((sector) => Math.abs(sector.netInflow)), 1)
    const columns = 5
    const dummy = new THREE.Object3D()

    this.bases = new THREE.InstancedMesh(this.baseGeometry, this.baseMaterial, selected.length)
    this.positiveTowers = new THREE.InstancedMesh(this.towerGeometry, this.positiveMaterial, selected.length)
    this.negativeTowers = new THREE.InstancedMesh(this.towerGeometry, this.negativeMaterial, selected.length)
    this.bases.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.positiveTowers.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.negativeTowers.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    this.visuals = selected.map((sector, index) => {
      const row = Math.floor(index / columns)
      const column = index % columns
      const stagger = row % 2 === 0 ? 0 : 0.75
      const position = new THREE.Vector3((column - 2) * 1.65 + stagger, 0, (row - 2) * 1.5)
      const baseHeight = 0.55 + Math.sqrt(Math.abs(sector.netInflow) / maxAbs) * 4.5

      dummy.position.copy(position).setY(-0.08)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      this.bases?.setMatrixAt(index, dummy.matrix)
      return { sector, position, baseHeight }
    })

    this.positiveTowers.userData.pickable = true
    this.negativeTowers.userData.pickable = true
    this.root.add(this.bases, this.positiveTowers, this.negativeTowers)
    this.createParticles(selected)
  }

  renderFrame(frame: SceneFrame): void {
    if (this.disposed) return
    const time = frame.elapsedSeconds
    const entrance = easeOutCubic(Math.min(frame.localProgress / 0.34, 1))
    const summaryPulse = frame.session === 'summary' ? 1 + Math.sin(time * 2.4) * 0.06 : 1
    const dummy = new THREE.Object3D()

    this.visuals.forEach((visual, index) => {
      const delay = index * 0.018
      const reveal = easeOutBack(clamp((entrance - delay) / Math.max(1 - delay, 0.01)))
      const height = Math.max(0.001, visual.baseHeight * reveal * summaryPulse)
      const active = visual.sector.netInflow >= 0 ? this.positiveTowers : this.negativeTowers
      const inactive = visual.sector.netInflow >= 0 ? this.negativeTowers : this.positiveTowers

      dummy.position.copy(visual.position).setY(height * 0.5 + 0.08)
      dummy.scale.set(1, height, 1)
      dummy.rotation.y = Math.sin(time * 0.35 + index) * 0.08
      dummy.updateMatrix()
      active?.setMatrixAt(index, dummy.matrix)

      dummy.position.set(0, -100, 0)
      dummy.scale.setScalar(0.001)
      dummy.updateMatrix()
      inactive?.setMatrixAt(index, dummy.matrix)
    })
    if (this.positiveTowers) this.positiveTowers.instanceMatrix.needsUpdate = true
    if (this.negativeTowers) this.negativeTowers.instanceMatrix.needsUpdate = true

    const orbit = frame.session === 'summary' ? 0.28 : frame.session === 'morning' ? -0.42 : 0.48
    const targetAngle = orbit + frame.localProgress * 0.55
    const radius = frame.session === 'summary' ? 14.2 : 13.4
    this.camera.position.x = Math.sin(targetAngle) * radius
    this.camera.position.z = Math.cos(targetAngle) * radius
    this.camera.position.y = 7.5 + Math.sin(frame.localProgress * Math.PI) * 1.4
    this.camera.lookAt(0, 1.1, 0)

    if (this.particles) {
      this.particles.rotation.y = time * 0.055
      const positions = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let index = 0; index < positions.count; index += 1) {
        let y = positions.getY(index) + 0.012 + (index % 7) * 0.0007
        if (y > 6.5) y = -0.2
        positions.setY(index, y)
      }
      positions.needsUpdate = true
    }

    this.root.rotation.y = Math.sin(time * 0.16) * 0.045
    this.renderer.render(this.scene, this.camera)
  }

  start(getFrame: () => SceneFrame): void {
    this.clock.start()
    const loop = () => {
      if (this.disposed) return
      this.animationFrame = requestAnimationFrame(loop)
      this.renderFrame(getFrame())
    }
    loop()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.animationFrame)
    this.resizeObserver?.disconnect()
    window.removeEventListener('pointermove', this.onPointerMove)
    this.clearDataObjects()
    this.baseGeometry.dispose()
    this.towerGeometry.dispose()
    this.baseMaterial.dispose()
    this.positiveMaterial.dispose()
    this.negativeMaterial.dispose()
    this.ringMaterial.dispose()
    this.particleMaterial.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private createEnvironment(): void {
    const rings = [2.8, 5.2, 7.8]
    rings.forEach((radius) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.025, 96), this.ringMaterial)
      ring.rotation.x = -Math.PI / 2
      ring.position.y = -0.18
      this.root.add(ring)
    })

    const grid = new THREE.GridHelper(25, 25, 0x1c4f40, 0x0a201a)
    grid.position.y = -0.2
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.28
    this.root.add(grid)
  }

  private createParticles(sectors: SectorFundFlow[]): void {
    const count = Math.min(1800, Math.max(700, sectors.length * 65))
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      const sector = sectors[index % sectors.length]
      const angle = Math.random() * Math.PI * 2
      const radius = 1.8 + Math.random() * 8.2
      positions[index * 3] = Math.cos(angle) * radius
      positions[index * 3 + 1] = Math.random() * 6.5 - 0.2
      positions[index * 3 + 2] = Math.sin(angle) * radius
      const color = sector.netInflow >= 0 ? RED : GREEN
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.particles = new THREE.Points(geometry, this.particleMaterial)
    this.root.add(this.particles)
  }

  private clearDataObjects(): void {
    for (const object of [this.bases, this.positiveTowers, this.negativeTowers, this.particles]) {
      if (!object) continue
      this.root.remove(object)
      if (object === this.particles) object.geometry.dispose()
    }
    this.bases = undefined
    this.positiveTowers = undefined
    this.negativeTowers = undefined
    this.particles = undefined
    this.visuals = []
  }

  private bindEvents(): void {
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
  }

  private resize(): void {
    const width = Math.max(this.container.clientWidth, 1)
    const height = Math.max(this.container.clientHeight, 1)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3)
}

function easeOutBack(value: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2)
}

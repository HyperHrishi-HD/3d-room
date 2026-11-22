import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import type { AlbumSpread } from '../data/content'
import { playSfx } from '../lib/sfx'
import { COLORS } from './palette'
import InWorldControls from './InWorldControls'
import { useFloatToRead, type Stage, type TransformSpec } from './FloatToRead'
import {
  makeArtTexture,
  makeCanvasTexture,
  makeCoverTexture,
  makeTextTexture,
  useFontVersion,
  type TextTextureSpec,
} from './textEngine'
import { usePointerCursor } from './usePointerCursor'

export interface BookTab {
  label: string
  color: string
  page: number
}

const TURN_SECONDS = 0.85

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - (-2 * value + 2) ** 3 / 2
}

type Props = {
  stage: Stage
  home: TransformSpec
  picker?: TransformSpec
  read: TransformSpec
  width: number
  height: number
  cover: {
    title: string
    number?: string
    hand: string
    background: string
    accent: string
  }
  spreads: AlbumSpread[]
  tabs?: BookTab[]
  onTabSelect?: (index: number) => void
  onSelect?: () => void
  onClose: () => void
  spineColor?: string
  controlRotationY?: number
}

function pageSpec(
  page: AlbumSpread['left'],
  pageNumber: string,
  width: number,
  height: number,
): TextTextureSpec {
  return {
    width,
    height,
    padding: Math.round(width * 0.08),
    background: '#F5EFE2',
    border: 'paper',
    art: page.art,
    artHeight: page.art ? Math.round(height * (page.artHeight ?? 0.38)) : undefined,
    blocks: [
      {
        text: page.title,
        font: 'display',
        size: Math.round(width * 0.066),
        weight: 500,
        lineHeight: 1.08,
        gapAfter: 10,
      },
      ...(page.hand
        ? [
            {
              text: page.hand,
              font: 'hand' as const,
              size: Math.round(width * 0.046),
              color: 'rgba(90, 67, 48, 0.82)',
              lineHeight: 1.15,
              gapAfter: 18,
            },
          ]
        : []),
      {
        text: page.body,
        font: 'body',
        size: Math.round(width * 0.038),
        lineHeight: 1.52,
        color: 'rgba(42, 33, 24, 0.85)',
        gapAfter: 14,
      },
      {
        type: 'rule',
        color: 'rgba(201, 162, 75, 0.5)',
        gapAfter: 10,
      },
      {
        text: pageNumber,
        font: 'body',
        size: Math.round(width * 0.025),
        color: 'rgba(42, 33, 24, 0.45)',
        letterSpacing: 2,
      },
    ],
  }
}

function SliderPage({
  slider,
  width,
  height,
  onProgress,
}: {
  slider: NonNullable<AlbumSpread['slider']>
  width: number
  height: number
  onProgress?: () => void
}) {
  const version = useFontVersion()
  const [split, setSplit] = useState(0.5)
  const dragging = useRef(false)
  const cursor = usePointerCursor()
  const before = useMemo(() => makeArtTexture(slider.before, 620, 780), [slider.before, version])
  const after = useMemo(() => makeArtTexture(slider.after, 620, 780), [slider.after, version])
  const labels = useMemo(
    () =>
      makeCanvasTexture(768, 960, (ctx) => {
        ctx.clearRect(0, 0, 768, 960)
        ctx.fillStyle = 'rgba(245, 239, 226, 0.9)'
        ctx.font = "600 37px Caveat, cursive"
        ctx.textAlign = 'left'
        ctx.fillText(slider.beforeLabel, 42, 900)
        ctx.textAlign = 'right'
        ctx.fillText(slider.afterLabel, 726, 900)
        ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(42, 33, 24, 0.82)'
        ctx.font = "500 24px Caveat, cursive"
        ctx.fillText(slider.caption, 384, 936)
        ctx.strokeStyle = 'rgba(201, 162, 75, 0.55)'
        ctx.lineWidth = 2
        ctx.strokeRect(14, 14, 740, 932)
      }),
    [slider, version],
  )
  const uniforms = useMemo(
    () => ({
      uBefore: { value: before },
      uAfter: { value: after },
      uSplit: { value: split },
    }),
    [after, before],
  )

  useEffect(() => {
    uniforms.uSplit.value = split
  }, [split, uniforms])

  useEffect(
    () => () => {
      before.dispose()
      after.dispose()
      labels.dispose()
    },
    [after, before, labels],
  )

  useEffect(() => {
    const up = () => {
      dragging.current = false
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [])

  const update = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || !event.uv) return
    event.stopPropagation()
    setSplit(Math.min(0.96, Math.max(0.04, event.uv.x)))
    onProgress?.()
  }

  return (
    <group position={[width / 4, 0, 0.002]}>
      <mesh
        {...cursor}
        onPointerDown={(event) => {
          event.stopPropagation()
          dragging.current = true
          if (event.uv) setSplit(Math.min(0.96, Math.max(0.04, event.uv.x)))
        }}
        onPointerMove={update}
        onPointerUp={() => {
          dragging.current = false
        }}
      >
        <planeGeometry args={[width / 2 - 0.008, height - 0.012]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            uniform sampler2D uBefore;
            uniform sampler2D uAfter;
            uniform float uSplit;
            void main() {
              vec4 earlier = texture2D(uBefore, vUv);
              vec4 later = texture2D(uAfter, vUv);
              gl_FragColor = vUv.x < uSplit ? earlier : later;
              #include <colorspace_fragment>
            }
          `}
        />
      </mesh>
      <mesh position={[0, 0, 0.003]}>
        <planeGeometry args={[width / 2 - 0.008, height - 0.012]} />
        <meshBasicMaterial map={labels} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <group position={[-width / 4 + split * (width / 2), 0, 0.03]}>
        <mesh
          {...cursor}
          onPointerDown={(event) => {
            event.stopPropagation()
            dragging.current = true
          }}
          onPointerMove={update}
        >
          <cylinderGeometry args={[0.045, 0.045, 0.015, 24]} />
          <meshStandardMaterial color={COLORS.brightGold} metalness={0.4} roughness={0.35} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.009]}>
          <circleGeometry args={[0.025, 20]} />
          <meshBasicMaterial color={COLORS.ink} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <sphereGeometry args={[0.085, 12, 10]} />
          <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

export default function PageBook({
  stage,
  home,
  picker,
  read,
  width,
  height,
  cover,
  spreads,
  tabs = [],
  onTabSelect,
  onSelect,
  onClose,
  spineColor = '#4A3421',
  controlRotationY = 0,
}: Props) {
  const group = useFloatToRead(stage, { home, picker, read })
  const { camera, size: viewport } = useThree()
  const leafDebug =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has('leafdebug')
  const sideDebug =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has('pageside')
  const coverPivot = useRef<THREE.Group>(null)
  const flipPivot = useRef<THREE.Group>(null)
  const flipPlane = useRef<THREE.Group>(null)
  const flipShadow = useRef<THREE.MeshBasicMaterial>(null)
  const coverProgress = useRef(0)
  const debugHold = useRef(false)
  const debugApi = useRef<{
    seek: (progress: number, direction?: 1 | -1) => void
    clear: () => void
    measure: () => unknown
  } | null>(null)
  const [spread, setSpread] = useState(0)
  const [flip, setFlip] = useState<1 | -1 | null>(null)
  const flipProgress = useRef(0)
  useEffect(() => {
    document.documentElement.dataset.pageSpread = String(spread)
  }, [spread])

  const version = useFontVersion()
  const cursor = usePointerCursor()

  useEffect(() => {
    if (spread > spreads.length - 1) setSpread(Math.max(0, spreads.length - 1))
  }, [spread, spreads.length])

  useEffect(() => {
    if (stage !== 'read') setFlip(null)
  }, [stage])

  useEffect(() => {
    setSpread(0)
    setFlip(null)
  }, [spreads])

  const pageW = width / 2 - 0.006
  const pageH = height - 0.008
  // ONE leaf geometry spanning the full page width from the spine, bent per
  // frame around a travelling curl axis. FrontSide/BackSide meshes share it.
  const leafGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(pageW, pageH, 24, 1)
    geometry.translate(pageW / 2, 0, 0)
    const positions = geometry.attributes.position
    const uvs = geometry.attributes.uv
    for (let index = 0; index < positions.count; index += 1) {
      uvs.setX(index, positions.getX(index) / pageW)
    }
    uvs.needsUpdate = true
    return geometry
  }, [pageH, pageW])
  const leafBaseX = useMemo(() => {
    const positions = leafGeometry.attributes.position
    const base = new Float32Array(positions.count)
    for (let index = 0; index < positions.count; index += 1) {
      base[index] = positions.getX(index)
    }
    return base
  }, [leafGeometry])
  const pageShadowTexture = useMemo(
    () =>
      makeCanvasTexture(256, 256, (ctx) => {
        ctx.clearRect(0, 0, 256, 256)
        const gradient = ctx.createRadialGradient(128, 128, 12, 128, 128, 126)
        gradient.addColorStop(0, 'rgba(42, 33, 24, 0.55)')
        gradient.addColorStop(0.45, 'rgba(42, 33, 24, 0.26)')
        gradient.addColorStop(1, 'rgba(42, 33, 24, 0)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 256, 256)
      }),
    [],
  )

  useEffect(
    () => () => {
      leafGeometry.dispose()
      pageShadowTexture.dispose()
    },
    [leafGeometry, pageShadowTexture],
  )

  const coverTexture = useMemo(
    () =>
      makeCoverTexture({
        title: cover.title,
        number: cover.number,
        hand: cover.hand,
        background: cover.background,
        accent: cover.accent,
      }),
    [cover, version],
  )

  useEffect(() => () => coverTexture.dispose(), [coverTexture])

  const pageTextures = useMemo(() => {
    const pages = new Map<number, { left: THREE.Texture; right: THREE.Texture }>()
    if (stage !== 'read') return pages
    // Only the visible spread and its immediate neighbours are needed for a
    // turn. Building all 40 notebook spreads at once allocated 80 large
    // canvases before the book could appear, which is why the books stalled.
    const first = Math.max(0, spread - 1)
    const last = Math.min(spreads.length - 1, spread + 1)
    for (let index = first; index <= last; index += 1) {
      const entry = spreads[index]
      pages.set(index, {
        left: makeTextTexture(pageSpec(entry.left, `${index * 2 + 1}`, 768, 960)),
        right: makeTextTexture(pageSpec(entry.right, `${index * 2 + 2}`, 768, 960)),
      })
    }
    return pages
  }, [spreads, stage, version, spread])

  useEffect(
    () => () => {
      for (const entry of pageTextures.values()) {
        entry.left.dispose()
        entry.right.dispose()
      }
    },
    [pageTextures],
  )

  const tabTextures = useMemo(
    () =>
      tabs.map((tab) =>
        makeCanvasTexture(256, 74, (ctx) => {
          ctx.fillStyle = tab.color
          ctx.fillRect(0, 0, 256, 74)
          ctx.strokeStyle = 'rgba(245, 239, 226, 0.38)'
          ctx.lineWidth = 2
          ctx.strokeRect(4, 4, 248, 66)
          ctx.fillStyle = '#2A2118'
          ctx.font = "600 31px Caveat, cursive"
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(tab.label, 128, 39)
        }),
      ),
    [tabs, version],
  )

  useEffect(
    () => () => {
      for (const texture of tabTextures) texture.dispose()
    },
    [tabTextures],
  )

  const turn = (direction: 1 | -1) => {
    if (flip) return
    if (direction === 1 && spread >= spreads.length - 1) {
      onClose()
      return
    }
    if (direction === -1 && spread <= 0) return
    playSfx('page-flip')
    flipProgress.current = 0
    debugHold.current = false
    setFlip(direction)
  }

  debugApi.current = {
    seek: (progress, direction = 1) => {
      debugHold.current = true
      flipProgress.current = THREE.MathUtils.clamp(progress, 0, 1)
      setFlip(direction)
    },
    clear: () => {
      debugHold.current = false
      setFlip(null)
      flipProgress.current = 0
    },
    measure: () => {
      const pivot = flipPivot.current
      const book = group.current
      if (!pivot || !book) {
        return {
          flip,
          spread,
          progress: flipProgress.current,
          leafMaps: Boolean(leafTextures?.front && leafTextures?.back),
          pageW,
          pageH,
          leafScreen: null,
          outerScreen: null,
          pageScreen: null,
        }
      }
      book.updateWorldMatrix(true, true)
      camera.updateMatrixWorld()
      const leafBox = new THREE.Box3().setFromObject(pivot)
      const projectBox = (box: THREE.Box3) => {
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const point = new THREE.Vector3(x, y, z).project(camera)
              const screenX = ((point.x + 1) / 2) * viewport.width
              const screenY = ((1 - point.y) / 2) * viewport.height
              minX = Math.min(minX, screenX)
              maxX = Math.max(maxX, screenX)
              minY = Math.min(minY, screenY)
              maxY = Math.max(maxY, screenY)
            }
          }
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
      }
      const pageCorners: THREE.Vector3[] = []
      for (const x of [width / 4 - pageW / 2, width / 4 + pageW / 2]) {
        for (const y of [-pageH / 2, pageH / 2]) {
          const point = new THREE.Vector3(x, y, 0.006)
          book.localToWorld(point)
          pageCorners.push(point)
        }
      }
      const pagePoints = pageCorners.map((point) => point.clone().project(camera))
      const pageXs = pagePoints.map((point) => ((point.x + 1) / 2) * viewport.width)
      const pageYs = pagePoints.map((point) => ((1 - point.y) / 2) * viewport.height)
      const pageScreen = {
        x: Math.min(...pageXs),
        y: Math.min(...pageYs),
        w: Math.max(...pageXs) - Math.min(...pageXs),
        h: Math.max(...pageYs) - Math.min(...pageYs),
      }
      const local = leafGeometry.attributes.position
      let minLocalX = Infinity
      let maxLocalX = -Infinity
      let minLocalZ = Infinity
      let maxLocalZ = -Infinity
      for (let index = 0; index < local.count; index += 1) {
        minLocalX = Math.min(minLocalX, local.getX(index))
        maxLocalX = Math.max(maxLocalX, local.getX(index))
        minLocalZ = Math.min(minLocalZ, local.getZ(index))
        maxLocalZ = Math.max(maxLocalZ, local.getZ(index))
      }
      return {
        flip,
        spread,
        progress: flipProgress.current,
        pivotAngle: pivot.rotation.y,
        pivotZ: pivot.position.z,
        leafScreen: projectBox(leafBox),
        pageScreen,
        leafMaps: Boolean(leafTextures?.front && leafTextures?.back),
        leafLocal: { minLocalX, maxLocalX, minLocalZ, maxLocalZ },
        pageW,
        pageH,
      }
    },
  }

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const registry = (
      window as typeof window & {
        __PAGE_BOOK_DEBUG__?: Record<
          string,
          {
            seek: (progress: number, direction?: 1 | -1) => void
            clear: () => void
            measure: () => unknown
          }
        >
      }
    ).__PAGE_BOOK_DEBUG__ ??= {}
    const key = cover.title
          registry[key] = {
        seek: (progress, direction) => debugApi.current?.seek(progress, direction),
        clear: () => debugApi.current?.clear(),
        measure: () => debugApi.current?.measure(),
      }
    return () => {
      delete registry[key]
    }
  }, [cover.title])

  useEffect(() => {
    document.documentElement.dataset.pageFlip = flip ? String(flip) : ''
    return () => {
      document.documentElement.dataset.pageFlip = ''
    }
  }, [flip])

  useFrame(({ camera: liveCamera }) => {
    if (sideDebug) {
      liveCamera.position.set(4.7, 1.72, 0.3)
      liveCamera.lookAt(4.0, 1.32, -1.15)
      liveCamera.updateMatrixWorld()
    }
  })

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05)
    if (coverPivot.current) {
      const target = stage === 'read' ? 1 : 0
      const move = step / TURN_SECONDS
      coverProgress.current = THREE.MathUtils.clamp(
        coverProgress.current + (target > coverProgress.current ? move : -move),
        0,
        1,
      )
      const eased = easeInOutCubic(coverProgress.current)
      coverPivot.current.rotation.y = -Math.PI * eased
    }
    if (flip && flipPivot.current && flipPlane.current) {
      if (!debugHold.current) {
        flipProgress.current = Math.min(1, flipProgress.current + step / TURN_SECONDS)
      }
      const progress = flipProgress.current
      const eased = easeInOutCubic(progress)
      // The leaf rotates about the spine while the cylindrical curl travels
      // across it. A quadratic lag keeps the turn reading as one curved sheet:
      // it lifts early but only lays onto the far page late in the 0.85 s turn.
      const theta = Math.PI * Math.pow(eased, 1.6)
      flipPivot.current.rotation.y = flip === 1 ? theta : Math.PI - theta
      flipPivot.current.rotation.x = 0

      // Cylindrical curl from the Phase 1 mandate: the axis travels from
      // 0.92W to 0.08W while the radius narrows at mid-turn. Points before
      // the axis stay in the leaf plane; points past it wrap around the
      // cylinder by angle (x - xc) / R. The leaf never folds as two panels.
      const curlAxis = pageW * (0.92 - 0.84 * eased)
      const curlRadius = pageW * (0.34 - 0.16 * Math.sin(Math.PI * progress))
      const lift = flip === 1 ? 1 : -1
      const positions = leafGeometry.attributes.position
      const base = leafBaseX
      for (let index = 0; index < positions.count; index += 1) {
        const d = base[index] - curlAxis
        let lx: number
        let lz: number
        if (d <= 0) {
          lx = base[index]
          lz = 0
        } else {
          const angle = d / curlRadius
          lx = curlAxis + curlRadius * Math.sin(angle)
          lz = curlRadius * (1 - Math.cos(angle))
        }
        positions.setX(index, lx)
        positions.setZ(index, lz * lift)
      }
      positions.needsUpdate = true

      if (flipShadow.current) {
        flipShadow.current.opacity = Math.sin(progress * Math.PI) * 0.3
      }

      if (progress >= 1 && !debugHold.current) {
        // Swap the static spread and remove the leaf in one state update.
        setSpread((currentSpread) =>
          Math.max(0, Math.min(spreads.length - 1, currentSpread + flip)),
        )
        setFlip(null)
        flipProgress.current = 0
      }
    }
  })

  const current = pageTextures.get(spread)
  const next = pageTextures.get(Math.min(spreads.length - 1, spread + 1))
  const previous = pageTextures.get(Math.max(0, spread - 1))
  const leafTextures = useMemo(() => {
    const front = flip === 1 ? current?.right : current?.left
    const back = flip === 1 ? next?.left : previous?.right
    if (!front || !back) return null
    // A plane's back face samples the same UVs from the other side. Mirror the
    // back map so the next page is not printed backwards while the leaf turns.
    const mirrored = back.clone()
    mirrored.wrapS = THREE.RepeatWrapping
    mirrored.repeat.x = -1
    mirrored.offset.x = 1
    mirrored.needsUpdate = true
    return { front, back: mirrored }
  }, [current, flip, next, previous])
  useEffect(() => () => leafTextures?.back.dispose(), [leafTextures])
  const currentSlider = spreads[spread]?.slider
  const isLast = spread >= spreads.length - 1
  const controlHeight = height + 0.24

  return (
    <>
      <group ref={group} position={home.position} rotation={home.rotation}>
      <group
        {...cursor}
        onPointerDown={(event) => {
          if (stage === 'read') return
          event.stopPropagation()
          onSelect?.()
        }}
      >
        <mesh position={[0, 0, -0.035]}>
          <boxGeometry args={[width, height, 0.028]} />
          <meshStandardMaterial color={spineColor} roughness={0.84} />
        </mesh>
        <mesh position={[0, 0, -0.012]}>
          <boxGeometry args={[width * 0.965, height * 0.955, 0.03]} />
          <meshStandardMaterial color="#E3D7BE" roughness={0.9} />
        </mesh>
        <mesh position={[-width / 2 + 0.015, 0, -0.03]}>
          <boxGeometry args={[0.04, height, 0.035]} />
          <meshStandardMaterial color={spineColor} roughness={0.78} />
        </mesh>
      </group>

      <group
        ref={coverPivot}
        position={[-width / 2, 0, 0.032]}
        visible={stage !== 'read'}
      >
        <mesh
          {...cursor}
          position={[width / 2, 0, 0]}
          onPointerDown={(event) => {
            event.stopPropagation()
            onSelect?.()
          }}
        >
          <boxGeometry args={[width, height, 0.035]} />
          <meshStandardMaterial color={cover.background} roughness={0.76} />
        </mesh>
        <mesh
          position={[width / 2, 0, 0.019]}
          onPointerDown={(event) => {
            event.stopPropagation()
            onSelect?.()
          }}
        >
          <planeGeometry args={[width * 0.93, height * 0.93]} />
          <meshStandardMaterial map={coverTexture} roughness={0.74} />
        </mesh>
      </group>

      {stage === 'read' && current ? (
        <>
          <mesh position={[-width / 4, 0, 0.006]}>
            <planeGeometry args={[pageW, pageH]} />
            <meshBasicMaterial
              map={flip === -1 ? (previous?.left ?? current.left) : current.left}
              toneMapped={false}
            />
          </mesh>
          {currentSlider ? (
            <SliderPage
              slider={currentSlider}
              width={width}
              height={height}
              onProgress={() => undefined}
            />
          ) : (
            <mesh position={[width / 4, 0, 0.006]}>
              <planeGeometry args={[pageW, pageH]} />
              <meshBasicMaterial
                map={flip === 1 ? (next?.right ?? current.right) : current.right}
                toneMapped={false}
              />
            </mesh>
          )}
          {flip ? (
            <mesh position={[0, 0, 0.0075]} renderOrder={3} raycast={() => null}>
              <planeGeometry args={[width * 0.94, height * 0.96]} />
              <meshBasicMaterial
                ref={flipShadow}
                map={pageShadowTexture}
                transparent
                opacity={0}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ) : null}
        </>
      ) : null}

      {tabs.length > 0 && stage === 'read'
        ? tabs.map((tab, index) => (
            <group
              key={tab.label}
              position={[
                -width / 2 - 0.035 - 0.155,
                height * 0.24 - index * 0.11,
                0.018,
              ]}
              {...cursor}
              onPointerDown={(event) => {
                event.stopPropagation()
                playSfx('paper-slide')
                if (onTabSelect) onTabSelect(index)
                else setSpread(Math.floor(tab.page / 2))
              }}
            >
              <mesh>
                <planeGeometry args={[0.31, 0.09]} />
                <meshBasicMaterial map={tabTextures[index]} toneMapped={false} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, 0, 0.012]}>
                <sphereGeometry args={[0.055, 10, 8]} />
                <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
              </mesh>
            </group>
          ))
        : null}

      {flip && current && (flip === 1 ? next : previous) ? (
        <group ref={flipPivot} position={[0, 0, 0.012]}>
          <group ref={flipPlane}>
            <mesh geometry={leafGeometry} renderOrder={leafDebug ? 20 : 5} raycast={() => null}>
              <meshStandardMaterial
                map={leafTextures?.front}
                toneMapped={false}
                side={THREE.FrontSide}
                color={leafDebug ? '#ff4444' : '#ffffff'}
                roughness={0.88}
                metalness={0}
                depthTest
                depthWrite
              />
            </mesh>
            <mesh geometry={leafGeometry} renderOrder={leafDebug ? 21 : 6} raycast={() => null}>
              <meshStandardMaterial
                map={leafTextures?.back}
                toneMapped={false}
                side={THREE.BackSide}
                color={leafDebug ? '#4488ff' : '#ffffff'}
                roughness={0.88}
                metalness={0}
                depthTest
                depthWrite
              />
            </mesh>
          </group>
        </group>
      ) : null}

      </group>

      {stage === 'read' ? (
        <InWorldControls
          position={[read.position[0], read.position[1], read.position[2] + 0.08]}
          width={width}
          height={controlHeight}
          rotationY={controlRotationY}
          onClose={onClose}
          onPrev={() => turn(-1)}
          onNext={() => turn(1)}
          prevDisabled={spread === 0}
          closeLift={0.14}
          nextIcon={isLast ? 'check' : 'next'}
          nextLabel={isLast ? 'Done with this book' : 'Next page'}
          debugKey={`pagebook-${cover.title}`}
        />
      ) : null}
    </>
  )
}

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { getIconTexture, type IconKind } from './textEngine'
import { COLORS } from './palette'
import { readChromeMetrics } from '../lib/frameChrome'
import { playSfx } from '../lib/sfx'
import { usePointerCursor } from './usePointerCursor'

declare global {
  interface Window {
    __DISC_METRICS__?: Record<
      string,
      { diameterPx: number; edgePx: number; screenX: number; screenY: number }
    >
  }
}

type DiscButtonProps = {
  icon: IconKind
  position?: [number, number, number]
  size?: number
  disabled?: boolean
  foreground?: boolean
  label: string
  onClick: () => void
  pixelSize?: number
  maxPixelSize?: number
  /** Fixed camera distance for HUD controls, independent of frame order. */
  pixelDistance?: number
  /** Keep the disc parallel to the image plane so it stays circular off-axis. */
  screenAligned?: boolean
  /** Draw a rounded-square face instead of the usual gold disc. */
  square?: boolean
  debugKey?: string
}

export function DiscButton({
  icon,
  position = [0, 0, 0],
  size = 0.048,
  disabled = false,
  foreground = false,
  label,
  onClick,
  pixelSize,
  maxPixelSize,
  pixelDistance,
  screenAligned = false,
  square = false,
  debugKey,
}: DiscButtonProps) {
  const group = useRef<THREE.Group>(null)
  const hovered = useRef(false)
  const { camera, size: viewport } = useThree()
  const cursor = usePointerCursor()
  const iconTexture = getIconTexture(icon, disabled ? 'rgba(42,33,24,0.38)' : '#2A2118')
  const scale = useRef(1)
  const world = useMemo(() => new THREE.Vector3(), [])
  const squareGeometry = useMemo(() => {
    const half = size
    const radius = size * 0.28
    const shape = new THREE.Shape()
    shape.moveTo(-half + radius, -half)
    shape.lineTo(half - radius, -half)
    shape.quadraticCurveTo(half, -half, half, -half + radius)
    shape.lineTo(half, half - radius)
    shape.quadraticCurveTo(half, half, half - radius, half)
    shape.lineTo(-half + radius, half)
    shape.quadraticCurveTo(-half, half, -half, half - radius)
    shape.lineTo(-half, -half + radius)
    shape.quadraticCurveTo(-half, -half, -half + radius, -half)
    shape.closePath()
    return new THREE.ShapeGeometry(shape, 12)
  }, [size])
  useEffect(() => () => squareGeometry.dispose(), [squareGeometry])

  useFrame((_, delta) => {
    const node = group.current
    if (!node) return
    if (screenAligned) node.quaternion.copy(camera.quaternion)
    else node.lookAt(camera.position)
    let pixelScale = 1
    let distance = 0
    let pixelsPerMetre = 0
    if (pixelSize) {
      const perspective = camera as THREE.PerspectiveCamera
      if (pixelDistance) {
        distance = pixelDistance
      } else {
        node.getWorldPosition(world)
        distance = Math.max(0.1, camera.position.distanceTo(world))
      }
      const fov = perspective.isPerspectiveCamera ? perspective.fov : 50
      pixelsPerMetre =
        viewport.height / (2 * distance * Math.tan(THREE.MathUtils.degToRad(fov / 2)))
      const naturalDiameter = 2 * size * pixelsPerMetre
      const minScale = 0.35
      const maxScale = maxPixelSize
        ? Math.max(minScale, maxPixelSize / Math.max(0.001, naturalDiameter))
        : 4
      pixelScale = THREE.MathUtils.clamp(
        pixelSize / Math.max(0.001, naturalDiameter),
        minScale,
        maxScale,
      )
    }
    const target = (hovered.current && !disabled ? 1.15 : 1) * pixelScale
    scale.current = THREE.MathUtils.damp(scale.current, target, 12, Math.min(delta, 0.04))
    node.scale.setScalar(scale.current)

    if (import.meta.env.DEV && debugKey && pixelSize) {
      node.getWorldPosition(world)
      const projected = world.clone().project(camera)
      const screenX = (projected.x * 0.5 + 0.5) * viewport.width
      const screenY = (0.5 - projected.y * 0.5) * viewport.height
      const diameterPx = 2 * size * scale.current * pixelsPerMetre
      window.__DISC_METRICS__ ??= {}
      window.__DISC_METRICS__[debugKey] = {
        diameterPx,
        edgePx:
          Math.min(screenX, viewport.width - screenX, screenY, viewport.height - screenY) -
          diameterPx / 2,
        screenX,
        screenY,
      }
    }
  })

  const handleClick = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    if (!disabled) onClick()
  }

  return (
    <group ref={group} position={position}>
      <mesh
        {...cursor}
        onPointerDown={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation()
          hovered.current = true
        }}
        onPointerOut={() => {
          hovered.current = false
        }}
        renderOrder={foreground ? 60 : 10}
      >
        {/* A flat camera-facing face keeps the rasterized diameter equal to the
            computed pixel size. A cylinder adds its side to the silhouette at
            oblique screen corners, which made the measured disc wider than the
            metric. */}
        {square ? (
          <primitive object={squareGeometry} attach="geometry" />
        ) : (
          <circleGeometry args={[size, 40]} />
        )}
        <meshBasicMaterial
          color={disabled ? '#8D7440' : COLORS.gold}
          toneMapped={false}
          depthTest={!foreground}
          transparent={disabled ? false : true}
          opacity={disabled ? 0.82 : 1}
        />
      </mesh>
      <mesh position={[0, 0, 0.008]} renderOrder={foreground ? 61 : 11}>
        <planeGeometry args={[size * 1.16, size * 1.16]} />
        <meshBasicMaterial
          map={iconTexture}
          transparent
          toneMapped={false}
          depthWrite={false}
          depthTest={!foreground}
        />
      </mesh>
      <mesh {...cursor} onPointerDown={handleClick} renderOrder={foreground ? 59 : 9}>
        <sphereGeometry args={[size * 1.55, 10, 8]} />
        <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} depthTest={!foreground} />
      </mesh>
      <group userData={{ label }} />
    </group>
  )
}

type ControlsProps = {
  position: [number, number, number]
  width: number
  height: number
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  prevDisabled?: boolean
  nextIcon?: 'next' | 'close' | 'check'
  closeIcon?: 'close' | 'loop'
  hidePrev?: boolean
  hideNext?: boolean
  closeLabel?: string
  prevLabel?: string
  nextLabel?: string
  rotationY?: number
  pageButtonsDrop?: number
  /** Raise (positive) or lower (negative) only the close disc. */
  closeLift?: number
  debugKey?: string
}

/**
 * The three discs that belong to an open object. They are true scene objects,
 * sized in metres and billboarded toward the camera.
 */
export default function InWorldControls({
  position,
  width,
  height,
  onClose,
  onPrev,
  onNext,
  prevDisabled = false,
  nextIcon = 'next',
  closeIcon = 'close',
  hidePrev = false,
  hideNext = false,
  closeLabel = 'Close and return to the room',
  prevLabel = 'Previous page',
  nextLabel = 'Next page',
  rotationY = 0,
  pageButtonsDrop = 0,
  closeLift = 0,
  debugKey,
}: ControlsProps) {
  const [x, y, z] = position
  void onClose
  void closeLift
  void closeIcon
  void closeLabel
  const lowerY = y - height / 2 + 0.08 - pageButtonsDrop
  const halfWidth = width / 2
  const alongX = Math.cos(rotationY) * halfWidth
  const alongZ = -Math.sin(rotationY) * halfWidth
  // Keep the controls a little proud of the object along its forward normal,
  // not always along +z. The kitchen sits on a side wall, so +z would put the
  // discs beside the shelf instead of facing the room.
  const normalX = Math.sin(rotationY) * 0.06
  const normalZ = Math.cos(rotationY) * 0.06

  return (
    <group>
      {/* The close control is now the screen-space StationCloseButton, which
          cannot fall outside the safe viewport on a narrow phone. */}
      {!hidePrev && onPrev ? (
        <DiscButton
          icon="previous"
          position={[x - alongX + normalX, lowerY, z - alongZ + normalZ]}
          disabled={prevDisabled}
          foreground
          pixelSize={44}
          onClick={onPrev}
          label={prevLabel}
          debugKey={debugKey ? `${debugKey}-prev` : undefined}
        />
      ) : null}
      {!hideNext && onNext ? (
        <DiscButton
          icon={nextIcon}
          position={[x + alongX + normalX, lowerY, z + alongZ + normalZ]}
          foreground
          pixelSize={44}
          onClick={onNext}
          label={nextLabel}
          debugKey={debugKey ? `${debugKey}-next` : undefined}
        />
      ) : null}
    </group>
  )
}

type ChevronProps = {
  side: 'left' | 'right'
  onClick: () => void
}

function CameraChevron({ side, onClick }: ChevronProps) {
  const group = useRef<THREE.Group>(null)
  const { camera, size: viewport } = useThree()
  const local = useMemo(() => new THREE.Vector3(), [])
  const world = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const node = group.current
    const perspective = camera as THREE.PerspectiveCamera
    if (!node || !perspective.isPerspectiveCamera) return
    const distance = 1.18
    const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2))
    const pixelsPerMetre = viewport.height / Math.max(0.001, height)
    // Read the live chrome each frame: the AI dock mounts after the active
    // station and must push these discs up immediately, not one render later.
    // Keep the full 56 px maximum disc at least 8 px inside every edge.
    // Keep extra room for the disc's antialiased silhouette and the widest
    // hover state. The raster check still requires at least 8 px.
    const edgePixels = 48
    const xPixels = Math.max(edgePixels, viewport.width / 2 - edgePixels)
    const bottomPixels = THREE.MathUtils.clamp(
      readChromeMetrics().bottom + edgePixels,
      edgePixels,
      Math.max(edgePixels, viewport.height - edgePixels),
    )
    local.set(
      side === 'left' ? -xPixels / pixelsPerMetre : xPixels / pixelsPerMetre,
      -height / 2 + bottomPixels / Math.max(0.001, pixelsPerMetre),
      -distance,
    )
    world.copy(local).applyMatrix4(perspective.matrixWorld)
    node.position.copy(world)
  })

  return (
    <group ref={group}>
      <DiscButton
        icon={side === 'left' ? 'previous' : 'next'}
        size={0.062}
        foreground
        pixelSize={46}
        pixelDistance={1.18}
        screenAligned
        debugKey={side}
        onClick={() => {
          playSfx('ui-click')
          onClick()
        }}
        maxPixelSize={56}
        label={side === 'left' ? 'Previous place' : 'Next place'}
      />
    </group>
  )
}

export function CameraChevrons({
  onPrevious,
  onNext,
}: {
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <group>
      <CameraChevron side="left" onClick={onPrevious} />
      <CameraChevron side="right" onClick={onNext} />
    </group>
  )
}

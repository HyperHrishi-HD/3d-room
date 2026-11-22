import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { safeRectFor, solveBoxFrame, solveOverviewFrame } from './frameSolver'
import { useChromeMetrics } from '../lib/frameChrome'
import { playSfx } from '../lib/sfx'
import { useRoom } from '../state/roomStore'
import { OVERVIEW_TARGET, stationById, type Station, type Vec3 } from '../data/stations'
import {
  clampPitch,
  LOOK_BASE_FOV,
  LOOK_PITCH_BASE,
  LOOK_PIVOT,
  look,
} from './overviewLook'

export interface CameraGoal {
  key: string
  stateKey: string
  id: string | null
  position: [number, number, number]
  target: [number, number, number]
  overview: boolean
  fov: number
}

type Props = {
  goal: CameraGoal
  onArrive: (id: string) => void
  onOverviewArrive: () => void
}

declare global {
  interface Window {
    __FRAME_CAMERA__?: {
      position: Vec3
      target: Vec3
      fov: number
    }
  }
}

function focusFallback(station: Station, read: boolean): Pick<CameraGoal, 'position' | 'target' | 'fov'> {
  const box = read ? station.readBox : station.focusBox
  const target = new THREE.Vector3(...box.center)
  const direction = new THREE.Vector3(...station.viewDir).normalize()
  const distance = Math.max(4, Math.min(12, Math.max(...box.size) * 2.4))
  const position = target.clone().addScaledVector(direction, distance)
  return {
    position: [position.x, THREE.MathUtils.clamp(position.y, 0.5, 3.15), position.z],
    target: [target.x, target.y, target.z],
    fov: 68,
  }
}

/**
 * Turns the current room state and viewport into a solved camera goal. The
 * solver runs on every R3F size/chrome change, so resizing does not remount
 * the Canvas or disturb the open station.
 */
export function useFrameDirector(): CameraGoal {
  const { size } = useThree()
  const { active, cinema, destination } = useRoom()
  const chrome = useChromeMetrics()
  const width = Math.max(1, size.width)
  const height = Math.max(1, size.height)
  const aspect = width / height
  const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null
  const hold = params?.get('framehold') ?? null
  const focusShot = params?.get('framefocus') ?? null
  const flowerClose = params?.get('flowerclose') !== null
  const warned = useRef(new Set<string>())

  const warnFallback = (key: string, id: string | null, mode: string) => {
    const warningKey = `${key}|${id ?? 'overview'}|${mode}`
    if (warned.current.has(warningKey)) return
    warned.current.add(warningKey)
    console.warn(
      `[frame] solver fallback for ${id ?? 'overview'} (${mode}) at ${Math.round(width)}x${Math.round(height)}`,
    )
  }

  return useMemo(() => {
    const safe = safeRectFor(width, height)
    const viewportKey = `${Math.round(width)}x${Math.round(height)}:${Math.round(
      chrome.top,
    )}:${Math.round(chrome.bottom)}`

    if (focusShot) {
      const station = stationById(focusShot)
      if (station) {
        const solution = solveBoxFrame(
          station.focusBox,
          station.viewDir,
          aspect,
          safe,
          station.targetBias,
        )
        const fallback = focusFallback(station, false)
        if (!solution) warnFallback(`shot:${station.id}|${viewportKey}`, station.id, 'focus')
        return {
          key: `shot:${station.id}|${viewportKey}`,
          stateKey: `shot:${station.id}`,
          id: null,
          position: solution?.position ?? fallback.position,
          target: solution?.target ?? fallback.target,
          fov: solution?.fov ?? fallback.fov,
          overview: false,
        }
      }
    }

    if (destination) {
      const destinationBox =
        destination.kind === 'kitchen' && aspect < 0.82 && destination.portraitBox
          ? destination.portraitBox
          : destination.focusBox
      const solution = solveBoxFrame(
        destinationBox,
        destination.viewDir,
        aspect,
        safe,
        destination.targetBias,
      )
      const fallback = focusFallback(destination, false)
      if (!solution) warnFallback(`focus:${destination.id}|${viewportKey}`, destination.id, 'focus')
      return {
        key: `focus:${destination.id}|${viewportKey}`,
        stateKey: `focus:${destination.id}`,
        id: destination.id,
        position: solution?.position ?? fallback.position,
        target: solution?.target ?? fallback.target,
        fov: solution?.fov ?? fallback.fov,
        overview: false,
      }
    }

    if (active) {
      const isTvFocus = active.kind === 'tv' && !cinema
      const cinemaView = active.kind === 'tv' && cinema && active.cinemaBox
      const flowerView = active.kind === 'flowers' && flowerClose && active.closeupBox
      const read =
        hold === 'focus' ? false : hold === 'read' ? true : !isTvFocus
      const portraitKitchen =
        active.kind === 'kitchen' && aspect < 0.82 && active.portraitBox
          ? active.portraitBox
          : null
      const box = flowerView
        ? active.closeupBox!
        : cinemaView
            ? active.cinemaBox!
          : portraitKitchen
            ? portraitKitchen
            : read
              ? active.readBox
              : active.focusBox
      const direction =
        flowerView && active.closeupDir ? active.closeupDir : active.viewDir
      const solution = solveBoxFrame(
        box,
        direction,
        aspect,
        safe,
        active.targetBias,
      )
      const fallback = focusFallback(active, read)
      const mode = flowerView
        ? 'flower'
        : cinemaView
          ? 'cinema'
          : read
            ? 'read'
            : 'focus'
      if (!solution) warnFallback(`${mode}:${active.id}|${viewportKey}`, active.id, mode)
      return {
        key: `${mode}:${active.id}|${viewportKey}`,
        stateKey: `${mode}:${active.id}`,
        id: null,
        position: solution?.position ?? fallback.position,
        target: solution?.target ?? fallback.target,
        fov: flowerView ? 24 : (solution?.fov ?? fallback.fov),
        overview: false,
      }
    }

    const solution = solveOverviewFrame(width, height)
    if (!solution) warnFallback(`overview|${viewportKey}`, null, 'overview')
    return {
      key: `overview|${viewportKey}`,
      stateKey: 'overview',
      id: null,
      position: solution?.position ?? ([0, 4.5, 16] as Vec3),
      target: solution?.target ?? OVERVIEW_TARGET,
      fov: solution?.fov ?? 68,
      overview: true,
    }
  }, [
    active,
    aspect,
    chrome.bottom,
    chrome.top,
    cinema,
    destination,
    focusShot,
    flowerClose,
    height,
    hold,
    width,
  ])
}

const FLIGHT_MS = 1100
const QA_CAPTURE =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('frameqa')

type Flight = {
  key: string
  started: number
  fromPosition: THREE.Vector3
  fromTarget: THREE.Vector3
  fromFov: number
}

export default function CameraRig({ goal, onArrive, onOverviewArrive }: Props) {
  const { camera, pointer } = useThree()
  const { overviewTravel } = useRoom()
  const goalPosition = useRef(new THREE.Vector3(...goal.position))
  const goalTarget = useRef(new THREE.Vector3(...goal.target))
  const currentLook = useRef(new THREE.Vector3(...goal.target))
  const flight = useRef<Flight | null>(null)
  const arrivedFor = useRef<string | null>(null)
  const overviewArrivedFor = useRef<string | null>(null)
  const lastStateKey = useRef<string | null>(null)
  const reduced = useRef(false)
  const desired = useMemo(() => new THREE.Vector3(), [])
  const lookPosition = useMemo(() => new THREE.Vector3(...LOOK_PIVOT), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])
  const lookDirection = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.current = media.matches
    const onChange = (event: MediaQueryListEvent) => {
      reduced.current = event.matches
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    goalPosition.current.set(...goal.position)
    goalTarget.current.set(...goal.target)
    if (flight.current?.key === goal.key) return
    const stateChanged = lastStateKey.current !== goal.stateKey
    lastStateKey.current = goal.stateKey
    flight.current = {
      key: goal.key,
      started: performance.now(),
      fromPosition: camera.position.clone(),
      fromTarget: currentLook.current.clone(),
      fromFov: (camera as THREE.PerspectiveCamera).fov,
    }
    arrivedFor.current = null
    overviewArrivedFor.current = null
    if (stateChanged) {
      // A tab or chevron click may have just played its own short click. Give
      // that click its 120 ms breathing room, then start the flight sound.
      window.setTimeout(() => playSfx('camera-whoosh'), 130)
    }
  }, [camera, goal.key, goal.position, goal.stateKey, goal.target])

  useFrame((state, delta) => {
    desired.copy(goalPosition.current)

    if (goal.overview && !reduced.current) {
      const time = state.clock.elapsedTime
      desired.x += Math.sin(time * 0.3) * 0.045 + pointer.x * 0.1
      desired.y += Math.sin(time * 0.22) * 0.015 + pointer.y * 0.035
    }

    const perspective = camera as THREE.PerspectiveCamera
    let complete = true

    if (reduced.current) {
      camera.position.copy(desired)
      currentLook.current.copy(goalTarget.current)
      camera.lookAt(currentLook.current)
      perspective.fov = goal.fov
      perspective.updateProjectionMatrix()
    } else if (flight.current) {
      const raw = Math.min(1, (performance.now() - flight.current.started) / FLIGHT_MS)
      if (raw < 1) {
        const eased = raw * raw * (3 - 2 * raw)
        camera.position.lerpVectors(flight.current.fromPosition, desired, eased)
        currentLook.current.lerpVectors(flight.current.fromTarget, goalTarget.current, eased)
        camera.lookAt(currentLook.current)
        perspective.fov = THREE.MathUtils.lerp(flight.current.fromFov, goal.fov, eased)
        perspective.updateProjectionMatrix()
        complete = false
      } else {
        // Release the flight so the settled camera can receive the look/zoom
        // camera without being reset to the wide framing every frame.
        flight.current = null
        camera.position.copy(desired)
        currentLook.current.copy(goalTarget.current)
        camera.lookAt(currentLook.current)
        perspective.fov = goal.fov
        perspective.updateProjectionMatrix()
      }
    } else {
      // Settled: look/zoom and the arrival callbacks still need this frame.
      complete = true
    }

    if (import.meta.env.DEV) {
      window.__FRAME_CAMERA__ = {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [currentLook.current.x, currentLook.current.y, currentLook.current.z],
        fov: perspective.fov,
      }

    }

    if (!complete) return

    if (!goal.overview) {
      // An open station keeps its solved framing, but pinch/wheel can change
      // the lens. This is the same FOV zoom the overview uses, so a section
      // can be magnified without moving the camera through a wall.
      const step = Math.min(delta, 0.05)
      look.zoom = THREE.MathUtils.damp(look.zoom, look.targetZoom, 10, step)
      const targetFov = goal.fov / look.zoom
      perspective.fov = THREE.MathUtils.damp(perspective.fov, targetFov, 10, step)
      perspective.updateProjectionMatrix()
    } else {
      const step = Math.min(delta, 0.05)
      look.zoom = THREE.MathUtils.damp(look.zoom, look.targetZoom, 10, step)
      if (!look.dragging) {
        look.targetYaw += look.yawVelocity * step
        look.targetPitch = clampPitch(look.targetPitch + look.pitchVelocity * step)
        const decay = Math.exp(-3.2 * step)
        look.yawVelocity *= decay
        look.pitchVelocity *= decay
      }
      look.yaw = THREE.MathUtils.damp(look.yaw, look.targetYaw, 11, step)
      look.pitch = THREE.MathUtils.damp(look.pitch, look.targetPitch, 11, step)
      look.blend = THREE.MathUtils.damp(look.blend, look.active ? 1 : 0, 5, step)

      if (look.blend > 0.001) {
        const pitch = LOOK_PITCH_BASE + look.pitch
        const cosPitch = Math.cos(pitch)
        lookDirection.set(
          Math.sin(look.yaw) * cosPitch,
          Math.sin(pitch),
          -Math.cos(look.yaw) * cosPitch,
        )
        lookTarget.copy(lookPosition).addScaledVector(lookDirection, 4)
        camera.position.lerp(lookPosition, look.blend)
        currentLook.current.lerp(lookTarget, look.blend)
        camera.lookAt(currentLook.current)
      }

      // Zoom is a lens change, not a dolly: the camera cannot pass through a
      // wall, floor or piece of furniture, and the look point stays inside the
      // room. The wide limit is the normal overview framing.
      const lookFov = LOOK_BASE_FOV / look.zoom
      const wideFov = goal.fov / look.zoom
      const targetFov = THREE.MathUtils.lerp(wideFov, lookFov, look.blend)
      perspective.fov = THREE.MathUtils.damp(perspective.fov, targetFov, 10, step)
      perspective.updateProjectionMatrix()
    }

    if (QA_CAPTURE) {
      ;(window as typeof window & { __CAM_DEBUG__?: unknown }).__CAM_DEBUG__ = {
        at: performance.now(),
        complete,
        flying: Boolean(flight.current),
        overview: goal.overview,
        blend: look.blend,
        lookActive: look.active,
        lookZoom: look.zoom,
        yawDegrees: (look.yaw * 180) / Math.PI,
        pitchDegrees: (look.pitch * 180) / Math.PI,
        camera: [camera.position.x, camera.position.y, camera.position.z],
        fov: (camera as THREE.PerspectiveCamera).fov,
      }
    }

    if (QA_CAPTURE) {
      window.__FRAME_CAMERA__ = {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [currentLook.current.x, currentLook.current.y, currentLook.current.z],
        fov: (camera as THREE.PerspectiveCamera).fov,
      }
    }

    if (!goal.overview && goal.id && arrivedFor.current !== goal.stateKey) {
      arrivedFor.current = goal.stateKey
      onArrive(goal.id)
    }

    // A requested overview arrival must also settle when the camera never had
    // to fly (replaying the entrance while already in the wide view). The old
    // state-key check skipped that callback and left the room without its
    // overview arrival callback until the next navigation.
    if (goal.overview && (overviewTravel || overviewArrivedFor.current !== goal.stateKey)) {
      overviewArrivedFor.current = goal.stateKey
      onOverviewArrive()
    }
  })

  return null
}

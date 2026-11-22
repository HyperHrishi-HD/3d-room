import * as THREE from 'three'
import {
  OVERVIEW_CRITICAL_BOXES,
  OVERVIEW_TARGET,
  STATIONS,
  type CriticalBox,
  type FrameBox,
  type Station,
  type Vec3,
} from '../data/stations'
export interface SafeRect {
  left: number
  right: number
  top: number
  bottom: number
}

export interface FrameSolution {
  position: Vec3
  target: Vec3
  fov: number
  distance: number
  projectedRoomArea: number
  roomHeightCoverage: number
}

export interface FrameAuditResult {
  width: number
  height: number
  aspect: number
  safe: SafeRect
  safePixels: { left: number; top: number; right: number; bottom: number }
  overview: {
    pass: boolean
    solution: FrameSolution | null
    boxes: Array<{ id: string; label: string; pass: boolean }>
  }
  stations: Array<{
    n: number
    id: string
    title: string
    focus: { pass: boolean; solution: FrameSolution | null }
    read: { pass: boolean; solution: FrameSolution | null }
  }>
}

export const ROOM_VIEW_BOX: FrameBox = {
  center: [0, 1.7, 0],
  size: [12, 3.4, 9],
}

const STATION_VOLUME = {
  min: new THREE.Vector3(-5.2, 0.5, -3.9),
  max: new THREE.Vector3(5.2, 3.15, 4.35),
}

const OVERVIEW_X_LIMIT = 5.6
// Portrait corner views need to step back diagonally to fit every critical
// box in the narrow frame. Landscapes keep the original room-edge limit.
const PORTRAIT_OVERVIEW_X_LIMIT = 18
const MIN_DISTANCE = 1.2
const MAX_DISTANCE = 30
const AUDIT_MARGIN = 0.004
const VOLUME_EPSILON = 1e-5

function readPixels(name: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : fallback
}

export function readChromePixels(): { top: number; bottom: number } {
  return {
    top: Math.max(0, readPixels('--chrome-top', 80)),
    bottom: Math.max(0, readPixels('--chrome-bottom', 12)),
  }
}

export function baseFovForAspect(aspect: number): number {
  if (aspect >= 1.15) return 46
  if (aspect >= 0.82) return 54
  return 60
}

export function safeRectFor(width: number, height: number): SafeRect {
  const aspect = width / Math.max(1, height)
  const side = aspect >= 1.15 ? 24 : 16
  const chrome = readChromePixels()
  return {
    left: -1 + (2 * side) / Math.max(1, width),
    right: 1 - (2 * side) / Math.max(1, width),
    top: 1 - (2 * chrome.top) / Math.max(1, height),
    bottom: -1 + (2 * chrome.bottom) / Math.max(1, height),
  }
}

function boxCorners(box: FrameBox): THREE.Vector3[] {
  const [cx, cy, cz] = box.center
  const [sx, sy, sz] = box.size
  const hx = sx / 2
  const hy = sy / 2
  const hz = sz / 2
  return [
    new THREE.Vector3(cx - hx, cy - hy, cz - hz),
    new THREE.Vector3(cx - hx, cy - hy, cz + hz),
    new THREE.Vector3(cx - hx, cy + hy, cz - hz),
    new THREE.Vector3(cx - hx, cy + hy, cz + hz),
    new THREE.Vector3(cx + hx, cy - hy, cz - hz),
    new THREE.Vector3(cx + hx, cy - hy, cz + hz),
    new THREE.Vector3(cx + hx, cy + hy, cz - hz),
    new THREE.Vector3(cx + hx, cy + hy, cz + hz),
  ]
}

function cameraAt(
  position: THREE.Vector3,
  target: THREE.Vector3,
  fov: number,
  aspect: number,
): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 120)
  camera.position.copy(position)
  camera.up.set(0, 1, 0)
  camera.lookAt(target)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}

function pointInFront(camera: THREE.PerspectiveCamera, point: THREE.Vector3): boolean {
  const view = point.clone().applyMatrix4(camera.matrixWorldInverse)
  return view.z < -camera.near
}

function withinSafeRect(camera: THREE.PerspectiveCamera, point: THREE.Vector3, safe: SafeRect): boolean {
  if (!pointInFront(camera, point)) return false
  const projected = point.clone().project(camera)
  return (
    Number.isFinite(projected.x) &&
    Number.isFinite(projected.y) &&
    projected.x >= safe.left + AUDIT_MARGIN &&
    projected.x <= safe.right - AUDIT_MARGIN &&
    projected.y >= safe.bottom + AUDIT_MARGIN &&
    projected.y <= safe.top - AUDIT_MARGIN
  )
}

function boxesFit(
  boxes: FrameBox[],
  camera: THREE.PerspectiveCamera,
  safe: SafeRect,
): boolean {
  for (const box of boxes) {
    for (const corner of boxCorners(box)) {
      if (!withinSafeRect(camera, corner, safe)) return false
    }
  }
  return true
}

function cameraInsideStationVolume(position: THREE.Vector3): boolean {
  return (
    position.x >= STATION_VOLUME.min.x - VOLUME_EPSILON &&
    position.x <= STATION_VOLUME.max.x + VOLUME_EPSILON &&
    position.y >= STATION_VOLUME.min.y - VOLUME_EPSILON &&
    position.y <= STATION_VOLUME.max.y + VOLUME_EPSILON &&
    position.z >= STATION_VOLUME.min.z - VOLUME_EPSILON &&
    position.z <= STATION_VOLUME.max.z + VOLUME_EPSILON
  )
}

function projectedRoomArea(
  position: THREE.Vector3,
  target: THREE.Vector3,
  fov: number,
  aspect: number,
): number {
  const camera = cameraAt(position, target, fov, aspect)
  let minX = 1
  let maxX = -1
  let minY = 1
  let maxY = -1
  for (const corner of boxCorners(ROOM_VIEW_BOX)) {
    if (!pointInFront(camera, corner)) return 0
    const projected = corner.clone().project(camera)
    minX = Math.min(minX, Math.max(-1, projected.x))
    maxX = Math.max(maxX, Math.min(1, projected.x))
    minY = Math.min(minY, Math.max(-1, projected.y))
    maxY = Math.max(maxY, Math.min(1, projected.y))
  }
  return Math.max(0, maxX - minX) * Math.max(0, maxY - minY)
}

function projectedRoomHeightCoverage(
  position: THREE.Vector3,
  target: THREE.Vector3,
  fov: number,
  aspect: number,
  safe: SafeRect,
): number {
  const camera = cameraAt(position, target, fov, aspect)
  let minY = 1
  let maxY = -1
  for (const corner of boxCorners(ROOM_VIEW_BOX)) {
    if (!pointInFront(camera, corner)) return 0
    const projected = corner.clone().project(camera)
    minY = Math.min(minY, projected.y)
    maxY = Math.max(maxY, projected.y)
  }
  const safeHeight = Math.max(0.0001, safe.top - safe.bottom)
  return Math.max(0, Math.min(1.5, (maxY - minY) / safeHeight))
}

function projectedRoomVerticalCenter(
  position: THREE.Vector3,
  target: THREE.Vector3,
  fov: number,
  aspect: number,
): number {
  const camera = cameraAt(position, target, fov, aspect)
  let minY = 1
  let maxY = -1
  for (const corner of boxCorners(ROOM_VIEW_BOX)) {
    if (!pointInFront(camera, corner)) return 0
    const projected = corner.clone().project(camera)
    minY = Math.min(minY, projected.y)
    maxY = Math.max(maxY, projected.y)
  }
  return (minY + maxY) / 2
}

function centerPortraitSolution(
  solution: FrameSolution,
  boxes: FrameBox[],
  aspect: number,
  safe: SafeRect,
): FrameSolution {
  const desired = (safe.top + safe.bottom) / 2
  let position = new THREE.Vector3(...solution.position)
  let target = new THREE.Vector3(...solution.target)
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(solution.fov / 2))

  // Translate the camera and target together along the camera's screen-up
  // axis. This pans the room vertically without changing its projected
  // height or the direction of the view.
  for (let pass = 0; pass < 3; pass += 1) {
    const center = projectedRoomVerticalCenter(
      position,
      target,
      solution.fov,
      aspect,
    )
    const delta = desired - center
    if (Math.abs(delta) < 0.001) break
    const camera = cameraAt(position, target, solution.fov, aspect)
    const screenUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(camera.quaternion)
      .normalize()
    const fullShift = -delta * solution.distance * tanHalfFov
    let accepted = false
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const shift = fullShift / 2 ** attempt
      const nextPosition = position.clone().addScaledVector(screenUp, shift)
      const nextTarget = target.clone().addScaledVector(screenUp, shift)
      const nextCamera = cameraAt(nextPosition, nextTarget, solution.fov, aspect)
      if (boxesFit(boxes, nextCamera, safe)) {
        position = nextPosition
        target = nextTarget
        accepted = true
        break
      }
    }
    if (!accepted) break
  }

  return {
    ...solution,
    position: [position.x, position.y, position.z],
    target: [target.x, target.y, target.z],
    roomHeightCoverage: projectedRoomHeightCoverage(
      position,
      target,
      solution.fov,
      aspect,
      safe,
    ),
    projectedRoomArea: projectedRoomArea(
      position,
      target,
      solution.fov,
      aspect,
    ),
  }
}

function clipRayToStation(position: THREE.Vector3, direction: THREE.Vector3): [number, number] | null {
  let low = MIN_DISTANCE
  let high = MAX_DISTANCE
  const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z']
  for (const axis of axes) {
    const origin = position[axis]
    const delta = direction[axis]
    if (Math.abs(delta) < 1e-6) {
      if (origin < STATION_VOLUME.min[axis] || origin > STATION_VOLUME.max[axis]) return null
      continue
    }
    let first = (STATION_VOLUME.min[axis] - origin) / delta
    let second = (STATION_VOLUME.max[axis] - origin) / delta
    if (first > second) [first, second] = [second, first]
    low = Math.max(low, first)
    high = Math.min(high, second)
  }
  return low <= high ? [low, high] : null
}

function clipOverviewDistance(
  direction: THREE.Vector3,
  xLimit: number = OVERVIEW_X_LIMIT,
): [number, number] {
  let high = MAX_DISTANCE
  if (Math.abs(direction.x) > 1e-6) {
    high = Math.min(high, xLimit / Math.abs(direction.x))
  }
  return [MIN_DISTANCE, high]
}

interface SolveOptions {
  aspect: number
  safe: SafeRect
  fov: number
  minDistance?: number
  maxDistance: number
  stationView?: boolean
}

function solveAtFov(
  boxes: FrameBox[],
  target: THREE.Vector3,
  direction: THREE.Vector3,
  options: SolveOptions,
): FrameSolution | null {
  const minDistance = options.minDistance ?? MIN_DISTANCE
  const maxDistance = options.maxDistance
  if (maxDistance < minDistance) return null

  const fitsAt = (distance: number): THREE.Vector3 | null => {
    const position = target.clone().addScaledVector(direction, distance)
    if (options.stationView && !cameraInsideStationVolume(position)) return null
    const camera = cameraAt(position, target, options.fov, options.aspect)
    return boxesFit(boxes, camera, options.safe) ? position : null
  }

  const nearest = fitsAt(minDistance)
  let position = nearest
  if (!position) {
    const furthest = fitsAt(maxDistance)
    if (!furthest) return null
    let low = minDistance
    let high = maxDistance
    for (let step = 0; step < 28; step += 1) {
      const mid = (low + high) / 2
      if (fitsAt(mid)) high = mid
      else low = mid
    }
    position = target.clone().addScaledVector(direction, high)
    if (options.stationView && !cameraInsideStationVolume(position)) return null
  }

  return {
    position: [position.x, position.y, position.z],
    target: [target.x, target.y, target.z],
    fov: options.fov,
    distance: position.distanceTo(target),
    projectedRoomArea: projectedRoomArea(
      position,
      target,
      options.fov,
      options.aspect,
    ),
    roomHeightCoverage: projectedRoomHeightCoverage(
      position,
      target,
      options.fov,
      options.aspect,
      options.safe,
    ),
  }
}

function uniqueFovs(values: number[]): number[] {
  return [...new Set(values.map((value) => Math.min(72, Math.max(1, value))))]
}

export function solveBoxFrame(
  box: FrameBox,
  dirHint: Vec3,
  aspect: number,
  safe: SafeRect,
  targetBias: Vec3 = [0, 0, 0],
): FrameSolution | null {
  const target = new THREE.Vector3(...box.center).add(new THREE.Vector3(...targetBias))
  const direction = new THREE.Vector3(...dirHint).normalize()
  if (direction.lengthSq() < 0.5) direction.set(0, 0.1, 1).normalize()
  const distanceRange = clipRayToStation(target, direction)
  if (!distanceRange) return null
  const baseFov = baseFovForAspect(aspect)
  for (const fov of uniqueFovs([baseFov, baseFov + 3, baseFov + 6])) {
    const solution = solveAtFov([box], target, direction, {
      aspect,
      safe,
      fov,
      minDistance: distanceRange[0],
      maxDistance: distanceRange[1],
      stationView: true,
    })
    if (solution) return solution
  }
  return null
}

export function solveOverviewFrame(width: number, height: number): FrameSolution | null {
  const aspect = width / Math.max(1, height)
  const safe = safeRectFor(width, height)
  const target = new THREE.Vector3(...OVERVIEW_TARGET)
  const landscape = aspect >= 1.15
  const square = aspect >= 0.82 && aspect < 1.15
  const portrait = aspect < 0.82
  const azimuths = landscape
    ? [-12, 0, 12]
    : square
      ? [-16, 0, 16]
      : // Corner views foreshorten the room's width, letting the portrait
        // camera come closer without losing a critical box.
        [-8, 8, 0, -20, 20, -30, 30, -40, 40]
  const elevations = landscape
    ? [14, 20]
    : square
      ? [20, 26, 32]
      : // Portrait may crop the room shell, so steeper angles are useful. The
        // 24/30 candidates remain as fallbacks when critical boxes do not fit.
        [24, 30, 38, 46]
  const baseFov = baseFovForAspect(aspect)
  const fovTiers = portrait
    ? uniqueFovs([baseFov, 64, 68, 72])
    : uniqueFovs([baseFov, Math.min(68, baseFov + 8), 68])
  // Critical boxes are the acceptance constraint. In portrait the room shell
  // is allowed to overflow the frame; that is what makes a closer overview
  // possible without losing a station.
  const criticalBoxes = OVERVIEW_CRITICAL_BOXES.map((entry) => entry.box)

  let bestSolution: FrameSolution | null = null
  let bestArea = -1
  let bestAzimuth = Infinity
  for (const fov of fovTiers) {
    for (const elevation of elevations) {
      for (const azimuth of azimuths) {
        const az = THREE.MathUtils.degToRad(azimuth)
        const el = THREE.MathUtils.degToRad(elevation)
        const direction = new THREE.Vector3(
          Math.sin(az) * Math.cos(el),
          Math.sin(el),
          Math.cos(az) * Math.cos(el),
        ).normalize()
        const range = clipOverviewDistance(
          direction,
          portrait ? PORTRAIT_OVERVIEW_X_LIMIT : OVERVIEW_X_LIMIT,
        )
        if (range[1] < range[0]) continue
        const solution = solveAtFov(criticalBoxes, target, direction, {
          aspect,
          safe,
          fov,
          minDistance: range[0],
          maxDistance: range[1],
          stationView: false,
        })
        if (!solution) continue
        if (portrait) {
          const accepted = solution.roomHeightCoverage >= 0.5
          const currentAccepted = bestSolution
            ? bestSolution.roomHeightCoverage >= 0.5
            : false
          if (
            !bestSolution ||
            (accepted && !currentAccepted) ||
            (accepted === currentAccepted &&
              solution.roomHeightCoverage > bestSolution.roomHeightCoverage + 0.0005) ||
            (accepted === currentAccepted &&
              Math.abs(solution.roomHeightCoverage - bestSolution.roomHeightCoverage) <= 0.0005 &&
              solution.projectedRoomArea > bestSolution.projectedRoomArea + 0.0005) ||
            (accepted === currentAccepted &&
              Math.abs(solution.roomHeightCoverage - bestSolution.roomHeightCoverage) <= 0.0005 &&
              Math.abs(solution.projectedRoomArea - bestSolution.projectedRoomArea) <= 0.0005 &&
              Math.abs(azimuth) < Math.abs(bestAzimuth))
          ) {
            bestSolution = solution
            bestArea = solution.projectedRoomArea
            bestAzimuth = azimuth
          }
          continue
        }
        const area = solution.projectedRoomArea
        if (
          area > bestArea + 0.0005 ||
          (Math.abs(area - bestArea) <= 0.0005 && Math.abs(azimuth) < Math.abs(bestAzimuth))
        ) {
          bestSolution = solution
          bestArea = area
          bestAzimuth = azimuth
        }
      }
    }
  }
  return bestSolution && portrait
    ? centerPortraitSolution(bestSolution, criticalBoxes, aspect, safe)
    : bestSolution
}

export function solveStationFrame(
  station: Station,
  mode: 'focus' | 'read',
  width: number,
  height: number,
): FrameSolution | null {
  const aspect = width / Math.max(1, height)
  const safe = safeRectFor(width, height)
  const box = mode === 'focus' ? station.focusBox : station.readBox
  return solveBoxFrame(box, station.viewDir, aspect, safe, station.targetBias)
}

export function solutionFitsBoxes(
  solution: FrameSolution,
  boxes: FrameBox[],
  width: number,
  height: number,
): boolean {
  const safe = safeRectFor(width, height)
  const camera = cameraAt(
    new THREE.Vector3(...solution.position),
    new THREE.Vector3(...solution.target),
    solution.fov,
    width / Math.max(1, height),
  )
  return boxesFit(boxes, camera, safe)
}

export function auditFrames(width: number, height: number): FrameAuditResult {
  const safe = safeRectFor(width, height)
  const overviewSolution = solveOverviewFrame(width, height)
  const overviewBoxes: CriticalBox[] = OVERVIEW_CRITICAL_BOXES
  const overviewPass = Boolean(
    overviewSolution &&
      solutionFitsBoxes(
        overviewSolution,
        overviewBoxes.map((entry) => entry.box),
        width,
        height,
      ),
  )
  const stations = STATIONS.filter((station) => station.n > 1).map((station) => {
    const focus = solveStationFrame(station, 'focus', width, height)
    const read = solveStationFrame(station, 'read', width, height)
    return {
      n: station.n,
      id: station.id,
      title: station.title,
      focus: { pass: Boolean(focus), solution: focus },
      read: { pass: Boolean(read), solution: read },
    }
  })
  const pixels = {
    left: ((safe.left + 1) / 2) * width,
    top: ((1 - safe.top) / 2) * height,
    right: ((safe.right + 1) / 2) * width,
    bottom: ((1 - safe.bottom) / 2) * height,
  }
  return {
    width,
    height,
    aspect: width / Math.max(1, height),
    safe,
    safePixels: pixels,
    overview: {
      pass: overviewPass,
      solution: overviewSolution,
      boxes: overviewBoxes.map((entry) => ({
        id: entry.id,
        label: entry.label,
        pass: Boolean(
          overviewSolution &&
            solutionFitsBoxes(overviewSolution, [entry.box], width, height),
        ),
      })),
    },
    stations,
  }
}

/** Dev-only inspection used by the viewport QA harness. */
export function debugOverviewCandidates(width: number, height: number) {
  const aspect = width / Math.max(1, height)
  const safe = safeRectFor(width, height)
  const target = new THREE.Vector3(...OVERVIEW_TARGET)
  const criticalBoxes = OVERVIEW_CRITICAL_BOXES.map((entry) => entry.box)
  const rows: Array<{
    fov: number
    elevation: number
    azimuth: number
    distance: number
    coverage: number
    area: number
    position: Vec3
  }> = []
  for (const fov of uniqueFovs([60, 62, 64, 68, 72])) {
    for (const elevation of [10, 14, 20, 24, 30, 38, 46, 54, 62]) {
      for (const azimuth of [-40, -30, -20, -10, 0, 10, 20, 30, 40]) {
        const az = THREE.MathUtils.degToRad(azimuth)
        const el = THREE.MathUtils.degToRad(elevation)
        const direction = new THREE.Vector3(
          Math.sin(az) * Math.cos(el),
          Math.sin(el),
          Math.cos(az) * Math.cos(el),
        ).normalize()
        const range = clipOverviewDistance(direction, 18)
        if (range[1] < range[0]) continue
        const solution = solveAtFov(criticalBoxes, target, direction, {
          aspect,
          safe,
          fov,
          minDistance: range[0],
          maxDistance: range[1],
          stationView: false,
        })
        if (solution) {
          rows.push({
            fov,
            elevation,
            azimuth,
            distance: solution.distance,
            coverage: solution.roomHeightCoverage,
            area: solution.projectedRoomArea,
            position: solution.position,
          })
        }
      }
    }
  }
  return rows.sort((a, b) => b.coverage - a.coverage).slice(0, 20)
}

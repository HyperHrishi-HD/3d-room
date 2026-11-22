/**
 * Mutable look state for the full-room view. Everything here is read by the
 * camera in the render loop, so dragging a pointer never causes a React
 * re-render. The camera itself stays at a standing point inside the room; the
 * yaw is unbounded (full 360) and the pitch offset is clamped so the view can
 * never pass under the floor or through the ceiling.
 */

export const LOOK_PIVOT: readonly [number, number, number] = [0, 1.72, 0.15]
export const LOOK_PITCH_BASE = 0
export const LOOK_PITCH_LIMIT = (30 * Math.PI) / 180
export const LOOK_BASE_FOV = 62
export const LOOK_MIN_ZOOM = 1
export const LOOK_MAX_ZOOM = 2.5
export const LOOK_HINT_KEY = 'room-look-hint-v1'
export const LOOK_DRAG_EVENT = 'room-look-dragged'

export interface OverviewLook {
  active: boolean
  blend: number
  yaw: number
  targetYaw: number
  pitch: number
  targetPitch: number
  yawVelocity: number
  pitchVelocity: number
  dragging: boolean
  zoom: number
  targetZoom: number
  keyboardMode: boolean
}

export const look: OverviewLook = {
  active: false,
  blend: 0,
  yaw: 0,
  targetYaw: 0,
  pitch: 0,
  targetPitch: 0,
  yawVelocity: 0,
  pitchVelocity: 0,
  dragging: false,
  zoom: 1,
  targetZoom: 1,
  keyboardMode: false,
}

export function clampPitch(value: number): number {
  return Math.max(-LOOK_PITCH_LIMIT, Math.min(LOOK_PITCH_LIMIT, value))
}

export function setLookZoom(value: number): void {
  look.targetZoom = Math.max(LOOK_MIN_ZOOM, Math.min(LOOK_MAX_ZOOM, value))
}

export function engageLook(): void {
  look.active = true
}

export function exitLook(resetZoom = false): void {
  look.active = false
  look.keyboardMode = false
  look.yawVelocity = 0
  look.pitchVelocity = 0
  look.targetYaw = 0
  look.targetPitch = 0
  look.dragging = false
  if (resetZoom) {
    look.zoom = 1
    look.targetZoom = 1
  }
}

export function resetLook(): void {
  exitLook(true)
  look.blend = 0
  look.yaw = 0
  look.pitch = 0
}

export function yawDegrees(): number {
  const degrees = (look.yaw * 180) / Math.PI
  return ((degrees % 360) + 360) % 360
}

/**
 * A single left-mouse/finger gesture is either a tap or a look drag. The look
 * controller records the pointer here; room objects only activate when the
 * gesture stayed inside the 8 px tap slop. Keeping this module-level avoids a
 * React render for every pointer move.
 */

type Start = { x: number; y: number; id: number; at: number; moved: boolean }

const TAP_SLOP = 8
let start: Start | null = null
let suppressed = false
let lookSuppressed = false

/** Keep the overview look controller out of a scene-object drag. */
export function suppressLookDrag(): void {
  lookSuppressed = true
}

export function releaseLookDrag(): void {
  lookSuppressed = false
}

export function isLookDragSuppressed(): boolean {
  return lookSuppressed
}

/** Start a fresh gesture. A new touch must clear the previous pinch's guard. */
export function beginGesture(): void {
  suppressed = false
}

/** A multi-touch gesture is a pinch, never a tap on the object underneath. */
export function cancelTap(): void {
  suppressed = true
  if (start) start.moved = true
}

export function beginPointer(x: number, y: number, id: number): void {
  start = { x, y, id, at: performance.now(), moved: false }
}

export function movePointer(x: number, y: number, id: number): void {
  if (!start || start.id !== id || start.moved) return
  if (Math.hypot(x - start.x, y - start.y) > TAP_SLOP) start.moved = true
}

/** True when this pointer belongs to a short, stationary tap. */
export function isTapPointer(x: number, y: number, id: number): boolean {
  if (suppressed) return false
  if (!start || start.id !== id) return true
  if (start.moved) return false
  return Math.hypot(x - start.x, y - start.y) <= TAP_SLOP
}

type TapEvent = {
  nativeEvent: { clientX: number; clientY: number }
  pointerId: number
  stopPropagation: () => void
}

/** Activate a room target only when the gesture was a clean tap. */
export function tapCall(event: TapEvent, activate: () => void): void {
  if (!isTapPointer(event.nativeEvent.clientX, event.nativeEvent.clientY, event.pointerId)) {
    return
  }
  event.stopPropagation()
  activate()
}

import { useEffect, useRef, useState } from 'react'
import {
  clampPitch,
  engageLook,
  exitLook,
  LOOK_DRAG_EVENT,
  LOOK_HINT_KEY,
  LOOK_MAX_ZOOM,
  LOOK_MIN_ZOOM,
  LOOK_PITCH_LIMIT,
  look,
  resetLook,
  setLookZoom,
} from './overviewLook'
import { useRoom } from '../state/roomStore'
import {
  beginGesture,
  beginPointer,
  cancelTap,
  isLookDragSuppressed,
  movePointer,
  releaseLookDrag,
} from './tapGuard'

const TAP_SLOP = 8
const YAW_PER_PIXEL = 0.006
const PITCH_PER_PIXEL = 0.005
const KEY_YAW = 0.085
const KEY_PITCH = 0.055

type Point = { x: number; y: number }
type DragState = {
  id: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  startYaw: number
  startPitch: number
  startTime: number
  moved: boolean
}

function isTvDisplay() {
  return (
    window.matchMedia('(min-width: 1920px)').matches &&
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(hover: none)').matches
  )
}

function dismissHint() {
  try {
    window.sessionStorage.setItem(LOOK_HINT_KEY, '1')
  } catch {
    // A private window can refuse storage; hide it for this page anyway.
  }
  window.dispatchEvent(new CustomEvent(LOOK_DRAG_EVENT))
}

export default function LookControls() {
  const { active, destination, menuOpen } = useRoom()
  const [tv, setTv] = useState(() => isTvDisplay())
  const [keyboardUsed, setKeyboardUsed] = useState(false)
  const [lookMode, setLookMode] = useState(false)
  const [zoomLabel, setZoomLabel] = useState(1)
  const [hintVisible, setHintVisible] = useState(false)
  const eligible = !menuOpen && !active && !destination
  const eligibleRef = useRef(eligible)
  eligibleRef.current = eligible
  // While a station is open, one-finger look is off but two-finger pinch (and
  // the wheel) can still change the camera lens, exactly like the overview.
  const sectionZoom = !menuOpen && Boolean(active) && !destination
  const sectionZoomRef = useRef(sectionZoom)
  sectionZoomRef.current = sectionZoom
  const drag = useRef<DragState | null>(null)
  const points = useRef(new Map<number, Point>())
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)
  const lastMoveAt = useRef(0)

  useEffect(() => {
    const update = () => setTv(isTvDisplay())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    resetLook()
    setLookMode(false)
    setZoomLabel(1)
  }, [active, destination])

  // A one-time, per-visit hint. It is removed by the first real drag or after
  // four seconds, and is never mounted as permanent chrome.
  useEffect(() => {
    if (!eligible) {
      setHintVisible(false)
      return
    }
    let seen = false
    try {
      seen = window.sessionStorage.getItem(LOOK_HINT_KEY) === '1'
    } catch {
      seen = false
    }
    if (seen) return
    setHintVisible(true)
    const timer = window.setTimeout(() => {
      setHintVisible(false)
      try {
        window.sessionStorage.setItem(LOOK_HINT_KEY, '1')
      } catch {
        // Ignore storage refusal.
      }
    }, 4000)
    const hide = () => {
      window.clearTimeout(timer)
      setHintVisible(false)
    }
    window.addEventListener(LOOK_DRAG_EVENT, hide)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(LOOK_DRAG_EVENT, hide)
    }
  }, [eligible])

  // Drag, pinch, wheel. The canvas owns touch-action: none, so these gestures
  // cannot be stolen by scrolling or pull-to-refresh.
  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.scene canvas')
    if (!canvas) return

    const beginLook = () => {
      engageLook()
      dismissHint()
    }

    const onPointerDown = (event: PointerEvent) => {
      const canLook = eligibleRef.current
      const canZoom = sectionZoomRef.current
      if (!canLook && !canZoom) return
      // A photo drag owns this gesture; do not start an overview orbit.
      if (isLookDragSuppressed()) return
      if (points.current.size === 0) beginGesture()
      if (canLook) beginPointer(event.clientX, event.clientY, event.pointerId)
      points.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (points.current.size === 2) {
        cancelTap()
        const values = [...points.current.values()]
        pinch.current = {
          distance: Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y),
          zoom: look.targetZoom,
        }
        drag.current = null
        return
      }
      if (points.current.size > 1 || !canLook) return
      drag.current = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        startYaw: look.targetYaw,
        startPitch: look.targetPitch,
        startTime: performance.now(),
        moved: false,
      }
      look.yawVelocity = 0
      look.pitchVelocity = 0
      // Capturing the first finger can hide the second one from the pinch
      // handler on touch screens. The canvas fills the viewport, so capture is
      // only needed for a mouse leaving the window.
      if (event.pointerType !== 'touch') {
        try {
          canvas.setPointerCapture(event.pointerId)
        } catch {
          // Pointer capture is an enhancement, not a requirement.
        }
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      const canLook = eligibleRef.current
      const canZoom = sectionZoomRef.current
      if (!canLook && !canZoom) return
      if (isLookDragSuppressed()) return
      if (canLook) movePointer(event.clientX, event.clientY, event.pointerId)
      if (points.current.has(event.pointerId)) {
        points.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      }
      if (pinch.current && points.current.size === 2) {
        const values = [...points.current.values()]
        const distance = Math.max(
          1,
          Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y),
        )
        if (canLook) beginLook()
        setLookZoom(pinch.current.zoom * (distance / Math.max(1, pinch.current.distance)))
        setZoomLabel(look.targetZoom)
        event.preventDefault()
        return
      }
      if (!canLook) return
      const state = drag.current
      if (!state || state.id !== event.pointerId) return
      const dx = event.clientX - state.startX
      const dy = event.clientY - state.startY
      if (!state.moved && Math.hypot(dx, dy) < TAP_SLOP) return
      state.moved = true
      look.dragging = true
      beginLook()
      look.targetYaw = state.startYaw + dx * YAW_PER_PIXEL
      look.targetPitch = clampPitch(state.startPitch - dy * PITCH_PER_PIXEL)
      const now = performance.now()
      const elapsed = Math.max(8, now - lastMoveAt.current)
      const dYaw = (event.clientX - state.lastX) * YAW_PER_PIXEL
      const dPitch = -(event.clientY - state.lastY) * PITCH_PER_PIXEL
      look.yawVelocity = (dYaw * 1000) / elapsed
      look.pitchVelocity = (dPitch * 1000) / elapsed
      state.lastX = event.clientX
      state.lastY = event.clientY
      lastMoveAt.current = now
      event.preventDefault()
    }

    const endPointer = (event: PointerEvent) => {
      releaseLookDrag()
      points.current.delete(event.pointerId)
      if (points.current.size < 2) pinch.current = null
      const state = drag.current
      if (state && state.id === event.pointerId) {
        look.dragging = false
        // A short flick glides and settles. A deliberate slow drag has almost
        // no release velocity and stops where the finger left it.
        const elapsed = Math.max(1, performance.now() - state.startTime)
        const speed = Math.hypot(
          (event.clientX - state.startX) / elapsed,
          (event.clientY - state.startY) / elapsed,
        )
        if (!state.moved || speed < 0.08) {
          look.yawVelocity = 0
          look.pitchVelocity = 0
        }
        drag.current = null
      }
      try {
        canvas.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore an already-released pointer.
      }
    }

    const onWheel = (event: WheelEvent) => {
      const canLook = eligibleRef.current
      if (!canLook && !sectionZoomRef.current) return
      event.preventDefault()
      if (canLook) beginLook()
      setLookZoom(look.targetZoom * Math.exp(-event.deltaY * 0.0014))
      setZoomLabel(look.targetZoom)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', endPointer)
    canvas.addEventListener('pointercancel', endPointer)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endPointer)
      canvas.removeEventListener('pointercancel', endPointer)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      setKeyboardUsed(true)
      if (event.key === 'Escape' && lookMode) {
        event.preventDefault()
        exitLook()
        setLookMode(false)
        return
      }
      if (!eligibleRef.current || !lookMode) return
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        engageLook()
        look.targetYaw -= KEY_YAW
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        engageLook()
        look.targetYaw += KEY_YAW
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        engageLook()
        look.targetPitch = clampPitch(look.targetPitch + KEY_PITCH)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        engageLook()
        look.targetPitch = clampPitch(look.targetPitch - KEY_PITCH)
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setLookZoom(look.targetZoom + 0.2)
        setZoomLabel(look.targetZoom)
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault()
        setLookZoom(look.targetZoom - 0.2)
        setZoomLabel(look.targetZoom)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lookMode])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const debug = {
      engage: () => {
        engageLook()
        look.yaw = look.targetYaw
        look.pitch = look.targetPitch
        look.blend = 1
      },
      setYaw: (degrees: number) => {
        look.targetYaw = (degrees * Math.PI) / 180
        look.yaw = look.targetYaw
        look.blend = 1
        engageLook()
      },
      setPitch: (degrees: number) => {
        look.targetPitch = clampPitch((degrees * Math.PI) / 180)
        look.pitch = look.targetPitch
        look.blend = 1
        engageLook()
      },
      setZoom: (value: number) => {
        look.targetZoom = Math.max(LOOK_MIN_ZOOM, Math.min(LOOK_MAX_ZOOM, value))
        look.zoom = look.targetZoom
        setZoomLabel(look.targetZoom)
      },
      exit: () => {
        exitLook(true)
        setLookMode(false)
      },
      snapshot: () => ({ ...look, yawDegrees: (look.yaw * 180) / Math.PI }),
      pivot: [0, 1.72, 0.15],
      pitchLimit: LOOK_PITCH_LIMIT,
    }
    ;(window as typeof window & { __OVERVIEW_LOOK__?: typeof debug }).__OVERVIEW_LOOK__ =
      debug
    return () => {
      delete (window as typeof window & { __OVERVIEW_LOOK__?: typeof debug })
        .__OVERVIEW_LOOK__
    }
  }, [])

  if (!eligible) return null
  const showControls = tv || keyboardUsed

  return (
    <>
      {hintVisible ? (
        <div className="look-hint" aria-hidden="true">
          drag to look around
        </div>
      ) : null}
      {showControls ? (
        <div className="look-controls" role="group" aria-label="Room view controls">
          <button
            type="button"
            className={`look-controls__button ${lookMode ? 'is-active' : ''}`}
            aria-pressed={lookMode}
            onClick={() => {
              if (lookMode) {
                exitLook()
                setLookMode(false)
              } else {
                engageLook()
                look.keyboardMode = true
                dismissHint()
                setLookMode(true)
              }
            }}
          >
            {lookMode ? 'Exit look' : 'Look around'}
          </button>
          <button
            type="button"
            className="look-controls__zoom"
            aria-label="Zoom out"
            disabled={look.targetZoom <= LOOK_MIN_ZOOM}
            onClick={() => {
              engageLook()
              setLookZoom(look.targetZoom - 0.25)
              setZoomLabel(look.targetZoom)
            }}
          >
            −
          </button>
          <span className="look-controls__zoom-label" aria-live="polite">
            {zoomLabel.toFixed(1)}×
          </span>
          <button
            type="button"
            className="look-controls__zoom"
            aria-label="Zoom in"
            disabled={look.targetZoom >= LOOK_MAX_ZOOM}
            onClick={() => {
              engageLook()
              setLookZoom(look.targetZoom + 0.25)
              setZoomLabel(look.targetZoom)
            }}
          >
            +
          </button>
        </div>
      ) : null}
    </>
  )
}

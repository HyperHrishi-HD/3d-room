import { assetUrl } from './assetUrl'
import { setMusicMuted } from './music'

/**
 * One small, shared audio helper for every sound in the room.
 * Audio is optional: a missing file, blocked autoplay, or hidden tab must
 * never throw or interrupt an interaction.
 */

export type SoundName =
  | 'camera-whoosh'
  | 'ui-click'
  | 'ui-open'
  | 'letter-open'
  | 'fridge-pop'
  | 'success-soft'
  | 'kitchen-clink'
  | 'map-pin'
  | 'map-whoosh'
  | 'timeline-tick'
  | 'page-flip'
  | 'paper-slide'
  | 'ai-type'
  | 'medal-chime'
  | 'flower-bloom'
  | 'tv-click'
  | 'envelope-open'
  | 'letter-send'

const SOURCES: Record<SoundName, string> = {
  'camera-whoosh': assetUrl('/sfx/camera-whoosh.mp3'),
  'ui-click': assetUrl('/sfx/ui-click.mp3'),
  'ui-open': assetUrl('/sfx/ui-open.mp3'),
  'letter-open': assetUrl('/sfx/letter-open.mp3'),
  'fridge-pop': assetUrl('/sfx/fridge-pop.mp3'),
  'success-soft': assetUrl('/sfx/success-soft.mp3'),
  'kitchen-clink': assetUrl('/sfx/kitchen-clink.mp3'),
  'map-pin': assetUrl('/sfx/map-pin.mp3'),
  'map-whoosh': assetUrl('/sfx/map-whoosh.mp3'),
  'timeline-tick': assetUrl('/sfx/timeline-tick.mp3'),
  'page-flip': assetUrl('/sfx/page-flip.mp3'),
  'paper-slide': assetUrl('/sfx/paper-slide.mp3'),
  'ai-type': assetUrl('/sfx/ai-type.mp3'),
  'medal-chime': assetUrl('/sfx/medal-chime.mp3'),
  'flower-bloom': assetUrl('/sfx/flower-bloom.mp3'),
  'tv-click': assetUrl('/sfx/tv-click.mp3'),
  'envelope-open': assetUrl('/sfx/envelope-open.mp3'),
  'letter-send': assetUrl('/sfx/letter-send.mp3'),
}

// UI clicks and page sounds need enough room for the full animation; station
// sounds are deliberately a little slower so repeated taps cannot machine-gun.
const COOLDOWN_MS: Record<SoundName, number> = {
  'camera-whoosh': 600,
  'ui-click': 250,
  'ui-open': 250,
  'letter-open': 600,
  'fridge-pop': 500,
  'success-soft': 250,
  'kitchen-clink': 500,
  'map-pin': 500,
  'map-whoosh': 600,
  'timeline-tick': 300,
  'page-flip': 600,
  'paper-slide': 300,
  'ai-type': 90,
  'medal-chime': 500,
  'flower-bloom': 500,
  'tv-click': 250,
  'envelope-open': 600,
  'letter-send': 300,
}

const MUTE_KEY = 'room-sfx-muted-v1'
const MASTER_VOLUME = 0.5
const MIN_GAP_MS = 120
const MAX_CONCURRENT = 3

const cache = new Map<SoundName, HTMLAudioElement>()
const lastPlayed = new Map<SoundName, number>()
const playing = new Set<SoundName>()
let activeCount = 0
let lastAny = 0
let unlocked = false
let muted = readMuted()

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function persistMuted(value: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Private windows can refuse storage; the current session still works.
  }
}

function unlock(): void {
  unlocked = true
}

if (typeof document !== 'undefined') {
  const events: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'touchstart']
  const onGesture = () => {
    unlock()
    for (const event of events) document.removeEventListener(event, onGesture, true)
  }
  for (const event of events) document.addEventListener(event, onGesture, true)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stopAll()
  })
}

function canPlay(): boolean {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return false
  if (muted || document.visibilityState === 'hidden') return false
  const activation = navigator.userActivation
  return unlocked || Boolean(activation?.hasBeenActive)
}

function stopAll(): void {
  for (const audio of cache.values()) {
    try {
      audio.pause()
      audio.currentTime = 0
    } catch {
      // A browser that cannot seek this audio still gets silence.
    }
  }
  playing.clear()
  activeCount = 0
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  persistMuted(value)
  if (value) stopAll()
  setMusicMuted(value)
}

export function toggleMuted(): boolean {
  setMuted(!muted)
  return muted
}

export function playSfx(name: SoundName): void {
  if (!canPlay()) return
  const now = performance.now()
  const last = lastPlayed.get(name) ?? 0
  if (now - last < COOLDOWN_MS[name]) return
  if (now - lastAny < MIN_GAP_MS) return
  if (playing.has(name) || activeCount >= MAX_CONCURRENT) return

  let audio = cache.get(name)
  if (!audio) {
    try {
      audio = new Audio(SOURCES[name])
      audio.preload = 'auto'
      audio.volume = MASTER_VOLUME
      cache.set(name, audio)
      const release = () => {
        playing.delete(name)
        activeCount = Math.max(0, activeCount - 1)
      }
      audio.addEventListener('ended', release)
      audio.addEventListener('error', release)
    } catch {
      return
    }
  }

  lastPlayed.set(name, now)
  lastAny = now
  playing.add(name)
  activeCount += 1
  try {
    audio.currentTime = 0
    void audio.play().catch(() => {
      playing.delete(name)
      activeCount = Math.max(0, activeCount - 1)
    })
  } catch {
    playing.delete(name)
    activeCount = Math.max(0, activeCount - 1)
  }
}

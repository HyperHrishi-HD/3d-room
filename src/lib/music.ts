/**
 * The single background-music bed. It shares the saved mute preference with
 * the SFX layer, starts only after a real gesture, fades in over two seconds,
 * and pauses while the tab is hidden. Volume is deliberately far below the
 * 0.5 SFX master so it can never mask a station sound.
 *
 * Track: "Chill lofi inspired (loop edit)" by omfgdude, loop edit by qubodup.
 * CC0 1.0 Universal. Source:
 * https://opengameart.org/content/chill-lofi-inspired-loop-edit
 */

import { assetUrl } from './assetUrl'

const MUTE_KEY = 'room-sfx-muted-v1'
const MUSIC_VOLUME = 0.08
const FADE_IN_MS = 2000
const FADE_OUT_MS = 180
const TICK_MS = 50

let muted = readMuted()
let unlocked = false
let started = false
let audio: HTMLAudioElement | null = null
let fadeTimer: number | null = null
let targetVolume = 0

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

function writeStatus() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.music = audio && !audio.paused ? 'playing' : 'paused'
  document.documentElement.dataset.musicMuted = muted ? '1' : '0'
  document.documentElement.dataset.musicVolume = audio ? audio.volume.toFixed(3) : '0'
}

function createAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  try {
    const element = new Audio()
    element.loop = true
    element.preload = 'auto'
    element.volume = 0
    // MP3 first: every current engine decodes it without Firefox's OGG
    // range-request parse warning. OGG remains for browsers without MP3.
    element.src = assetUrl(
      element.canPlayType('audio/mpeg')
        ? '/music/peaceful-loop.mp3'
        : '/music/peaceful-loop.ogg',
    )
    element.addEventListener('error', () => {
      stopFade()
      writeStatus()
    })
    element.addEventListener('play', writeStatus)
    element.addEventListener('pause', writeStatus)
    audio = element
    return element
  } catch {
    return null
  }
}

function stopFade() {
  if (fadeTimer !== null) {
    window.clearInterval(fadeTimer)
    fadeTimer = null
  }
}

function fadeTo(target: number, duration: number, pauseAtEnd = false) {
  stopFade()
  const element = audio
  if (!element) return
  const from = element.volume
  const startedAt = performance.now()
  targetVolume = target
  element.volume = from
  fadeTimer = window.setInterval(() => {
    const progress = Math.min(1, (performance.now() - startedAt) / Math.max(1, duration))
    const eased = progress * progress * (3 - 2 * progress)
    element.volume = Math.min(1, Math.max(0, from + (target - from) * eased))
    writeStatus()
    if (progress >= 1) {
      stopFade()
      element.volume = target
      if (pauseAtEnd && target === 0) {
        try {
          element.pause()
        } catch {
          // A refused pause still leaves the music at zero.
        }
      }
      writeStatus()
    }
  }, TICK_MS)
}

function canStart() {
  return unlocked && !muted && document.visibilityState !== 'hidden'
}

function ensurePlaying() {
  if (!audio) createAudio()
  const element = audio
  if (!element || !canStart()) return
  if (element.paused) {
    const attempt = element.play()
    if (attempt) {
      void attempt
        .then(() => {
          started = true
          fadeTo(MUSIC_VOLUME, FADE_IN_MS)
          writeStatus()
        })
        .catch(() => {
          // A browser can still refuse; the next real gesture retries.
          started = false
          writeStatus()
        })
    }
  } else if (targetVolume < MUSIC_VOLUME) {
    fadeTo(MUSIC_VOLUME, FADE_IN_MS)
  }
}

function unlock() {
  if (unlocked) return
  unlocked = true
  ensurePlaying()
}

if (typeof document !== 'undefined') {
  const gestureEvents: Array<keyof DocumentEventMap> = ['pointerdown', 'keydown', 'touchstart']
  const onGesture = () => {
    unlock()
    for (const event of gestureEvents) document.removeEventListener(event, onGesture, true)
  }
  for (const event of gestureEvents) {
    document.addEventListener(event, onGesture, { capture: true })
  }
  document.addEventListener('visibilitychange', () => {
    if (!audio) return
    if (document.visibilityState === 'hidden') {
      fadeTo(0, FADE_OUT_MS, true)
    } else if (canStart()) {
      ensurePlaying()
    }
  })
  // Reflect the saved preference before the first gesture so QA and the mute
  // icon never disagree about the current state.
  writeStatus()
}

/** Called by the shared SFX mute control, so one toggle owns both layers. */
export function setMusicMuted(value: boolean) {
  muted = value
  if (value) {
    if (audio) fadeTo(0, FADE_OUT_MS, true)
  } else if (unlocked) {
    ensurePlaying()
  }
  writeStatus()
}

export function musicSnapshot() {
  return {
    src: audio?.src ?? '',
    paused: audio?.paused ?? true,
    volume: audio?.volume ?? 0,
    muted,
    unlocked,
    started,
  }
}

declare global {
  interface Window {
    __MUSIC_STATE__?: () => ReturnType<typeof musicSnapshot>
  }
}

if (typeof window !== 'undefined') {
  window.__MUSIC_STATE__ = musicSnapshot
}

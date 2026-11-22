import { MEDIA_SLOTS } from '../data/mediaManifest'
import { assetUrl } from './assetUrl'

const images = new Map<number, HTMLImageElement>()
const pathImages = new Map<string, HTMLImageElement>()
const pathThumbs = new Map<string, HTMLImageElement>()
const requests = new Map<string, HTMLImageElement>()
const thumbRequests = new Map<string, HTMLImageElement>()
const failed = new Set<string>()
const failedThumbs = new Set<string>()
const listeners = new Set<() => void>()
let started = false
let version = 0

function announce() {
  version += 1
  for (const listener of listeners) listener()
  if (import.meta.env.DEV) {
    ;(window as typeof window & { __MEDIA_DEBUG__?: unknown }).__MEDIA_DEBUG__ = {
      loaded: () => [...images.keys()],
      loadedPaths: () => [...pathImages.keys()],
      loadedThumbs: () => [...pathThumbs.keys()],
      version: () => version,
    }
  }
}

/**
 * Every photograph has a 96 px WebP thumbnail beside it under /media/thumbs.
 * The scene paints that soft version first, then repaints when the full print
 * arrives, so a station is never blank or stuck on a loading card.
 */
export function mediaThumbPath(src: string | undefined): string | null {
  if (!src) return null
  const match = src.match(/^\/media\/([^?#]+)$/)
  if (!match || match[1].startsWith('thumbs/')) return null
  const file = match[1].replace(/\.[^.]+$/, '.webp')
  return `/media/thumbs/${file}`
}

/**
 * Tries the expected filename for every designed slot. Missing files are the
 * normal state until the owner adds them; the procedural placeholder stays.
 */
export function preloadMediaSlots() {
  if (started || typeof window === 'undefined') return
  started = true
  for (const slot of MEDIA_SLOTS) {
    if (slot.seed === undefined) continue
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      images.set(slot.seed as number, image)
      announce()
    }
    image.onerror = () => undefined
    image.src = assetUrl(`/media/${slot.file}`)
  }
}

export function getMediaImage(seed: number): HTMLImageElement | null {
  return images.get(seed) ?? null
}

export function getMediaImageByPath(src: string | undefined): HTMLImageElement | null {
  if (!src) return null
  const loaded = pathImages.get(src)
  if (loaded) return loaded

  const thumbSrc = mediaThumbPath(src)
  const thumb = thumbSrc ? pathThumbs.get(thumbSrc) : null
  if (thumb) {
    // Start the full-size request now; the soft print is already in place.
    if (!requests.has(src) && !failed.has(src)) requestFull(src)
    return thumb
  }

  if (!failed.has(src) && !requests.has(src)) requestFull(src)
  if (thumbSrc && !failedThumbs.has(thumbSrc) && !thumbRequests.has(thumbSrc)) {
    requestThumb(thumbSrc)
  }
  return null
}

function requestFull(src: string) {
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    pathImages.set(src, image)
    requests.delete(src)
    announce()
  }
  image.onerror = () => {
    requests.delete(src)
    failed.add(src)
  }
  image.src = assetUrl(src)
  requests.set(src, image)
}

function requestThumb(thumbSrc: string) {
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    pathThumbs.set(thumbSrc, image)
    thumbRequests.delete(thumbSrc)
    announce()
  }
  image.onerror = () => {
    thumbRequests.delete(thumbSrc)
    failedThumbs.add(thumbSrc)
  }
  image.src = assetUrl(thumbSrc)
  thumbRequests.set(thumbSrc, image)
}

export function subscribeMedia(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getMediaVersion() {
  return version
}

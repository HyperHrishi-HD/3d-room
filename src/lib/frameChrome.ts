import { useEffect, useState } from 'react'

export const FRAME_CHROME_EVENT = 'room-frame-chrome'

export interface ChromeMetrics {
  top: number
  bottom: number
}

function readVariable(name: string, fallback: number): number {
  const value = Number.parseFloat(
    window.getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
  )
  return Number.isFinite(value) ? value : fallback
}

export function readChromeMetrics(): ChromeMetrics {
  return {
    top: Math.max(0, readVariable('--chrome-top', 80)),
    bottom: Math.max(0, readVariable('--chrome-bottom', 12)),
  }
}

/**
 * Writes the real rendered chrome heights into CSS variables. The camera's
 * safe rectangle reads those variables rather than guessing at 16:9. The AI
 * dock is included at the bottom so the station never frames content behind it.
 */
export function useFrameChromePublisher(): void {
  useEffect(() => {
    const root = document.documentElement
    const header = document.querySelector<HTMLElement>('.site-header')
    let tour: HTMLElement | null = null
    let dock: HTMLElement | null = null
    let last = ''
    let resize: ResizeObserver | null = null

    const update = () => {
      const viewportHeight = window.innerHeight
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0
      let top = headerBottom
      let bottomPixels = 0
      if (tour) {
        const rect = tour.getBoundingClientRect()
        if (rect.top < viewportHeight / 2) {
          top = Math.max(top, rect.bottom)
        } else {
          bottomPixels = Math.max(0, viewportHeight - rect.top)
        }
      }
      if (dock) {
        const rect = dock.getBoundingClientRect()
        bottomPixels = Math.max(bottomPixels, Math.max(0, viewportHeight - rect.top))
      }
      const next = {
        top: Math.ceil(top + 12),
        bottom: Math.ceil(bottomPixels + 12),
      }
      const serialized = `${next.top}:${next.bottom}`
      if (serialized === last) return
      last = serialized
      root.style.setProperty('--chrome-top', `${next.top}px`)
      root.style.setProperty('--chrome-bottom', `${next.bottom}px`)
      window.dispatchEvent(new Event(FRAME_CHROME_EVENT))
    }

    const attachChrome = () => {
      const nextTour = document.querySelector<HTMLElement>('.tour-bar')
      if (nextTour !== tour) {
        if (tour) resize?.unobserve(tour)
        tour = nextTour
        if (tour) resize?.observe(tour)
      }
      const nextDock = document.querySelector<HTMLElement>('.ai-dock')
      if (nextDock !== dock) {
        if (dock) resize?.unobserve(dock)
        dock = nextDock
        if (dock) resize?.observe(dock)
      }
      update()
    }

    resize = new ResizeObserver(update)
    if (header) resize.observe(header)
    const mutations = new MutationObserver(attachChrome)
    mutations.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', update)
    attachChrome()
    update()

    return () => {
      mutations.disconnect()
      resize?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])
}

/** The R3F director subscribes to the same measurements after CSS is written. */
export function useChromeMetrics(): ChromeMetrics {
  const [metrics, setMetrics] = useState<ChromeMetrics>(() => readChromeMetrics())
  useEffect(() => {
    const update = () => setMetrics(readChromeMetrics())
    window.addEventListener(FRAME_CHROME_EVENT, update)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener(FRAME_CHROME_EVENT, update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return metrics
}

import { useEffect, useRef } from 'react'
import { FRAME_CHROME_EVENT } from '../lib/frameChrome'
import { auditFrames, type FrameAuditResult } from '../three/frameSolver'

declare global {
  interface Window {
    __FRAME_AUDIT__?: () => FrameAuditResult
  }
}

export default function FrameAudit() {
  const outlineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const debug = new URLSearchParams(window.location.search).has('frameqa')
    // Production builds normally tree-shake this QA hook. The explicit
    // ?frameqa flag keeps the same 33/33 audit available on the live site.
    if (!import.meta.env.DEV && !debug) return
    let frame = 0

    const run = () => {
      const canvas = document.querySelector<HTMLCanvasElement>('.scene canvas')
      const rect = canvas?.getBoundingClientRect()
      const width = rect?.width ?? window.innerWidth
      const height = rect?.height ?? window.innerHeight
      const audit = auditFrames(width, height)
      const outline = outlineRef.current
      if (outline) {
        outline.style.display = debug ? 'block' : 'none'
        outline.style.left = `${audit.safePixels.left}px`
        outline.style.top = `${audit.safePixels.top}px`
        outline.style.width = `${audit.safePixels.right - audit.safePixels.left}px`
        outline.style.height = `${audit.safePixels.bottom - audit.safePixels.top}px`
      }
      if (!debug) return
      const rows = [
        { view: 'overview', pass: audit.overview.pass ? 'PASS' : 'FAIL' },
        ...audit.stations.flatMap((station) => [
          {
            view: `${station.n} ${station.title} focus`,
            pass: station.focus.pass ? 'PASS' : 'FAIL',
          },
          {
            view: `${station.n} ${station.title} read`,
            pass: station.read.pass ? 'PASS' : 'FAIL',
          },
        ]),
      ]
      console.groupCollapsed(
        `[frame audit] ${Math.round(audit.width)}x${Math.round(audit.height)}`,
      )
      console.table(rows)
      console.info('safe rect', audit.safePixels)
      console.groupEnd()
    }

    const queue = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(run)
    }

    window.__FRAME_AUDIT__ = () => {
      const canvas = document.querySelector<HTMLCanvasElement>('.scene canvas')
      const rect = canvas?.getBoundingClientRect()
      return auditFrames(rect?.width ?? window.innerWidth, rect?.height ?? window.innerHeight)
    }
    window.addEventListener('resize', queue)
    window.addEventListener(FRAME_CHROME_EVENT, queue)
    queue()

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', queue)
      window.removeEventListener(FRAME_CHROME_EVENT, queue)
      delete window.__FRAME_AUDIT__
    }
  }, [])

  return <div ref={outlineRef} className="frame-qa-outline" aria-hidden="true" />
}

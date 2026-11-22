import { lazy, Suspense, useEffect, useRef } from 'react'
import { playSfx } from './lib/sfx'
import { useRoom } from './state/roomStore'
import { useFrameChromePublisher } from './lib/frameChrome'
import { look } from './three/overviewLook'
import AiDock from './ui/AiDock'
import FlowerCardOverlay from './ui/FlowerCardOverlay'
import Header from './ui/Header'
import SceneErrorBoundary from './ui/SceneErrorBoundary'
import SectionMenu from './ui/SectionMenu'
import StationCloseButton from './ui/StationCloseButton'
import TimelineCardOverlay from './ui/TimelineCardOverlay'
import TvBackButton from './ui/TvBackButton'
import TvCloseControls from './ui/TvCloseControls'
import LetterOverlay from './ui/LetterOverlay'

// Keep three.js and the whole 3D station bundle out of the first paint. The
// room shell paints while this chunk streams in.
const RoomScene = lazy(() => import('./three/RoomScene'))

export default function App() {
  const {
    active,
    activeId,
    canvasFailed,
    canvasKey,
    cinema,
    closeStation,
    handleCanvasError,
    retryCanvas,
    setCinema,
  } = useRoom()
  const lastActive = useRef<string | null>(null)
  useFrameChromePublisher()

  useEffect(() => {
    const previous = lastActive.current
    lastActive.current = activeId
    if (!activeId) return
    if (previous !== activeId) playSfx('ui-open')
  }, [activeId])

  // Keyboard and TV-remote traversal. Escape closes an open station; arrows
  // move DOM focus through the visible controls. The renderer owns arrow-look
  // while its look mode is active, so the two never fight.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A sheet or overlay that already handled Escape must not also close the
      // station underneath it.
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }
      const modal = document.querySelector('[aria-modal="true"]')
      if (event.key === 'Escape') {
        if (modal) return
        if (cinema) {
          event.preventDefault()
          setCinema(false)
          return
        }
        if (active) {
          event.preventDefault()
          closeStation()
        }
        return
      }
      if (modal || look.keyboardMode) return
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
      const current = document.activeElement as HTMLElement | null
      if (!current || current === document.body) return
      const items = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          !element.closest('[aria-hidden="true"]'),
      )
      const index = items.indexOf(current)
      if (index === -1) return
      const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
      const next = items[(index + direction + items.length) % items.length]
      if (next) {
        event.preventDefault()
        next.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, cinema, closeStation, setCinema])

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to the room
      </a>

      <Header />

      <main id="main" className="app-main" tabIndex={-1}>
        <div className="scene" key={canvasKey}>
          <SceneErrorBoundary onError={handleCanvasError}>
            <Suspense
              fallback={
                <div className="scene-loading" role="status">
                  Opening the room…
                </div>
              }
            >
              <RoomScene />
            </Suspense>
          </SceneErrorBoundary>

          {canvasFailed ? (
            <div className="scene-error" role="alert">
              <p className="eyebrow">The 3D room needs WebGL</p>
              <h1>This browser could not start the room.</h1>
              <p>
                Try again, allow hardware acceleration in the browser settings, or open this
                page in a different browser.
              </p>
              <button type="button" className="button button--primary" onClick={retryCanvas}>
                Try the room again
              </button>
            </div>
          ) : null}
        </div>
      </main>

      <StationCloseButton />
      <TvBackButton />
      <TvCloseControls />
      <TimelineCardOverlay />
      <SectionMenu />
      <FlowerCardOverlay />
      <LetterOverlay />
      <AiDock />
    </div>
  )
}

import { playSfx } from '../lib/sfx'
import { useRoom } from '../state/roomStore'

function send(action: 'prev' | 'next' | 'toggle') {
  playSfx('ui-click')
  window.dispatchEvent(new CustomEvent('room-tv-control', { detail: action }))
}

/** The close view crops the console, so these keep the same playback actions
 *  reachable without shrinking the TV or faking a browser fullscreen. */
export default function TvCloseControls() {
  const { activeId, cinema } = useRoom()
  if (activeId !== 'tv' || !cinema) return null

  return (
    <div className="tv-close-controls" role="group" aria-label="Television playback">
      <button type="button" aria-label="Previous channel" onClick={() => send('prev')}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
          <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      <button type="button" aria-label="Play or pause" onClick={() => send('toggle')}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
          <path d="M8 5l11 7-11 7z" fill="currentColor" />
          <path d="M6 5v14" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      <button type="button" aria-label="Next channel" onClick={() => send('next')}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
    </div>
  )
}

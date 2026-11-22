import { useState } from 'react'
import { isMuted, playSfx, setMuted } from '../lib/sfx'
import { useRoom } from '../state/roomStore'

export default function Header() {
  const [muted, setMutedState] = useState(() => isMuted())
  const { closeStation, menuOpen, setMenuOpen } = useRoom()

  const goHome = () => {
    playSfx('ui-click')
    closeStation()
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <button type="button" className="wordmark" onClick={goHome}>
          3D Room
        </button>

        <div className="header-tools">
          <button
            type="button"
            className={`header-button mute-button ${muted ? 'is-active' : ''}`}
            aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
            aria-pressed={muted}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
            onClick={() => {
              const next = !muted
              setMuted(next)
              setMutedState(next)
              if (!next) playSfx('ui-click')
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4 9.5h3.4L12 5.7v12.6l-4.6-3.8H4z" />
              {muted ? (
                <path d="M16 9.2l4.8 5.6M20.8 9.2L16 14.8" />
              ) : (
                <path d="M15.4 9.1a4.2 4.2 0 010 5.8M18 6.7a7.7 7.7 0 010 10.6" />
              )}
            </svg>
          </button>

          <button
            type="button"
            className={`header-button menu-button ${menuOpen ? 'is-active' : ''}`}
            aria-label="Explore all places"
            aria-expanded={menuOpen}
            aria-controls="section-menu"
            onClick={() => {
              playSfx('ui-click')
              setMenuOpen(!menuOpen)
            }}
          >
            <span className="hamburger" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="menu-button__label">Explore</span>
          </button>
        </div>
      </div>
    </header>
  )
}

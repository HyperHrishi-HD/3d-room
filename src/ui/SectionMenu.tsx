import { useEffect, useRef } from 'react'
import { SECTIONS, stationsInSection } from '../data/stations'
import { playSfx } from '../lib/sfx'
import { useProgress } from '../lib/progress'
import { useRoom } from '../state/roomStore'

export default function SectionMenu() {
  const { activeId, menuOpen, selectStation, setMenuOpen } = useRoom()
  const { visited } = useProgress()
  const seen = new Set(visited)
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusable = panel?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenuOpen(false)
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((item) => !item.hasAttribute('disabled'))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      if (restoreRef.current && document.contains(restoreRef.current)) {
        restoreRef.current.focus()
      }
    }
  }, [menuOpen, setMenuOpen])

  if (!menuOpen) return null

  return (
    <div className="menu-layer">
      <button
        type="button"
        className="menu-backdrop"
        aria-label="Close Explore"
        onClick={() => setMenuOpen(false)}
      />
      <div
        id="section-menu"
        className="section-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="section-menu-title"
        ref={panelRef}
      >
        <div className="section-menu__head">
          <div>
            <p className="eyebrow">The whole room</p>
            <h2 id="section-menu-title">Explore</h2>
          </div>
          <button
            type="button"
            className="round-button"
            onClick={() => {
              playSfx('ui-click')
              setMenuOpen(false)
            }}
            aria-label="Close Explore"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="section-menu__scroll">
          {SECTIONS.map((section) => (
            <section className="menu-section" key={section.id}>
              <div className="menu-section__head">
                <h3>{section.title}</h3>
                <p>{section.note}</p>
              </div>
              <ul>
                {stationsInSection(section.id).map((station) => {
                  const isCurrent = activeId === station.id
                  return (
                    <li key={station.id}>
                      <button
                        type="button"
                        className={`menu-item ${isCurrent ? 'is-current' : ''}`}
                        aria-current={isCurrent ? 'true' : undefined}
                        onClick={() => {
                          playSfx('ui-click')
                          selectStation(station.id, 'menu')
                        }}
                      >
                        <span className="menu-item__number">
                          {String(station.n).padStart(2, '0')}
                        </span>
                        <span className="menu-item__text">
                          <strong>{station.title}</strong>
                          <span>{station.subtitle}</span>
                        </span>
                        <span
                          className={`menu-item__dot ${seen.has(station.n) ? 'is-visited' : ''}`}
                          aria-label={seen.has(station.n) ? 'Visited' : 'Not yet visited'}
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>

        <p className="section-menu__foot">
          Every place here opens in the room itself. All copy is a placeholder you can replace.
        </p>
      </div>
    </div>
  )
}

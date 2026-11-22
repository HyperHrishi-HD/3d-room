import { useEffect, useState } from 'react'
import { timelineNotes } from '../data/content'
import { playSfx } from '../lib/sfx'
import { useRoom } from '../state/roomStore'

/**
 * On a phone the whole pinboard cannot be both fully visible and legible. This
 * sheet keeps the selected note at reading size while the 3D board stays open
 * behind it; "Show the wall" returns to the board, and tapping another pin
 * opens the sheet again. Desktop keeps the board-only presentation.
 */
export default function TimelineCardOverlay() {
  const { activeId } = useRoom()
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (activeId !== 'timeline') {
      setOpen(false)
      return
    }
    setOpen(true)
  }, [activeId])

  useEffect(() => {
    const show = (event: Event) => {
      const next = (event as CustomEvent<{ index?: number }>).detail?.index
      if (typeof next !== 'number') return
      setIndex(Math.max(0, Math.min(timelineNotes.length - 1, next)))
      setOpen(true)
    }
    window.addEventListener('room-timeline-card', show)
    return () => window.removeEventListener('room-timeline-card', show)
  }, [])

  if (activeId !== 'timeline' || !open) return null
  const note = timelineNotes[index]
  if (!note) return null

  const step = (direction: 1 | -1) => {
    playSfx('timeline-tick')
    window.dispatchEvent(
      new CustomEvent('room-timeline-step', { detail: { direction } }),
    )
  }

  return (
    <div className="timelinecard" role="dialog" aria-modal="false" aria-label="A note from the wall">
      <div className="timelinecard__panel">
        <button
          type="button"
          className="timelinecard__close"
          aria-label="Show the timeline wall"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
        <p className="timelinecard__eyebrow">A note from the wall</p>
        <h2>{note.title}</h2>
        {note.year ? <p className="timelinecard__year">{note.year}</p> : null}
        <p className="timelinecard__body">{note.body}</p>
        <div className="timelinecard__controls">
          <button type="button" onClick={() => step(-1)} aria-label="Previous pinned note">
            ← Previous
          </button>
          <span>
            {index + 1} of {timelineNotes.length}
          </span>
          <button type="button" onClick={() => step(1)} aria-label="Next pinned note">
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

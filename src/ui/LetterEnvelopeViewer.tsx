import { useEffect, useState } from 'react'
import { useLetters } from '../lib/letters'
import { playSfx } from '../lib/sfx'

/**
 * The readable side of the letters sheet. The three placeholder letters from
 * data/content.ts lead; any letter written in this browser follows them and is
 * marked as saved here.
 */
export default function LetterEnvelopeViewer({
  onClose,
  focusId,
}: {
  onClose?: () => void
  focusId?: string | null
}) {
  const { letters } = useLetters()
  // Reopening the sheet shows the newest letter written here; a clean profile
  // still starts at the first placeholder.
  const [index, setIndex] = useState(() => {
    for (let cursor = letters.length - 1; cursor >= 0; cursor -= 1) {
      if (letters[cursor].savedAt) return cursor
    }
    return 0
  })
  // The letter is always presented open; Next replaces it with the next one.
  const stage = 'open'

  useEffect(() => {
    if (!letters.length) {
      setIndex(0)
      return
    }
    setIndex((current) => Math.min(current, letters.length - 1))
  }, [letters.length])

  useEffect(() => {
    if (!focusId) return
    const found = letters.findIndex((entry) => entry.id === focusId)
    if (found >= 0) setIndex(found)
  }, [focusId, letters])

  if (!letters.length) return null
  const card = letters[Math.min(index, letters.length - 1)]
  const many = letters.length > 1

  const move = (direction: 1 | -1) => {
    playSfx('ui-click')
    setIndex((current) => (current + direction + letters.length) % letters.length)
  }

  return (
    <section
      className="envelope-viewer"
      aria-label="Letters"
      data-envelope-stage={stage}
      data-envelope-index={index}
      data-envelope-name={card.name}
      data-envelope-total={letters.length}
      data-envelope-saved={card.savedAt ? 'true' : 'false'}
    >
      <header className="envelope-viewer__head">
        <div>
          <p className="envelope-viewer__eyebrow">The television</p>
          <h2>Letters</h2>
        </div>
        {onClose ? (
          <button
            type="button"
            className="envelope-viewer__close"
            onClick={() => {
              playSfx('ui-click')
              onClose?.()
            }}
            aria-label="Close the letters"
          >
            ×
          </button>
        ) : null}
      </header>

      <div className="envelope-stack" aria-live="polite">
        <span className="envelope-stack__ghost envelope-stack__ghost--one" aria-hidden="true" />
        <span className="envelope-stack__ghost envelope-stack__ghost--two" aria-hidden="true" />
        <div className={`envelope-card is-${stage}`}>
          <div className="envelope-card__letter">
            <p className="envelope-card__from">From {card.name}</p>
            <p className="envelope-card__message">{card.message}</p>
            {card.savedAt ? (
              <p
                style={{
                  margin: '14px 0 0',
                  color: 'rgba(139,106,60,0.8)',
                  font: '600 10px/1.3 Georgia, serif',
                  letterSpacing: '1.4px',
                  textTransform: 'uppercase',
                }}
              >
                Saved in this browser
              </p>
            ) : null}
          </div>
          <div className="envelope-card__back" aria-hidden="true" />
          <div className="envelope-card__front" aria-hidden="true" />
          <span className="envelope-card__label" aria-hidden="true">
            A note
          </span>
          <i className="envelope-card__seal" aria-hidden="true" />
          <div className="envelope-card__flap" aria-hidden="true" />
        </div>
      </div>

      <div className="envelope-viewer__controls">
        <button
          type="button"
          className="envelope-viewer__prev"
          onClick={() => move(-1)}
          disabled={!many}
          aria-label="Previous letter"
        >
          Previous
        </button>
        <button
          type="button"
          className="envelope-viewer__next"
          onClick={() => move(1)}
          disabled={!many}
          aria-label="Next letter"
        >
          Next
        </button>
      </div>
      <p className="envelope-viewer__count">
        {index + 1} of {letters.length}
      </p>
    </section>
  )
}

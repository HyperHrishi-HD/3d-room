import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { addLetter } from '../lib/letters'
import { playSfx } from '../lib/sfx'
import LetterEnvelopeViewer from './LetterEnvelopeViewer'

export function LetterComposer({
  onClose,
  onSent,
}: {
  onClose?: () => void
  onSent?: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    },
    [],
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !message.trim()) return

    const { letter, persisted } = addLetter(name, message)
    if (!letter) {
      setNotice('Write a name and a few words first.')
      return
    }

    playSfx('letter-send')
    // The send click is still inside the shared 120 ms gap when the letter is
    // stored instantly. Give the confirmation its own little beat.
    window.setTimeout(() => playSfx('success-soft'), 160)
    setName('')
    setMessage('')
    onSent?.(letter.id)
    setNotice(
      persisted
        ? 'Saved. Your letter is on the counter and in the letters sheet.'
        : 'Added for this visit only — this browser blocked local storage.',
    )
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 7000)
  }

  const field = {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '10px 11px',
    marginBottom: 9,
    border: '1px solid #C9A24B',
    borderRadius: 5,
    background: '#F5EFE2',
    color: '#2A2118',
    font: '15px Georgia, serif',
  }

  return (
    <form
      onSubmit={submit}
      style={{
        width: '100%',
        maxWidth: 340,
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: 18,
        background: '#F4EDDD',
        border: '2px solid #C9A24B',
        borderRadius: 8,
        boxShadow: '0 10px 30px rgba(0,0,0,.35)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <strong style={{ font: '600 20px Georgia, serif', color: '#5A3A1C' }}>Leave a letter</strong>
        {onClose ? (
          <button
            type="button"
            onClick={() => {
              playSfx('ui-click')
              onClose()
            }}
            aria-label="Close the letter composer"
            style={{ border: 0, background: 'transparent', fontSize: 24, cursor: 'pointer', color: '#5A4330' }}
          >
            ×
          </button>
        ) : null}
      </div>
      <p style={{ margin: '4px 0 10px', font: '13px Georgia, serif', color: '#6B5948' }}>
        Letters stay in this browser. Nothing is sent anywhere.
      </p>
      <input
        aria-label="Your name"
        placeholder="Your name"
        value={name}
        maxLength={60}
        onChange={(event) => setName(event.target.value)}
        style={field}
      />
      <textarea
        aria-label="Your letter"
        placeholder="Write a few lines"
        value={message}
        maxLength={500}
        rows={5}
        onChange={(event) => setMessage(event.target.value)}
        style={{ ...field, resize: 'vertical' }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          margin: '0 0 9px',
          color: '#8B6A3C',
          font: '11px/1.3 Georgia, serif',
        }}
      >
        <span>Saved on this device</span>
        <span>{message.length}/500</span>
      </div>
      <button
        type="submit"
        disabled={!name.trim() || !message.trim()}
        style={{
          width: '100%',
          padding: '11px 12px',
          border: 0,
          borderRadius: 5,
          background: '#7B4A2E',
          color: '#F5EFE2',
          font: '600 15px Georgia, serif',
          cursor: 'pointer',
          opacity: name.trim() && message.trim() ? 1 : 0.55,
        }}
      >
        Add the letter
      </button>
      <p
        role="status"
        aria-live="polite"
        style={{
          minHeight: 18,
          margin: '9px 0 0',
          color: '#5A4330',
          font: '12px/1.4 Georgia, serif',
        }}
      >
        {notice}
      </p>
    </form>
  )
}

const LETTERS_HASH = '#/station/tv/letters'
const STATION_HASH = '#/station/tv'
const isLettersHash = (hash: string) => hash.replace(/\/+$/, '') === LETTERS_HASH

/**
 * The letter card on the television opens this same overlay from the station
 * and from anywhere in the room. Its URL is the station URL with /letters
 * appended, so the link lands back on the TV with the letters open instead of
 * mounting a page.
 */
export default function LetterOverlay() {
  const [open, setOpen] = useState(() => isLettersHash(window.location.hash))
  const [focusId, setFocusId] = useState<string | null>(null)
  const openRef = useRef(open)
  const returnHash = useRef<string | null>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    openRef.current = open
  }, [open])

  const closeOverlay = useCallback(() => {
    setOpen(false)
    if (isLettersHash(window.location.hash)) {
      const back =
        returnHash.current && !isLettersHash(returnHash.current)
          ? returnHash.current
          : STATION_HASH
      window.history.replaceState(null, '', back)
    }
    returnHash.current = null
  }, [])

  const openOverlay = useCallback(() => {
    if (!openRef.current) {
      const from = window.location.hash
      returnHash.current = from && !isLettersHash(from) ? from : null
      if (!isLettersHash(from)) window.history.pushState(null, '', LETTERS_HASH)
    }
    setOpen(true)
  }, [])

  useEffect(() => {
    const onOpen = () => openOverlay()
    window.addEventListener('room-open-letter', onOpen)
    window.addEventListener('room-open-letters', onOpen)
    return () => {
      window.removeEventListener('room-open-letter', onOpen)
      window.removeEventListener('room-open-letters', onOpen)
    }
  }, [openOverlay])

  useEffect(() => {
    const syncFromUrl = () => {
      const shouldOpen = isLettersHash(window.location.hash)
      setOpen(shouldOpen)
      if (!shouldOpen) returnHash.current = null
    }
    window.addEventListener('popstate', syncFromUrl)
    window.addEventListener('hashchange', syncFromUrl)
    return () => {
      window.removeEventListener('popstate', syncFromUrl)
      window.removeEventListener('hashchange', syncFromUrl)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const layer = layerRef.current
    // Move focus to the dialog itself, not the first field, so a phone does not
    // open its keyboard the moment the sheet appears.
    layer?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeOverlay()
        return
      }
      if (event.key !== 'Tab' || !layer) return
      const items = Array.from(
        layer.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, textarea, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((item) => item.getClientRects().length > 0)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const inLayer = layer.contains(document.activeElement)
      if (
        event.shiftKey &&
        (!inLayer || document.activeElement === first || document.activeElement === layer)
      ) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previous && document.contains(previous)) previous.focus()
    }
  }, [closeOverlay, open])

  if (!open) return null
  return (
    <div
      className="letter-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Leave a letter"
      ref={layerRef}
      tabIndex={-1}
    >
      <div className="letter-stage">
        <LetterComposer onClose={closeOverlay} onSent={setFocusId} />
        <LetterEnvelopeViewer onClose={closeOverlay} focusId={focusId} />
      </div>
    </div>
  )
}

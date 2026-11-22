import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRoom } from '../state/roomStore'

export default function AiDock() {
  const { activeId, askMonitor } = useRoom()
  const [value, setValue] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const open = activeId === 'ai'

  useEffect(() => {
    if (!open) setValue('')
  }, [open])

  if (!open) return null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const clean = value.trim()
    if (!clean) return
    askMonitor(clean)
    setValue('')
    input.current?.focus()
  }

  return (
    <form className="ai-dock" onSubmit={submit}>
      <label className="ai-dock__label" htmlFor="ai-question">
        Ask the room
      </label>
      <div className="ai-dock__row">
        <input
          ref={input}
          id="ai-question"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Type a question for the monitor"
          autoComplete="off"
          maxLength={240}
        />
        <button type="submit" className="button button--gold" disabled={!value.trim()}>
          Ask
        </button>
      </div>
    </form>
  )
}

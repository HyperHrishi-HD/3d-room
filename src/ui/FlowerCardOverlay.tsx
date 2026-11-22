import { useEffect, useState } from 'react'
import { flowerCards } from '../data/content'
import { useRoom } from '../state/roomStore'

type FlowerDetail = { index: number }

/**
 * The flowers are tiny objects in the room. This keeps the selected message
 * and photograph at a readable size instead of relying on a very close 3D
 * plane that can disappear behind the camera or the vase.
 */
export default function FlowerCardOverlay() {
  const { activeId } = useRoom()
  const [index, setIndex] = useState<number | null>(null)

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<FlowerDetail>).detail
      if (typeof detail?.index === 'number') setIndex(detail.index)
    }
    const close = () => setIndex(null)
    window.addEventListener('room-flower-card', open)
    window.addEventListener('room-flower-card-close', close)
    return () => {
      window.removeEventListener('room-flower-card', open)
      window.removeEventListener('room-flower-card-close', close)
    }
  }, [])

  useEffect(() => {
    if (activeId !== 'flowers') setIndex(null)
  }, [activeId])

  if (activeId !== 'flowers' || index === null) return null
  const flower = flowerCards[index % flowerCards.length]
  const step = (direction: 1 | -1) =>
    window.dispatchEvent(
      new CustomEvent('room-flower-step', { detail: { direction } }),
    )

  return (
    <div className="flowercard" role="dialog" aria-modal="true" aria-label="A reason from the flowers">
      <div className="flowercard__panel">
        <button
          type="button"
          className="flowercard__close"
          aria-label="Close the flower card"
          onClick={() => window.dispatchEvent(new CustomEvent('room-flower-card-close'))}
        >
          ×
        </button>
        <p className="flowercard__eyebrow">A reason from the vase</p>
        <h2>A placeholder card</h2>
        <p className="flowercard__text">{flower.text}</p>
        <div className="flowercard__controls">
          <button type="button" onClick={() => step(-1)} aria-label="Previous flower">
            ← Previous
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next flower">
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

import { playSfx } from '../lib/sfx'
import { useRoom } from '../state/roomStore'

/** The only way out of the TV close view besides Esc. It is DOM chrome so it
 *  cannot be clipped by the 3D frame on a narrow phone. */
export default function TvBackButton() {
  const { activeId, cinema, setCinema } = useRoom()
  if (activeId !== 'tv' || !cinema) return null

  return (
    <button
      type="button"
      className="tv-back-button"
      aria-label="Back to the TV station"
      onClick={() => {
        playSfx('ui-click')
        setCinema(false)
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
        <path d="M14 6l-6 6 6 6M8 12h11" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <span>Back</span>
    </button>
  )
}

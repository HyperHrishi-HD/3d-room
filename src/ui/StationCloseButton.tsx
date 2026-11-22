import { playSfx } from '../lib/sfx'
import { useRoom } from '../state/roomStore'

/**
 * The one close control for every open station. It is a real DOM button, so it
 * stays inside the visible viewport on phones (including notches), keeps a
 * 48 px target, and is reachable by keyboard and TV remotes. The scene discs
 * remain for previous/next and object-specific actions.
 */
export default function StationCloseButton() {
  const { active, closeStation, menuOpen } = useRoom()
  if (!active || menuOpen) return null

  return (
    <button
      type="button"
      className="station-close"
      aria-label={`Close ${active.title} and return to the room`}
      onClick={() => {
        playSfx('ui-click')
        closeStation()
      }}
    >
      <span aria-hidden="true">×</span>
    </button>
  )
}

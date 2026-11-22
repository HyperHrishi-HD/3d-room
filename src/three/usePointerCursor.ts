import { useEffect, useState } from 'react'

/** A small shared cursor hint for clickable 3D groups. */
export function usePointerCursor() {
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (hovered) document.body.style.cursor = 'pointer'
    else document.body.style.cursor = ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered])

  return {
    onPointerOver: () => setHovered(true),
    onPointerOut: () => setHovered(false),
  }
}

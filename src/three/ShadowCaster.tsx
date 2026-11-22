import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

/**
 * Opts a small, hero-sized subtree into the room's soft shadow pass without
 * turning on shadow casting for every tiny prop in the room.
 */
export default function ShadowCaster({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null)

  useEffect(() => {
    root.current?.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) object.castShadow = true
    })
  }, [])

  return <group ref={root}>{children}</group>
}

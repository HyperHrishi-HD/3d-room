import { useMemo } from 'react'
import * as THREE from 'three'
import { COLORS } from '../palette'
import { mergeParts } from '../merge'
import { usePointerCursor } from '../usePointerCursor'
import { useRoomTap } from '../useRoomTap'

type Props = { onSelect: () => void }

export default function Pinboard({ onSelect }: Props) {
  const cursor = usePointerCursor()
  const board = useMemo(
    () =>
      mergeParts([
        {
          geometry: new THREE.BoxGeometry(2.7, 1.5, 0.08),
          position: [0, 0, 0],
        },
      ]),
    [],
  )
  const frame = useMemo(
    () =>
      mergeParts([
        {
          geometry: new THREE.BoxGeometry(2.8, 0.06, 0.06),
          position: [0, 0.76, 0.01],
        },
        {
          geometry: new THREE.BoxGeometry(2.8, 0.06, 0.06),
          position: [0, -0.76, 0.01],
        },
        {
          geometry: new THREE.BoxGeometry(0.06, 1.58, 0.06),
          position: [-1.37, 0, 0.01],
        },
        {
          geometry: new THREE.BoxGeometry(0.06, 1.58, 0.06),
          position: [1.37, 0, 0.01],
        },
      ]),
    [],
  )
  const tap = useRoomTap(() => onSelect())

  return (
    <group position={[3.55, 1.85, -4.28]} {...tap} {...cursor}>
      <mesh geometry={board}>
        <meshStandardMaterial color="#896947" roughness={0.96} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[2.6, 1.4]} />
        <meshStandardMaterial color="#B08B62" roughness={0.98} />
      </mesh>
      <mesh geometry={frame}>
        <meshStandardMaterial color={COLORS.gold} roughness={0.44} metalness={0.36} />
      </mesh>
    </group>
  )
}

import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeParts } from '../merge'
import { usePointerCursor } from '../usePointerCursor'
import { useRoomTap } from '../useRoomTap'

type Props = { onSelect: (id: string) => void }

export default function Table({ onSelect }: Props) {
  const cursor = usePointerCursor()
  const top = useMemo(
    () =>
      mergeParts([
        {
          geometry: new THREE.BoxGeometry(1.3, 0.1, 2.5),
          position: [5.15, 0.78, -2.75],
        },
      ]),
    [],
  )
  const apron = useMemo(
    () =>
      mergeParts([
        {
          geometry: new THREE.BoxGeometry(1.22, 0.035, 2.42),
          position: [5.15, 0.73, -2.75],
        },
      ]),
    [],
  )
  const legs = useMemo(
    () =>
      mergeParts(
        [
          [4.62, -3.82],
          [5.68, -3.82],
          [4.62, -1.68],
          [5.68, -1.68],
        ].map(([x, z]) => ({
          geometry: new THREE.CylinderGeometry(0.035, 0.045, 0.73, 10),
          position: [x, 0.365, z] as [number, number, number],
        })),
      ),
    [],
  )

  const tap = useRoomTap(() => onSelect('letter'))

  return (
    <group {...tap} {...cursor}>
      <mesh geometry={top}>
        <meshStandardMaterial color="#5A3E26" roughness={0.82} />
      </mesh>
      <mesh geometry={apron}>
        <meshStandardMaterial color="#4A3321" roughness={0.86} />
      </mesh>
      <mesh geometry={legs}>
        <meshStandardMaterial color="#3D2B1C" roughness={0.86} />
      </mesh>
    </group>
  )
}

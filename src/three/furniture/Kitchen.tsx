import { useMemo } from 'react'
import * as THREE from 'three'
import { COLORS } from '../palette'
import { mergeParts, type MergePart } from '../merge'
import { usePointerCursor } from '../usePointerCursor'
import { useRoomTap } from '../useRoomTap'

type Props = { onSelect: (id: string) => void }

const CABINETS = [1.0, 1.95, 2.9]

const body: MergePart[] = [
  { geometry: new THREE.BoxGeometry(0.8, 1.0, 3.3), position: [-5.55, 0.5, 1.95] },
]
const counter: MergePart[] = [
  { geometry: new THREE.BoxGeometry(0.88, 0.07, 3.38), position: [-5.55, 1.02, 1.95] },
]
const doors: MergePart[] = []
const upper: MergePart[] = []
const upperFaces: MergePart[] = []
const knobs: MergePart[] = []

for (const z of [0.85, 1.95, 3.05]) {
  doors.push({
    geometry: new THREE.BoxGeometry(0.025, 0.62, 0.94),
    position: [-5.135, 0.56, z],
  })
}
for (const z of CABINETS) {
  upper.push({
    geometry: new THREE.BoxGeometry(0.45, 0.95, 0.92),
    position: [-5.78, 2.35, z],
  })
  upperFaces.push({
    geometry: new THREE.BoxGeometry(0.018, 0.81, 0.78),
    position: [-5.545, 2.35, z],
  })
}
for (const z of [0.85, 1.95, 3.05]) {
  knobs.push({ geometry: new THREE.SphereGeometry(0.022, 12, 10), position: [-5.115, 0.6, z + 0.34] })
}
for (const z of CABINETS) {
  knobs.push({ geometry: new THREE.SphereGeometry(0.02, 12, 10), position: [-5.53, 2.2, z + 0.29] })
}

export default function Kitchen({ onSelect }: Props) {
  const cursor = usePointerCursor()
  const bodyGeometry = useMemo(() => mergeParts(body), [])
  const counterGeometry = useMemo(() => mergeParts(counter), [])
  const doorGeometry = useMemo(() => mergeParts(doors), [])
  const upperGeometry = useMemo(() => mergeParts(upper), [])
  const upperFaceGeometry = useMemo(() => mergeParts(upperFaces), [])
  const knobGeometry = useMemo(() => mergeParts(knobs), [])

  const tap = useRoomTap(() => onSelect('kitchen'))

  return (
    <group {...tap} {...cursor}>
      <mesh geometry={bodyGeometry}>
        <meshStandardMaterial color="#3E2B1D" roughness={0.88} />
      </mesh>
      <mesh geometry={counterGeometry}>
        <meshStandardMaterial color="#BEB09B" roughness={0.8} />
      </mesh>
      <mesh geometry={doorGeometry}>
        <meshStandardMaterial color="#4A3525" roughness={0.9} />
      </mesh>
      <mesh geometry={upperGeometry}>
        <meshStandardMaterial color="#352519" roughness={0.88} />
      </mesh>
      <mesh geometry={upperFaceGeometry}>
        <meshStandardMaterial color="#3F2C1F" roughness={0.9} />
      </mesh>
      <mesh geometry={knobGeometry}>
        <meshStandardMaterial color={COLORS.gold} roughness={0.4} metalness={0.42} />
      </mesh>
    </group>
  )
}

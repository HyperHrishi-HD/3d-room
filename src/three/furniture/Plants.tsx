import { useMemo } from 'react'
import * as THREE from 'three'
import { COLORS } from '../palette'
import { mergeParts, type MergePart } from '../merge'

const PLANTS = [
  { x: -5.6, z: 3.2, rot: 0.3 },
  { x: 5.6, z: 3.2, rot: -0.2 },
]

const pots: MergePart[] = []
const soil: MergePart[] = []
const leaves: MergePart[] = []

for (const plant of PLANTS) {
  const cos = Math.cos(plant.rot)
  const sin = Math.sin(plant.rot)
  const at = (x: number, y: number, z: number): [number, number, number] => [
    plant.x + x * cos + z * sin,
    y,
    plant.z - x * sin + z * cos,
  ]
  pots.push({
    geometry: new THREE.CylinderGeometry(0.22, 0.18, 0.36, 16),
    position: at(0, 0.18, 0),
    rotation: [0, plant.rot, 0],
  })
  soil.push({
    geometry: new THREE.CylinderGeometry(0.19, 0.19, 0.025, 16),
    position: at(0, 0.37, 0),
    rotation: [0, plant.rot, 0],
  })
  ;[0.2, 1.1, 2.2, 3.4, 4.5].forEach((rotation, index) => {
    leaves.push({
      geometry: new THREE.ConeGeometry(0.085, 0.55, 5),
      position: at(
        Math.cos(rotation) * 0.09,
        0.56 + (index % 3) * 0.025,
        Math.sin(rotation) * 0.09,
      ),
      rotation: [
        Math.sin(rotation) * 0.48,
        plant.rot,
        Math.cos(rotation) * 0.48,
      ],
      scale: [0.82 + (index % 3) * 0.08, 0.82 + (index % 3) * 0.08, 0.82 + (index % 3) * 0.08],
    })
  })
}

export default function Plants() {
  const potGeometry = useMemo(() => mergeParts(pots), [])
  const soilGeometry = useMemo(() => mergeParts(soil), [])
  const leafGeometry = useMemo(() => mergeParts(leaves), [])
  return (
    <group>
      <mesh geometry={potGeometry}>
        <meshStandardMaterial color="#8B5B3F" roughness={0.9} />
      </mesh>
      <mesh geometry={soilGeometry}>
        <meshStandardMaterial color="#3A2B1D" roughness={0.98} />
      </mesh>
      <mesh geometry={leafGeometry}>
        <meshStandardMaterial color={COLORS.leaf} roughness={0.9} />
      </mesh>
    </group>
  )
}

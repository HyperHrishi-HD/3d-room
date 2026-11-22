import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { COLORS } from '../palette'

export default function LampClock({ boosted }: { boosted: boolean }) {
  const light = useRef<THREE.PointLight>(null)

  useFrame((_, delta) => {
    if (!light.current) return
    light.current.intensity = THREE.MathUtils.damp(
      light.current.intensity,
      boosted ? 38 : 30,
      2.2,
      Math.min(delta, 0.05),
    )
  })

  return (
    <group>
      <mesh position={[0, 3.0, -0.6]}>
        <cylinderGeometry args={[0.008, 0.008, 0.8, 8]} />
        <meshStandardMaterial color="#231A12" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.61, -0.6]}>
        <cylinderGeometry args={[0.075, 0.3, 0.27, 26, 1, true]} />
        <meshStandardMaterial
          color={COLORS.gold}
          roughness={0.46}
          metalness={0.35}
          side={THREE.FrontSide}
        />
      </mesh>
      <mesh position={[0, 2.61, -0.6]} scale={[0.95, 0.98, 0.95]}>
        <cylinderGeometry args={[0.07, 0.285, 0.26, 26, 1, true]} />
        <meshStandardMaterial
          color="#FFD28C"
          emissive={COLORS.lamp}
          emissiveIntensity={0.22}
          roughness={0.8}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh position={[0, 2.52, -0.6]}>
        <sphereGeometry args={[0.055, 14, 10]} />
        <meshBasicMaterial color="#FFC873" toneMapped={false} />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 2.25, -0.6]}
        color={COLORS.lamp}
        intensity={30}
        distance={12}
        decay={2}
      />

      <group position={[-1.8, 2.72, -4.37]} rotation-x={0}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.27, 0.27, 0.04, 30]} />
          <meshStandardMaterial color={COLORS.gold} roughness={0.44} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.026]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.23, 0.23, 0.02, 30]} />
          <meshStandardMaterial color={COLORS.paper} roughness={0.84} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <circleGeometry args={[0.011, 12]} />
          <meshBasicMaterial color={COLORS.ink} />
        </mesh>
        <group position={[0, 0, 0.044]} rotation-z={2.62}>
          <mesh position={[0, 0.055, 0]}>
            <boxGeometry args={[0.012, 0.11, 0.006]} />
            <meshBasicMaterial color={COLORS.ink} />
          </mesh>
        </group>
        <group position={[0, 0, 0.045]}>
          <mesh position={[0, 0.07, 0]}>
            <boxGeometry args={[0.009, 0.14, 0.005]} />
            <meshBasicMaterial color={COLORS.ink} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

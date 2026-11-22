import { COLORS } from '../palette'
import { usePointerCursor } from '../usePointerCursor'
import { useRoomTap } from '../useRoomTap'

type Props = { onSelect: (id: string) => void }

export default function Bookshelf({ onSelect }: Props) {
  const cursor = usePointerCursor()
  const tap = useRoomTap(() => onSelect('album-one'))

  return (
    <group {...tap} {...cursor}>
      <mesh position={[5.8, 1.1, -2.7]}>
        <boxGeometry args={[0.36, 2.2, 2.3]} />
        <meshStandardMaterial color="#3D2A1C" roughness={0.88} />
      </mesh>
      <mesh position={[5.6, 1.1, -2.7]}>
        <boxGeometry args={[0.035, 2.08, 2.16]} />
        <meshStandardMaterial color="#4A3322" roughness={0.9} />
      </mesh>
      {[0.45, 1.1, 1.75].map((y) => (
        <mesh key={y} position={[5.6, y, -2.7]}>
          <boxGeometry args={[0.4, 0.05, 2.24]} />
          <meshStandardMaterial color="#5B4129" roughness={0.84} />
        </mesh>
      ))}
      <mesh position={[5.6, 0.16, -2.7]}>
        <boxGeometry args={[0.4, 0.08, 2.24]} />
        <meshStandardMaterial color="#5B4129" roughness={0.84} />
      </mesh>
      <mesh position={[5.6, 2.17, -2.7]}>
        <boxGeometry args={[0.4, 0.06, 2.3]} />
        <meshStandardMaterial color="#5B4129" roughness={0.84} />
      </mesh>
      <mesh position={[5.6, 2.16, -2.7]}>
        <boxGeometry args={[0.02, 0.012, 2.16]} />
        <meshStandardMaterial color={COLORS.gold} roughness={0.42} metalness={0.4} />
      </mesh>

      <group position={[5.54, 1.78, -3.55]}>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.09, 0.075, 0.12, 14]} />
          <meshStandardMaterial color="#8B5B3F" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <coneGeometry args={[0.13, 0.25, 6]} />
          <meshStandardMaterial color={COLORS.leaf} roughness={0.9} />
        </mesh>
      </group>
      <group position={[5.55, 1.965, -1.95]} rotation-y={-Math.PI / 2}>
        <mesh>
          <boxGeometry args={[0.3, 0.38, 0.025]} />
          <meshStandardMaterial color={COLORS.gold} roughness={0.44} metalness={0.34} />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.24, 0.32]} />
          <meshStandardMaterial color="#C96F6F" roughness={0.92} />
        </mesh>
      </group>
    </group>
  )
}

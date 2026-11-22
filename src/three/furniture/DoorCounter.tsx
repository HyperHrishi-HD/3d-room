import { COLORS } from '../palette'
import { usePointerCursor } from '../usePointerCursor'
import { useRoomTap } from '../useRoomTap'

type Props = { onSelect: (id: string) => void }

export default function DoorCounter({ onSelect }: Props) {
  const cursor = usePointerCursor()
  const tap = useRoomTap(() => onSelect('mail'))

  return (
    <group>
      <group {...tap} {...cursor}>
        <mesh position={[-5.94, 1.15, -3.7]}>
          <boxGeometry args={[0.1, 2.3, 1.1]} />
          <meshStandardMaterial color="#59382F" roughness={0.82} />
        </mesh>
        <mesh position={[-5.87, 1.15, -3.7]}>
          <boxGeometry args={[0.035, 2.1, 0.92]} />
          <meshStandardMaterial color="#634137" roughness={0.86} />
        </mesh>
        <mesh position={[-5.87, 2.37, -3.7]}>
          <boxGeometry args={[0.14, 0.1, 1.24]} />
          <meshStandardMaterial color={COLORS.wainscot} roughness={0.85} />
        </mesh>
        <mesh position={[-5.87, 1.15, -4.27]}>
          <boxGeometry args={[0.14, 2.42, 0.1]} />
          <meshStandardMaterial color={COLORS.wainscot} roughness={0.85} />
        </mesh>
        <mesh position={[-5.87, 1.15, -3.13]}>
          <boxGeometry args={[0.14, 2.42, 0.1]} />
          <meshStandardMaterial color={COLORS.wainscot} roughness={0.85} />
        </mesh>
        <mesh position={[-5.8, 1.06, -3.24]}>
          <sphereGeometry args={[0.045, 16, 12]} />
          <meshStandardMaterial color={COLORS.gold} roughness={0.4} metalness={0.42} />
        </mesh>

        <mesh position={[-5.45, 0.45, -2.45]}>
          <boxGeometry args={[0.75, 0.9, 1.9]} />
          <meshStandardMaterial color="#3C2B1E" roughness={0.88} />
        </mesh>
        <mesh position={[-5.45, 0.925, -2.45]}>
          <boxGeometry args={[0.81, 0.05, 1.96]} />
          <meshStandardMaterial color="#D8C9AE" roughness={0.8} />
        </mesh>
        <mesh position={[-5.06, 0.48, -2.45]}>
          <boxGeometry args={[0.02, 0.7, 1.72]} />
          <meshStandardMaterial color="#493427" roughness={0.9} />
        </mesh>
        <mesh position={[-5.045, 0.55, -1.62]}>
          <sphereGeometry args={[0.022, 12, 10]} />
          <meshStandardMaterial color={COLORS.gold} roughness={0.4} metalness={0.42} />
        </mesh>

      </group>
    </group>
  )
}

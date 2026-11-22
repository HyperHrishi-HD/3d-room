import { COLORS } from '../palette'
import { usePointerCursor } from '../usePointerCursor'
import { useRoomTap } from '../useRoomTap'

type Props = { onSelect: () => void }

export default function MedalShelf({ onSelect }: Props) {
  const cursor = usePointerCursor()
  const tap = useRoomTap(() => onSelect())

  return (
    <group position={[5.9, 1.5, 1.8]} {...tap} {...cursor}>
      <mesh>
        <boxGeometry args={[0.28, 0.06, 1.9]} />
        <meshStandardMaterial color="#4B3522" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.008, 0]}>
        <boxGeometry args={[0.3, 0.018, 1.9]} />
        <meshStandardMaterial color={COLORS.gold} roughness={0.42} metalness={0.4} />
      </mesh>
    </group>
  )
}

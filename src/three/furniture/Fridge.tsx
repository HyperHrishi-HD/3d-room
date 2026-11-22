import { RoundedBox } from '@react-three/drei'
import { COLORS } from '../palette'
import { usePointerCursor } from '../usePointerCursor'
import { useRoomTap } from '../useRoomTap'

type Props = { onSelect: (id: string) => void }

export default function Fridge({ onSelect }: Props) {
  const cursor = usePointerCursor()
  const tap = useRoomTap(() => onSelect('fridge'))

  return (
    <group position={[-5.55, 0, -1.15]} rotation-y={Math.PI / 2} {...tap} {...cursor}>
      <RoundedBox args={[0.8, 1.8, 0.95]} radius={0.045} smoothness={3} position={[0, 0.9, 0]}>
        <meshStandardMaterial color={COLORS.cream} roughness={0.78} />
      </RoundedBox>
      <mesh position={[0, 1.24, 0.478]}>
        <boxGeometry args={[0.76, 0.024, 0.012]} />
        <meshStandardMaterial color="#C9BBA2" roughness={0.8} />
      </mesh>
      <mesh position={[0.28, 1.02, 0.485]}>
        <cylinderGeometry args={[0.022, 0.022, 0.42, 12]} />
        <meshStandardMaterial color={COLORS.gold} roughness={0.4} metalness={0.42} />
      </mesh>
      <mesh position={[-0.28, 1.48, 0.485]}>
        <cylinderGeometry args={[0.022, 0.022, 0.34, 12]} />
        <meshStandardMaterial color={COLORS.gold} roughness={0.4} metalness={0.42} />
      </mesh>
    </group>
  )
}

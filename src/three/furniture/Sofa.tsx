import { RoundedBox } from '@react-three/drei'
import { COLORS } from '../palette'

/**
 * A low, quiet sofa across the room from the wall screen. It faces the TV
 * rather than sitting under it, so the set keeps its own space and the sofa
 * only comes into view when the room is turned around.
 */
export default function Sofa() {
  return (
    <group position={[-3.35, 0, 3.15]} rotation={[0, Math.PI, 0]}>
      <RoundedBox args={[2.3, 0.28, 0.92]} radius={0.06} smoothness={4} position={[0, 0.18, 0]}>
        <meshStandardMaterial color="#4A3525" roughness={0.9} />
      </RoundedBox>

      <RoundedBox args={[1.02, 0.2, 0.82]} radius={0.06} smoothness={4} position={[-0.53, 0.41, 0.02]}>
        <meshStandardMaterial color="#8A684C" roughness={0.86} />
      </RoundedBox>
      <RoundedBox args={[1.02, 0.2, 0.82]} radius={0.06} smoothness={4} position={[0.53, 0.41, 0.02]}>
        <meshStandardMaterial color="#8A684C" roughness={0.86} />
      </RoundedBox>

      <RoundedBox
        args={[0.96, 0.3, 0.17]}
        radius={0.06}
        smoothness={4}
        position={[-0.53, 0.54, -0.27]}
        rotation={[-0.08, 0, 0]}
      >
        <meshStandardMaterial color="#7C5B41" roughness={0.9} />
      </RoundedBox>
      <RoundedBox
        args={[0.96, 0.3, 0.17]}
        radius={0.06}
        smoothness={4}
        position={[0.53, 0.54, -0.27]}
        rotation={[-0.08, 0, 0]}
      >
        <meshStandardMaterial color="#7C5B41" roughness={0.9} />
      </RoundedBox>

      <RoundedBox args={[2.02, 0.38, 0.2]} radius={0.06} smoothness={4} position={[0, 0.47, -0.36]}>
        <meshStandardMaterial color="#553D2A" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[2.18, 0.07, 0.24]} radius={0.035} smoothness={4} position={[0, 0.665, -0.36]}>
        <meshStandardMaterial color="#6B4B35" roughness={0.84} />
      </RoundedBox>

      <RoundedBox args={[0.2, 0.42, 0.9]} radius={0.055} smoothness={4} position={[-1.12, 0.5, 0]}>
        <meshStandardMaterial color="#5C422E" roughness={0.88} />
      </RoundedBox>
      <RoundedBox args={[0.2, 0.42, 0.9]} radius={0.055} smoothness={4} position={[1.12, 0.5, 0]}>
        <meshStandardMaterial color="#5C422E" roughness={0.88} />
      </RoundedBox>

      {[-0.92, 0.92].map((x) =>
        [-0.32, 0.32].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.045, z]}>
            <cylinderGeometry args={[0.035, 0.045, 0.09, 10]} />
            <meshStandardMaterial color={COLORS.deepWood} roughness={0.8} />
          </mesh>
        )),
      )}
    </group>
  )
}
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { COLORS } from '../palette'
import { createFloorTexture } from '../textures'
import { boxPart, circlePart, mergeParts, planePart } from '../merge'
import { look } from '../overviewLook'

const HALF_PI = Math.PI / 2
const PI = Math.PI

const WALL_PARTS = [
  boxPart(12, 3.4, 0.14, [0, 1.7, -4.5]),
  boxPart(0.14, 3.4, 9, [-6, 1.7, 0]),
  boxPart(0.14, 3.4, 9, [6, 1.7, 0]),
  // The fourth wall only exists for the 360 look-around. Its inward normal
  // means the established outside overview sees a backface and no change.
  planePart(12, 3.4, [0, 1.7, 4.49], [0, PI, 0]),
]

const WAINSCOT_PARTS = [
  boxPart(11.94, 0.9, 0.07, [0, 0.45, -4.42]),
  boxPart(0.07, 0.9, 8.94, [-5.96, 0.45, 0]),
  boxPart(0.07, 0.9, 8.94, [5.96, 0.45, 0]),
  boxPart(11.9, 0.13, 0.08, [0, 0.065, -4.41]),
  boxPart(0.08, 0.13, 8.9, [-5.95, 0.065, 0]),
  boxPart(0.08, 0.13, 8.9, [5.95, 0.065, 0]),
  planePart(11.94, 0.9, [0, 0.45, 4.455], [0, PI, 0]),
  planePart(11.9, 0.13, [0, 0.065, 4.435], [0, PI, 0]),
]

const TRIM_PARTS = [
  boxPart(11.9, 0.035, 0.045, [0, 0.915, -4.405]),
  boxPart(0.045, 0.035, 8.9, [-5.945, 0.915, 0]),
  boxPart(0.045, 0.035, 8.9, [5.945, 0.915, 0]),
  planePart(11.9, 0.035, [0, 0.915, 4.44], [0, PI, 0]),
]

const GOLD_DECOR_PARTS = [
  planePart(11.9, 0.06, [0, 3.34, 4.47], [0, PI, 0]),
  planePart(0.09, 2.32, [-2.02, 1.15, 4.39], [0, PI, 0]),
  planePart(0.09, 2.32, [-0.68, 1.15, 4.39], [0, PI, 0]),
  planePart(1.44, 0.09, [-1.35, 2.27, 4.39], [0, PI, 0]),
  circlePart(0.045, [-0.79, 1.08, 4.385], [0, PI, 0]),
]

const DOOR_PARTS = [planePart(1.28, 2.18, [-1.35, 1.15, 4.42], [0, PI, 0])]
const DOOR_INSET_PARTS = [planePart(1.08, 2.02, [-1.35, 1.15, 4.405], [0, PI, 0])]
const SCONCE_PARTS = [
  planePart(0.12, 0.38, [-4.15, 2.15, 4.445], [0, PI, 0]),
  planePart(0.12, 0.38, [3.15, 2.15, 4.445], [0, PI, 0]),
]
const SCONCE_GLOW_PARTS = [
  planePart(0.06, 0.25, [-4.15, 2.15, 4.439], [0, PI, 0]),
  planePart(0.06, 0.25, [3.15, 2.15, 4.439], [0, PI, 0]),
]
const CEILING_PARTS = [planePart(12, 9, [0, 3.39, 0], [HALF_PI, 0, 0])]
const BEAM_PARTS = [-4.5, -1.5, 1.5, 4.5].map((z) =>
  planePart(11.9, 0.11, [0, 3.36, z], [HALF_PI, 0, 0]),
)
const RUG_BORDER_PARTS = [planePart(6.22, 4.22, [0, 0.006, -0.4], [-HALF_PI, 0, 0])]

const CONSOLE_PARTS = [
  boxPart(2.2, 0.72, 0.38, [2.2, 0.36, 4.2]),
  boxPart(2.32, 0.06, 0.44, [2.2, 0.75, 4.18]),
]
const CONSOLE_DRAWER_PARTS = [
  planePart(0.92, 0.42, [1.72, 0.43, 4.005], [0, PI, 0]),
  planePart(0.92, 0.42, [2.68, 0.43, 4.005], [0, PI, 0]),
]
const CONSOLE_GOLD_PARTS = [
  circlePart(0.032, [1.72, 0.43, 3.997], [0, PI, 0]),
  circlePart(0.032, [2.68, 0.43, 3.997], [0, PI, 0]),
  planePart(0.06, 1.12, [1.27, 2.05, 4.43], [0, PI, 0]),
  planePart(0.06, 1.12, [3.13, 2.05, 4.43], [0, PI, 0]),
  planePart(1.92, 0.06, [2.2, 2.58, 4.43], [0, PI, 0]),
  planePart(1.92, 0.06, [2.2, 1.52, 4.43], [0, PI, 0]),
]
const MIRROR_PARTS = [planePart(1.8, 1.0, [2.2, 2.05, 4.442], [0, PI, 0])]
const RUNNER_PARTS = [planePart(1.5, 1.7, [-1.35, 0.008, 3.45], [-HALF_PI, 0, 0])]

export default function Shell() {
  const frontDecor = useRef<THREE.Group>(null)
  const floorTexture = useMemo(() => createFloorTexture(), [])
  useEffect(() => () => floorTexture.dispose(), [floorTexture])

  const wall = useMemo(() => mergeParts(WALL_PARTS), [])
  const wainscot = useMemo(() => mergeParts(WAINSCOT_PARTS), [])
  const trim = useMemo(() => mergeParts(TRIM_PARTS), [])
  const goldDecor = useMemo(() => mergeParts(GOLD_DECOR_PARTS), [])
  const door = useMemo(() => mergeParts(DOOR_PARTS), [])
  const doorInset = useMemo(() => mergeParts(DOOR_INSET_PARTS), [])
  const sconces = useMemo(() => mergeParts(SCONCE_PARTS), [])
  const sconceGlow = useMemo(() => mergeParts(SCONCE_GLOW_PARTS), [])
  const ceiling = useMemo(() => mergeParts(CEILING_PARTS), [])
  const beams = useMemo(() => mergeParts(BEAM_PARTS), [])
  const rugBorder = useMemo(() => mergeParts(RUG_BORDER_PARTS), [])
  const consoleBody = useMemo(() => mergeParts(CONSOLE_PARTS), [])
  const consoleDrawers = useMemo(() => mergeParts(CONSOLE_DRAWER_PARTS), [])
  const consoleGold = useMemo(() => mergeParts(CONSOLE_GOLD_PARTS), [])
  const mirror = useMemo(() => mergeParts(MIRROR_PARTS), [])
  const runner = useMemo(() => mergeParts(RUNNER_PARTS), [])

  // The entrance console is furniture against the inside face of the fourth
  // wall. Hide it while the camera is outside the dollhouse; from that angle
  // it would otherwise appear to float over the floor.
  useFrame(() => {
    if (frontDecor.current) frontDecor.current.visible = look.blend > 0.12
  })

  return (
    <group>
      <mesh rotation-x={-HALF_PI} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 9]} />
        <meshStandardMaterial map={floorTexture} roughness={0.87} metalness={0} />
      </mesh>

      <mesh geometry={wall}>
        <meshStandardMaterial color={COLORS.wall} roughness={0.9} />
      </mesh>
      <mesh geometry={wainscot}>
        <meshStandardMaterial color={COLORS.wainscot} roughness={0.92} />
      </mesh>
      <mesh geometry={trim}>
        <meshStandardMaterial color="#35281D" roughness={0.8} />
      </mesh>
      <mesh geometry={goldDecor}>
        <meshStandardMaterial color={COLORS.gold} roughness={0.44} metalness={0.34} />
      </mesh>

      <mesh geometry={door}>
        <meshStandardMaterial color="#3D2A1C" roughness={0.86} />
      </mesh>
      <mesh geometry={doorInset}>
        <meshStandardMaterial color="#513925" roughness={0.9} />
      </mesh>
      <mesh geometry={sconces}>
        <meshStandardMaterial color="#5A3D24" roughness={0.7} />
      </mesh>
      <mesh geometry={sconceGlow}>
        <meshBasicMaterial color="#FFC873" toneMapped={false} />
      </mesh>

      <mesh geometry={ceiling}>
        <meshStandardMaterial
          color="#3A291C"
          roughness={0.96}
          emissive="#1B120A"
          emissiveIntensity={0.55}
        />
      </mesh>
      <mesh geometry={beams}>
        <meshStandardMaterial
          color="#4B3524"
          roughness={0.88}
          emissive="#160E08"
          emissiveIntensity={0.45}
        />
      </mesh>

      <group ref={frontDecor} visible={false}>
        <mesh geometry={consoleBody}>
          <meshStandardMaterial color="#4A3321" roughness={0.86} />
        </mesh>
        <mesh geometry={consoleDrawers}>
          <meshStandardMaterial color="#553C27" roughness={0.9} />
        </mesh>
        <mesh geometry={consoleGold}>
          <meshStandardMaterial color={COLORS.gold} roughness={0.44} metalness={0.34} />
        </mesh>
        <mesh geometry={mirror}>
          <meshStandardMaterial color="#1C2227" roughness={0.22} metalness={0.3} />
        </mesh>
        <mesh geometry={runner}>
          <meshStandardMaterial color={COLORS.rug} roughness={0.97} />
        </mesh>
      </group>

      <mesh geometry={rugBorder} rotation-x={0}>
        <meshStandardMaterial color={COLORS.gold} roughness={0.8} metalness={0.08} />
      </mesh>
      <mesh rotation-x={-HALF_PI} position={[0, 0.009, -0.4]}>
        <planeGeometry args={[5.96, 3.96]} />
        <meshStandardMaterial color={COLORS.rug} roughness={0.97} />
      </mesh>
    </group>
  )
}

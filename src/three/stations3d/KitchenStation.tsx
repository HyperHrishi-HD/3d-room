import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { kitchenFrames } from '../../data/content'
import { stationById } from '../../data/stations'
import { playSfx } from '../../lib/sfx'
import { useRoom } from '../../state/roomStore'
import InWorldControls from '../InWorldControls'
import { COLORS } from '../palette'
import { useArtTexture, useTextTexture } from '../textEngine'
import { usePointerCursor } from '../usePointerCursor'

const STATION = stationById('kitchen')!
// The kitchen wall is viewed from inside the room, so lower z reads on the
// right. Keep the photo order and the arrow directions aligned with that view.
const FRAME_Z = [2.92, 2.37, 1.82, 1.27, 0.72]
const NOTE_POSITION: [number, number, number] = [-5.28, 1.02, 1.75]

function Frame({
  index,
  active,
  selected,
  onSelect,
}: {
  index: number
  active: boolean
  selected: boolean
  onSelect: (index: number) => void
}) {
  const frame = kitchenFrames[index]
  const group = useRef<THREE.Group>(null)
  const art = useArtTexture(frame.art, 460, 380)
  const caption = useTextTexture({
    width: 720,
    height: 400,
    padding: 42,
    background: '#F5EFE2',
    border: 'gold',
    blocks: [
      { text: frame.title, font: 'display', size: 34, lineHeight: 1.08, gapAfter: 12 },
      { text: frame.caption, font: 'body', size: 25, lineHeight: 1.5 },
    ],
  })
  const cursor = usePointerCursor()
  const z = FRAME_Z[index]

  useFrame((_, delta) => {
    if (!group.current) return
    group.current.position.x = THREE.MathUtils.damp(
      group.current.position.x,
      active && selected ? -5.8 : -5.87,
      7,
      Math.min(delta, 0.05),
    )
  })

  return (
    <>
      <group
        ref={group}
        position={[-5.87, 1.62, z]}
        rotation-y={Math.PI / 2}
        {...cursor}
        onPointerDown={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation()
          onSelect(index)
        }}
      >
        <mesh>
          <boxGeometry args={[0.64, 0.52, 0.035]} />
          <meshStandardMaterial
            color={active && selected ? COLORS.brightGold : COLORS.gold}
            roughness={0.44}
            metalness={0.34}
          />
        </mesh>
        <mesh position={[0, 0, 0.021]}>
          <planeGeometry args={[0.56, 0.44]} />
          <meshBasicMaterial map={art} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <planeGeometry args={[0.68, 0.56]} />
          <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {active && selected ? (
        <group position={NOTE_POSITION} rotation-y={Math.PI / 2}>
          <mesh>
            <planeGeometry args={[0.64, 0.355]} />
            <meshBasicMaterial map={caption ?? undefined} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
    </>
  )
}

export default function KitchenStation() {
  const { activeId, closeStation, selectStation } = useRoom()
  const active = activeId === STATION.id
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!active) setSelected(0)
  }, [active])

  const chooseFrame = (index: number) => {
    playSfx('kitchen-clink')
    setSelected(index)
    if (!activeId) selectStation(STATION.id)
  }

  const step = (direction: 1 | -1) => {
    setSelected((value) => {
      const next = (value + direction + kitchenFrames.length) % kitchenFrames.length
      return next
    })
    if (!activeId) selectStation(STATION.id)
  }

  return (
    <group>
      {kitchenFrames.map((frame, index) => (
        <Frame
          key={frame.id}
          index={index}
          active={active}
          selected={selected === index}
          onSelect={chooseFrame}
        />
      ))}

      {active ? (
        <InWorldControls
          position={STATION.anchor}
          width={0.94}
          height={0.75}
          closeLift={-0.5}
          rotationY={0.78}
          onClose={closeStation}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          prevLabel="Previous frame"
          nextLabel="Next frame"
        />
      ) : null}
    </group>
  )
}

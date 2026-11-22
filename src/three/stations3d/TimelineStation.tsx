import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { timelineNotes } from '../../data/content'
import { stationById } from '../../data/stations'
import { playSfx } from '../../lib/sfx'
import { useRoom } from '../../state/roomStore'
import InWorldControls from '../InWorldControls'
import Pinboard from '../furniture/Pinboard'
import { COLORS } from '../palette'
import { tapCall } from '../tapGuard'
import { useTextTexture } from '../textEngine'
import { usePointerCursor } from '../usePointerCursor'

const STATION = stationById('timeline')!
const NOTE_REST_Z = 0.135
const NOTE_POSITIONS = [
  [-1.03, 0.55],
  [-0.55, 0.62],
  [-0.08, 0.55],
  [0.36, 0.62],
  [0.78, 0.55],
  [1.12, 0.62],
  [-0.95, 0.08],
  [-0.48, 0.16],
  [0.0, 0.06],
  [0.45, 0.14],
  [0.85, 0.04],
  [1.15, 0.1],
] as const

function Note({
  index,
  selected,
  opened,
  active,
  onSelect,
}: {
  index: number
  selected: boolean
  opened: boolean
  active: boolean
  onSelect: (index: number) => void
}) {
  const note = timelineNotes[index]
  const group = useRef<THREE.Group>(null)
  const cursor = usePointerCursor()
  const small = useTextTexture({
    width: 300,
    height: 340,
    padding: 26,
    background: index % 2 ? '#F4EAD8' : '#EFE1C9',
    border: 'none',
    art: note.art,
    artHeight: 92,
    blocks: [
      {
        text: note.year ? `${note.title} · ${note.year}` : note.title,
        font: 'hand',
        size: 30,
        lineHeight: 1.05,
        gapAfter: 10,
      },
      {
        text: note.body,
        font: 'body',
        size: 15,
        lineHeight: 1.35,
        maxLines: 5,
        color: 'rgba(42,33,24,0.7)',
      },
    ],
  })
  const large = useTextTexture(
    selected && active
      ? {
          width: 700,
          height: 820,
          padding: 66,
          background: '#F5EDDC',
          border: 'gold',
          art: note.art,
          artHeight: 300,
          blocks: [
            {
              text: 'A NOTE FROM THE WALL',
              font: 'body',
              size: 18,
              letterSpacing: 3,
              color: '#9B7732',
              gapAfter: 20,
            },
            {
              text: note.year ? `${note.title} · ${note.year}` : note.title,
              font: 'display',
              size: 54,
              lineHeight: 1.08,
              gapAfter: 20,
            },
            { text: note.body, font: 'body', size: 31, lineHeight: 1.55 },
          ],
        }
      : null,
  )
  const [x, y] = NOTE_POSITIONS[index]

  useEffect(() => {
    for (const texture of [small, large]) {
      if (!texture) continue
      texture.anisotropy = 16
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.needsUpdate = true
    }
  }, [small, large])

  useFrame((_, delta) => {
    if (!group.current) return
    // When the board is not the open station, put every note back immediately.
    // Damping the lifted reading card back down during the pull-away made the
    // photo appear to ghost across its neighbours from the far view.
    if (!active) {
      group.current.position.z = NOTE_REST_Z
      group.current.scale.setScalar(1)
      return
    }
    const step = Math.min(delta, 0.05)
    const targetZ = selected ? 0.34 : NOTE_REST_Z
    const targetScale = selected ? 1.42 : 1
    group.current.position.z = THREE.MathUtils.damp(group.current.position.z, targetZ, 7, step)
    group.current.scale.setScalar(
      THREE.MathUtils.damp(group.current.scale.x, targetScale, 7, step),
    )
  })

  return (
    <group ref={group} position={[x, y, NOTE_REST_Z]} rotation-z={index % 2 ? 0.025 : -0.02}>
      <mesh
        {...cursor}
        onPointerDown={(event: ThreeEvent<PointerEvent>) => event.stopPropagation()}
        onPointerUp={(event: ThreeEvent<PointerEvent>) =>
          tapCall(event, () => onSelect(index))
        }
      >
        <planeGeometry args={[0.44, 0.52]} />
        <meshBasicMaterial
          map={(selected && active ? large : small) ?? undefined}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh position={[0, 0.245, 0.012]}>
        <sphereGeometry args={[0.017, 10, 8]} />
        <meshBasicMaterial color={opened ? COLORS.brightGold : '#7A3E35'} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[0.56, 0.64]} />
        <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function TimelineStation() {
  const { activeId, closeStation, selectStation } = useRoom()
  const active = activeId === STATION.id
  const [selected, setSelected] = useState(0)
  const [opened, setOpened] = useState<Set<number>>(() => new Set([0]))

  const choose = (index: number) => {
    setSelected(index)
    setOpened((current) => new Set(current).add(index))
    if (!activeId) selectStation(STATION.id)
  }

  useEffect(() => {
    if (!active) return
    setOpened((current) => new Set(current).add(selected))
    playSfx('timeline-tick')
  }, [active, selected])

  // The portrait reading sheet follows the selected note. Tapping a note or
  // using the sheet's arrows dispatches the same state change.
  useEffect(() => {
    if (!active) return
    window.dispatchEvent(
      new CustomEvent('room-timeline-card', { detail: { index: selected } }),
    )
  }, [active, selected])

  useEffect(() => {
    const step = (event: Event) => {
      const direction = (event as CustomEvent<{ direction?: number }>).detail?.direction
      if (direction !== 1 && direction !== -1) return
      const next = (selected + direction + timelineNotes.length) % timelineNotes.length
      setSelected(next)
      setOpened((current) => new Set(current).add(next))
    }
    window.addEventListener('room-timeline-step', step)
    return () => window.removeEventListener('room-timeline-step', step)
  }, [selected])

  const stringPoints = useMemo(
    () => NOTE_POSITIONS.map(([x, y]) => [x, y + 0.27, 0.07] as [number, number, number]),
    [],
  )

  return (
    <group>
      <Pinboard onSelect={() => {
        if (!activeId) selectStation(STATION.id)
      }} />
      <group position={[3.55, 1.85, -4.28]}>
        <Line points={stringPoints} color={COLORS.gold} lineWidth={1.2} />
        {timelineNotes.map((note, index) => (
          <Note
            key={note.id}
            index={index}
            selected={selected === index}
            opened={opened.has(index)}
            active={active}
            onSelect={choose}
          />
        ))}
      </group>
      {active ? (
        <InWorldControls
          position={[STATION.anchor[0], STATION.anchor[1], STATION.anchor[2]]}
          width={1.06}
          height={1.18}
          onClose={closeStation}
          onPrev={() => {
            const next = (selected + timelineNotes.length - 1) % timelineNotes.length
            setSelected(next)
            setOpened((current) => new Set(current).add(next))
          }}
          onNext={() => {
            const next = (selected + 1) % timelineNotes.length
            setSelected(next)
            setOpened((current) => new Set(current).add(next))
          }}
          prevLabel="Previous pinned note"
          nextLabel="Next pinned note"
        />
      ) : null}
    </group>
  )
}

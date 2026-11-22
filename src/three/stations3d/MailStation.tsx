import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { stationById } from '../../data/stations'
import { useLetters } from '../../lib/letters'
import { playSfx } from '../../lib/sfx'
import { useRoom } from '../../state/roomStore'
import InWorldControls from '../InWorldControls'
import { useFloatToRead, type Stage, type TransformSpec } from '../FloatToRead'
import { useTextTexture, wrapText } from '../textEngine'
import { usePointerCursor } from '../usePointerCursor'
import { tapCall } from '../tapGuard'

const STATION = stationById('mail')!
const HOME_X = -5.42
const COUNTER_Y = 0.968
const SLOT_Z = [-2.84, -2.45, -2.06]
const LETTER_SCALE = 1.24
const LETTER_WIDTH = 0.56
const LETTER_HEIGHT = 0.74
// The front door's letter slot, in world space. Each envelope starts here.
const DOOR_POINT = [-5.79, 1.04, -3.66] as const
const READ_ROTATION: [number, number, number] = [-0.1, 0.78, 0.01]

const READ: TransformSpec = {
  position: STATION.anchor,
  rotation: READ_ROTATION,
}

type DoorLetter = { id: string; name: string; message: string }

function homePose(slot: number): TransformSpec {
  // The selected envelope sits on top of the two neighbours, so its label is
  // never hidden by the edges of the stacked paper. The neighbours fan out
  // slightly behind it, toward the wall.
  return {
    position: [
      HOME_X + (slot === 0 ? 0 : 0.02),
      COUNTER_Y + 0.004 + (slot === 0 ? 0.008 : 0),
      SLOT_Z[slot + 1],
    ],
    rotation: [-Math.PI / 2, 0, slot * 0.13],
  }
}

const LETTER_CANVAS = { width: 640, height: 840, padding: 46 }
const LETTER_BODY_WIDTH = LETTER_CANVAS.width - LETTER_CANVAS.padding * 2
const MESSAGE_LINE_HEIGHT = 1.38

/**
 * Pick the largest body size whose wrapped message still fits the letter, so a
 * long letter shrinks to stay on the paper instead of running off the bottom.
 * The reserved header and signature heights mirror the letter spec below.
 */
function letterTypeSize(message: string, name: string) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return { size: 20, maxLines: 26 }

  // Measure the signature with the hand face the renderer uses. If Caveat has
  // not arrived yet this falls back to a wider script face, which only makes
  // the reservation safer.
  ctx.font = "500 40px Caveat, 'Segoe Script', cursive"
  const nameLines = wrapText(ctx, `From ${name}`, LETTER_BODY_WIDTH, 2).length
  const header =
    16 * 1.45 + 22 + nameLines * 40 * 1.45 + 8 + 22 + 12
  const footer = 18 + 28 * 1.45
  const available =
    LETTER_CANVAS.height -
    LETTER_CANVAS.padding * 0.5 -
    LETTER_CANVAS.padding -
    header -
    footer

  for (const size of [28, 26, 24, 22, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11]) {
    ctx.font = `400 ${size}px Georgia, 'Times New Roman', serif`
    const lines = wrapText(ctx, message, LETTER_BODY_WIDTH)
    if (lines.length * size * MESSAGE_LINE_HEIGHT <= available) {
      return { size, maxLines: lines.length }
    }
  }
  // A letter longer than the paper can hold even at the floor size still keeps
  // every word: the footer gives up its space before any text is dropped.
  return { size: 11, maxLines: Number.POSITIVE_INFINITY }
}

type EnvelopeProps = {
  entry: DoorLetter
  slot: number
  active: boolean
  selected: boolean
  onSelect: () => void
}

function Envelope({ entry, slot, active, selected, onSelect }: EnvelopeProps) {
  const home = useMemo(() => homePose(slot), [slot])
  const cursor = usePointerCursor()
  const spawnGroup = useRef<THREE.Group>(null)
  const flap = useRef<THREE.Group>(null)
  const flapProgress = useRef(0)
  const travel = useRef(-0.14 - Math.abs(slot) * 0.08)
  const [letterStage, setLetterStage] = useState<Stage>('home')
  const timers = useRef<number[]>([])

  const stage: Stage = active && selected ? 'read' : 'home'
  const [flapStart, setFlapStart] = useState(false)
  useEffect(() => {
    setFlapStart(stage === 'read')
  }, [stage])

  const from = useMemo(
    () => [
      DOOR_POINT[0] - home.position[0],
      DOOR_POINT[1] - home.position[1],
      DOOR_POINT[2] - home.position[2],
    ],
    [home],
  )

  // The letter's reading pose in the envelope's local space, derived from the
  // approved world pose so every slot reads at the same spot.
  const letterRead = useMemo(() => {
    const envQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...home.rotation))
    const envInv = envQuat.clone().invert()
    const readQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...READ.rotation))
    const worldOffset = new THREE.Vector3(0, 0.34, 0.1).applyQuaternion(readQuat)
    const worldPos = new THREE.Vector3(...STATION.anchor).add(worldOffset)
    const localPos = worldPos.clone().sub(new THREE.Vector3(...home.position)).applyQuaternion(envInv)
    const localQuat = envInv.clone().multiply(readQuat)
    const euler = new THREE.Euler().setFromQuaternion(localQuat, 'YXZ')
    return {
      position: [localPos.x, localPos.y, localPos.z] as [number, number, number],
      rotation: [euler.x, euler.y, euler.z] as [number, number, number],
    }
  }, [home])

  const letterFloat = useFloatToRead(letterStage, {
    home: { position: [0, -0.03, 0.002], rotation: [0, 0, 0] },
    // The letter clears the envelope's top edge before it flies out, so the
    // paper rises from the flap instead of passing through it.
    picker: { position: [0, 0.61, 0.002], rotation: [0, 0, 0] },
    read: letterRead,
  })

  useEffect(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    if (stage === 'read') {
      timers.current.push(window.setTimeout(() => setLetterStage('picker'), 380))
      timers.current.push(window.setTimeout(() => setLetterStage('read'), 980))
    } else {
      timers.current.push(window.setTimeout(() => setLetterStage('home'), 620))
    }
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id))
    }
  }, [stage])

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  const labelSpec = useMemo(
    () => ({
      width: 620,
      height: 400,
      padding: 46,
      background: '#F0E4CF',
      border: 'none' as const,
      grain: true,
      blocks: [
        {
          text: 'A note',
          font: 'body' as const,
          size: 17,
          color: 'rgba(42,33,24,0.45)',
          align: 'center' as const,
          letterSpacing: 4,
          gapAfter: 26,
        },
        {
          text: `From ${entry.name}`,
          font: 'hand' as const,
          size: 46,
          color: '#5A4330',
          align: 'center' as const,
          maxLines: 2,
          gapAfter: 10,
        },
        {
          text: entry.message,
          font: 'body' as const,
          size: 18,
          lineHeight: 1.3,
          color: 'rgba(42,33,24,0.52)',
          align: 'center' as const,
          maxLines: 2,
        },
      ],
    }),
    [entry.message, entry.name],
  )
  const label = useTextTexture(labelSpec)

  const type = useMemo(
    () => letterTypeSize(entry.message, entry.name),
    [entry.message, entry.name],
  )
  const letterSpec = useMemo(
    () => ({
      width: 640,
      height: 840,
      padding: 46,
      background: '#F7F0E1',
      border: 'gold' as const,
      grain: true,
      blocks: [
        {
          text: 'A note',
          font: 'body' as const,
          size: 16,
          color: 'rgba(42,33,24,0.42)',
          align: 'center' as const,
          letterSpacing: 4,
          gapAfter: 22,
        },
        {
          text: `From ${entry.name}`,
          font: 'hand' as const,
          size: 40,
          align: 'center' as const,
          maxLines: 2,
          gapAfter: 8,
        },
        { type: 'rule' as const, align: 'center' as const, gapAfter: 22 },
        {
          text: entry.message,
          font: 'body' as const,
          size: type.size,
          lineHeight: MESSAGE_LINE_HEIGHT,
          maxLines: type.maxLines,
        },
        { type: 'spacer' as const, gapAfter: 18 },
        {
          text: 'with love',
          font: 'hand' as const,
          size: 28,
          color: '#8B6A3C',
          align: 'right' as const,
        },
      ],
    }),
    [type.maxLines, type.size, entry.message, entry.name],
  )
  const letter = useTextTexture(letterStage !== 'home' ? letterSpec : null)

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05)
    travel.current = Math.min(1, travel.current + step / 0.9)
    const t = THREE.MathUtils.clamp(travel.current, 0, 1)
    const eased = 1 - (1 - t) ** 3
    if (spawnGroup.current) {
      spawnGroup.current.position.set(
        from[0] * (1 - eased),
        from[1] * (1 - eased) + Math.sin(t * Math.PI) * 0.035,
        from[2] * (1 - eased),
      )
    }

    const target = flapStart ? 1 : 0
    flapProgress.current = THREE.MathUtils.damp(flapProgress.current, target, 7, step)
    const flapEase =
      flapProgress.current < 0.5
        ? 4 * flapProgress.current ** 3
        : 1 - (-2 * flapProgress.current + 2) ** 3 / 2
    if (flap.current) flap.current.rotation.x = 2.97 * flapEase

    if (letterFloat.current) {
      const scaleTarget = letterStage === 'read' ? LETTER_SCALE : 1
      const next = THREE.MathUtils.damp(
        letterFloat.current.scale.x,
        scaleTarget,
        9,
        step,
      )
      letterFloat.current.scale.setScalar(next)
      if (letterStage === 'read') letterFloat.current.scale.setScalar(LETTER_SCALE)
    }
  })

  const flapShape = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.31, 0)
    shape.lineTo(0, -0.18)
    shape.lineTo(0.31, 0)
    shape.closePath()
    return shape
  }, [])

  const tap = (event: ThreeEvent<PointerEvent>) => tapCall(event, onSelect)

  return (
    <group ref={spawnGroup}>
      <group
        position={home.position}
        rotation={home.rotation}
        {...cursor}
      >
        {/* Back of the envelope. */}
        <mesh position={[0, 0, -0.004]}>
          <boxGeometry args={[0.62, 0.4, 0.008]} />
          <meshStandardMaterial color="#E7DAC3" roughness={0.9} />
        </mesh>
        {/* Front panel, which occludes the letter until it clears the top.
            It also owns the tap target: the paper is the hit area. */}
        <mesh position={[0, 0, 0.0075]} onPointerUp={tap}>
          <boxGeometry args={[0.62, 0.4, 0.005]} />
          <meshStandardMaterial
            color={selected ? '#F2E6D0' : '#E7DAC3'}
            roughness={0.9}
          />
        </mesh>
        {label ? (
          <mesh position={[0, 0, 0.0105]}>
            <planeGeometry args={[0.59, 0.37]} />
            <meshBasicMaterial map={label} toneMapped={false} transparent />
          </mesh>
        ) : null}
        <group ref={flap} position={[0, 0.2, 0.012]}>
          <mesh>
            <shapeGeometry args={[flapShape]} />
            <meshStandardMaterial
              color="#DDCFB6"
              roughness={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
        {/* A small wax stamp, so the envelope reads as paper rather than a card. */}
        <mesh position={[0.235, -0.15, 0.014]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.026, 0.026, 0.006, 18]} />
          <meshStandardMaterial
            color="#A9792E"
            roughness={0.42}
            metalness={0.35}
          />
        </mesh>
        {letterStage !== 'home' && letter ? (
          <group ref={letterFloat} position={[0, -0.03, 0.002]}>
            <mesh>
              <planeGeometry args={[LETTER_WIDTH, LETTER_HEIGHT]} />
              <meshBasicMaterial map={letter} toneMapped={false} />
            </mesh>
          </group>
        ) : null}
      </group>
    </group>
  )
}

export default function MailStation() {
  const { activeId, closeStation, selectStation } = useRoom()
  const active = activeId === STATION.id
  const { letters } = useLetters()
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    setSelected((value) => Math.min(value, Math.max(0, letters.length - 1)))
  }, [letters.length])

  useEffect(() => {
    if (active) playSfx('letter-open')
  }, [active])

  const slots = useMemo(() => {
    const total = letters.length
    if (!total) return []
    const offsets = total === 1 ? [0] : total === 2 ? [0, -1] : [-1, 0, 1]
    return offsets.map((offset) => {
      const index = (selected + offset + total) % total
      return { offset, index, entry: letters[index] }
    })
  }, [selected, letters])

  const choose = (index: number) => {
    if (index === selected) {
      if (!activeId) selectStation(STATION.id)
      return
    }
    playSfx('paper-slide')
    setSelected(index)
    if (!activeId) selectStation(STATION.id)
  }

  const move = (direction: 1 | -1) => {
    if (!letters.length) return
    playSfx('paper-slide')
    setSelected((value) => (value + direction + letters.length) % letters.length)
  }

  return (
    <group>
      {slots.map(({ offset, index, entry }) => (
        <Envelope
          key={`${offset}-${entry.id}`}
          entry={entry}
          slot={offset}
          active={active}
          selected={index === selected}
          onSelect={() => choose(index)}
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
          onPrev={() => move(-1)}
          onNext={() => move(1)}
          prevLabel="Previous letter"
          nextLabel="Next letter"
        />
      ) : null}
    </group>
  )
}

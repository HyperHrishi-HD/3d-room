import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { polaroids } from '../../data/content'
import { stationById } from '../../data/stations'
import { playSfx } from '../../lib/sfx'
import { useRoom } from '../../state/roomStore'
import InWorldControls from '../InWorldControls'
import { COLORS } from '../palette'
import { makeCanvasTexture, useArtTexture, useFontVersion } from '../textEngine'
import { usePointerCursor } from '../usePointerCursor'
import { releaseLookDrag, suppressLookDrag } from '../tapGuard'

const STATION = stationById('polaroids')!

function photoHome(photo: (typeof polaroids)[number]) {
  return [0.75 + photo.x * 1.3, 1.5 + photo.y * 1.12, -4.34] as [number, number, number]
}

function PolaroidPhoto({
  index,
  active,
  onSelect,
}: {
  index: number
  active: boolean
  onSelect: (index: number) => void
}) {
  const photo = polaroids[index]
  const cursor = usePointerCursor()
  const version = useFontVersion()
  const art = useArtTexture(photo.art, 436, 416)
  const [home, setHome] = useState(() => photoHome(photo))
  const group = useRef<THREE.Group>(null)
  const targetPosition = useMemo(() => new THREE.Vector3(), [])
  const drag = useRef<{ active: boolean; moved: boolean; dx: number; dy: number }>({
    active: false,
    moved: false,
    dx: 0,
    dy: 0,
  })

  const texture = useMemo(
    () =>
      makeCanvasTexture(512, 640, (ctx) => {
        ctx.fillStyle = '#F7F0E2'
        ctx.fillRect(0, 0, 512, 640)
        ctx.fillStyle = '#E3D6BE'
        ctx.fillRect(28, 28, 456, 436)
        ctx.drawImage(art.image, 38, 38, 436, 416)
        ctx.strokeStyle = 'rgba(201,162,75,0.42)'
        ctx.lineWidth = 2
        ctx.strokeRect(20, 20, 472, 452)
        ctx.fillStyle = '#5A4330'
        ctx.font = "600 31px Caveat, cursive"
        ctx.textAlign = 'center'
        ctx.fillText(photo.caption, 256, 530, 440)
        ctx.fillStyle = 'rgba(42,33,24,0.54)'
        ctx.font = "400 17px Georgia, serif"
        ctx.fillText(photo.note, 256, 566, 430)
        ctx.fillStyle = COLORS.gold
        ctx.beginPath()
        ctx.arc(256, 612, 7, 0, Math.PI * 2)
        ctx.fill()
      }),
    [art, photo, version],
  )
  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => {
    setHome(photoHome(photo))
  }, [photo])

  useEffect(() => {
    if (!group.current) return
    group.current.position.set(...home)
    group.current.rotation.set(-0.02, 0, photo.tilt)
  }, [home, photo.tilt])

  useFrame((_, delta) => {
    const card = group.current
    if (!card) return
    const step = Math.min(delta, 0.05)
    targetPosition.set(...(active ? STATION.anchor : home))
    card.position.lerp(targetPosition, 1 - Math.exp(-7 * step))
    card.rotation.x = THREE.MathUtils.damp(card.rotation.x, active ? 0 : -0.02, 7, step)
    card.rotation.y = THREE.MathUtils.damp(card.rotation.y, 0, 7, step)
    card.rotation.z = THREE.MathUtils.damp(card.rotation.z, active ? 0 : photo.tilt, 7, step)
    const next = THREE.MathUtils.damp(card.scale.x, active ? 2.05 : 1, 7, step)
    card.scale.setScalar(next)
  })

  const down = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    suppressLookDrag()
    drag.current.active = true
    drag.current.moved = false
    drag.current.dx = home[0] - event.point.x
    drag.current.dy = home[1] - event.point.y
  }

  const move = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current.active || active) return
    event.stopPropagation()
    const x = THREE.MathUtils.clamp(event.point.x + drag.current.dx, 0.55, 2.25)
    const y = THREE.MathUtils.clamp(event.point.y + drag.current.dy, 1.4, 2.65)
    if (Math.abs(x - home[0]) + Math.abs(y - home[1]) > 0.02) drag.current.moved = true
    setHome([x, y, -4.34])
  }

  const up = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    releaseLookDrag()
    const moved = drag.current.moved
    drag.current.active = false
    if (!moved) onSelect(index)
  }

  return (
    <group
      ref={group}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        releaseLookDrag()
        drag.current.active = false
      }}
      {...cursor}
    >
      <mesh>
        <planeGeometry args={[0.42, 0.525]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.24, 0.008]}>
        <sphereGeometry args={[0.018, 10, 8]} />
        <meshStandardMaterial color={COLORS.gold} roughness={0.3} metalness={0.4} toneMapped={false} />
      </mesh>
    </group>
  )
}

export default function PolaroidStation() {
  const { activeId, closeStation, selectStation } = useRoom()
  const active = activeId === STATION.id
  const [selected, setSelected] = useState(0)

  const choose = (index: number) => {
    setSelected(index)
    if (!activeId) selectStation(STATION.id)
  }

  useEffect(() => {
    if (active) playSfx('letter-open')
  }, [active, selected])

  return (
    <group>
      {polaroids.map((photo, index) => (
        <PolaroidPhoto
          key={photo.id}
          index={index}
          active={active && selected === index}
          onSelect={choose}
        />
      ))}
      {active ? (
        <InWorldControls
          position={[STATION.anchor[0], STATION.anchor[1], STATION.anchor[2]]}
          width={0.86}
          height={1.08}
          onClose={closeStation}
          onPrev={() => setSelected((selected + polaroids.length - 1) % polaroids.length)}
          onNext={() => setSelected((selected + 1) % polaroids.length)}
          prevLabel="Previous photograph"
          nextLabel="Next photograph"
        />
      ) : null}
    </group>
  )
}

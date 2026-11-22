import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { places } from '../../data/content'
import { stationById } from '../../data/stations'
import { playSfx } from '../../lib/sfx'
import { useRoom } from '../../state/roomStore'
import InWorldControls from '../InWorldControls'
import MapBoard from '../furniture/MapBoard'
import { useTextTexture } from '../textEngine'
import { usePointerCursor } from '../usePointerCursor'

const STATION = stationById('places')!

function PlacePhoto({
  photo,
  index,
  total,
  selected,
  onSelect,
}: {
  photo: (typeof places)[number]['photos'][number]
  index: number
  total: number
  selected: boolean
  onSelect: (index: number) => void
}) {
  const group = useRef<THREE.Group>(null)
  const cursor = usePointerCursor()
  const texture = useTextTexture({
    width: 340,
    height: 430,
    padding: 18,
    background: '#F5EFE2',
    border: 'gold',
    art: photo.art,
    artHeight: 246,
    blocks: [
      {
        text: photo.caption,
        font: 'body',
        size: 19,
        lineHeight: 1.28,
        maxLines: 5,
        color: '#5A4330',
      },
    ],
  })
  const middle = (total - 1) / 2
  const x = (index - middle) * 0.115
  const y = -0.12 - Math.abs(index - middle) * 0.008
  const restZ = 0.02 + index * 0.003

  useFrame((_, delta) => {
    if (!group.current) return
    const step = Math.min(delta, 0.05)
    const scale = THREE.MathUtils.damp(group.current.scale.x, selected ? 1.72 : 1, 8, step)
    group.current.scale.setScalar(scale)
    group.current.position.z = THREE.MathUtils.damp(
      group.current.position.z,
      selected ? 0.38 : restZ,
      8,
      step,
    )
  })

  return (
    <group
      ref={group}
      position={[x, y, restZ]}
      rotation-z={(index - middle) * 0.022}
      {...cursor}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()
        onSelect(index)
      }}
    >
      <mesh position={[0, 0, -0.006]}>
        <planeGeometry args={[0.365, 0.47]} />
        <meshBasicMaterial color="#E4D4B9" toneMapped={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[0.345, 0.45]} />
        <meshBasicMaterial map={texture ?? undefined} toneMapped={false} />
      </mesh>
    </group>
  )
}

function PlacePhotos({
  place,
  selectedPhoto,
  onSelectPhoto,
  scale,
}: {
  place: (typeof places)[number]
  selectedPhoto: number | null
  onSelectPhoto: (index: number) => void
  scale: number
}) {
  const cards = useMemo(() => {
    // A stable shuffle keeps the first print readable and the rest fanned back.
    const list = [...place.photos]
    return list.sort(
      (a, b) =>
        ((a.id.length * 17 + a.id.charCodeAt(a.id.length - 2)) % 13) -
        ((b.id.length * 17 + b.id.charCodeAt(b.id.length - 2)) % 13),
    )
  }, [place])

  return (
    <group position={[STATION.anchor[0], 1.3, -4.0]} scale={scale}>
      {cards.map((photo, photoIndex) => (
        <PlacePhoto
          key={photo.id}
          photo={photo}
          index={photoIndex}
          total={cards.length}
          selected={selectedPhoto === photoIndex}
          onSelect={onSelectPhoto}
        />
      ))}
    </group>
  )
}

export default function PlacesStation() {
  const { activeId, closeStation, selectStation } = useRoom()
  const { size } = useThree()
  const active = activeId === STATION.id
  const compact = size.width < 620
  const [selected, setSelected] = useState(0)
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null)

  useEffect(() => {
    if (!active) {
      setSelected(0)
      setSelectedPhoto(null)
    }
  }, [active])

  const choose = (index: number) => {
    playSfx('map-pin')
    setSelected(index)
    setSelectedPhoto(null)
    if (!activeId) selectStation(STATION.id)
  }

  const changePlace = (index: number) => {
    playSfx('map-whoosh')
    setSelected(index)
    setSelectedPhoto(null)
  }

  return (
    <group>
      <MapBoard
        active={active}
        selected={selected}
        onSelectPin={choose}
        onActivate={() => {
          if (!activeId) selectStation(STATION.id)
        }}
      />
      {active ? (
        <>
          <PlacePhotos
            place={places[selected]}
            selectedPhoto={selectedPhoto}
            onSelectPhoto={(index) =>
              setSelectedPhoto((current) => (current === index ? null : index))
            }
            scale={compact ? 1.7 : 1}
          />
          <InWorldControls
            position={[STATION.anchor[0], 1.4, -3.55]}
            width={1.33}
            height={0.9}
            closeLift={0.55}
            onClose={closeStation}
            onPrev={() =>
              changePlace((selected + places.length - 1) % places.length)
            }
            onNext={() => changePlace((selected + 1) % places.length)}
            debugKey="places"
            prevLabel="Previous place"
            nextLabel="Next place"
          />
        </>
      ) : null}
    </group>
  )
}

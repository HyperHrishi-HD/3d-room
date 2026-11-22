import { useEffect, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { medalAwards } from '../../data/content'
import { stationById } from '../../data/stations'
import { playSfx } from '../../lib/sfx'
import { useRoom } from '../../state/roomStore'
import InWorldControls from '../InWorldControls'
import MedalShelf from '../furniture/MedalShelf'
import { COLORS } from '../palette'
import { useTextTexture } from '../textEngine'
import { usePointerCursor } from '../usePointerCursor'
import { tapCall } from '../tapGuard'

const STATION = stationById('medals')!
const Z = [1.35, 1.8, 2.25]
const MEDAL_TONES = ['#C9A24B', '#C96F6F', '#D8C7A8']

export default function MedalStation() {
  const { activeId, closeStation, selectStation } = useRoom()
  const active = activeId === STATION.id
  const [selected, setSelected] = useState(0)
  const cursor = usePointerCursor()

  useEffect(() => {
    if (!active) {
      setSelected(0)
      return
    }
    playSfx('medal-chime')
  }, [active, selected])

  const award = medalAwards[selected]
  const card = useTextTexture({
    width: 820,
    height: 500,
    padding: 54,
    background: '#F5EFE2',
    border: 'gold',
    blocks: [
      { text: 'a small medal', font: 'hand', size: 30, color: '#9B7732', gapAfter: 12 },
      { text: award.title, font: 'display', size: 50, lineHeight: 1.06, gapAfter: 20 },
      { text: award.line, font: 'body', size: 34, lineHeight: 1.4 },
    ],
  })

  const choose = (index: number) => {
    setSelected(index)
    if (!activeId) selectStation(STATION.id)
  }

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const debug = window as typeof window & {
      __MEDAL_DEBUG__?: { choose: (index: number) => void; selected: () => number; count: number }
    }
    debug.__MEDAL_DEBUG__ = { choose, selected: () => selected, count: medalAwards.length }
    return () => {
      delete debug.__MEDAL_DEBUG__
    }
  }, [active, selected])

  return (
    <group>
      <MedalShelf onSelect={() => {
        if (!activeId) selectStation(STATION.id)
      }} />

      {Z.map((z, index) => (
        <group key={`trophy-${z}`}>
          <group
            position={[5.72, 1.55, z]}
            {...cursor}
            onPointerDown={(event: ThreeEvent<PointerEvent>) => event.stopPropagation()}
            onPointerUp={(event: ThreeEvent<PointerEvent>) =>
              tapCall(event, () => choose(index))
            }
          >
            <mesh position={[0, 0.035, 0]}>
              <cylinderGeometry args={[0.075, 0.1, 0.07, 6]} />
              <meshStandardMaterial color="#3D2B1D" roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.13, 0]}>
              <cylinderGeometry args={[0.035, 0.045, 0.14, 12]} />
              <meshStandardMaterial
                color={selected === index && active ? COLORS.brightGold : COLORS.gold}
                roughness={0.35}
                metalness={0.42}
              />
            </mesh>
            <mesh position={[0, 0.26, 0]}>
              <coneGeometry args={[0.105, 0.15, 16, 1, true]} />
              <meshStandardMaterial
                color={selected === index && active ? COLORS.brightGold : COLORS.gold}
                roughness={0.32}
                metalness={0.45}
                side={2}
              />
            </mesh>
            <mesh position={[0, 0.15, 0]}>
              <sphereGeometry args={[0.14, 10, 8]} />
              <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        </group>
      ))}

      {Z.map((z, index) => {
        const awardIndex = 3 + index
        return (
          <group
            key={`medal-${z}`}
            position={[5.9, 2.08, z]}
            rotation-z={Math.PI / 2}
            {...cursor}
            onPointerDown={(event: ThreeEvent<PointerEvent>) => event.stopPropagation()}
            onPointerUp={(event: ThreeEvent<PointerEvent>) =>
              tapCall(event, () => choose(awardIndex))
            }
          >
            <mesh>
              <cylinderGeometry args={[0.11, 0.11, 0.012, 28]} />
              <meshStandardMaterial
                color={selected === awardIndex && active ? COLORS.brightGold : COLORS.gold}
                roughness={0.36}
                metalness={0.42}
              />
            </mesh>
            <mesh position={[0, 0.008, 0]}>
              <cylinderGeometry args={[0.082, 0.082, 0.012, 24]} />
              <meshStandardMaterial color={MEDAL_TONES[index]} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.03, 0]}>
              <sphereGeometry args={[0.13, 10, 8]} />
              <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        )
      })}

      {active ? (
        <group position={[5.48, 1.89, 1.8]} rotation-y={-Math.PI / 2}>
          <mesh>
            <planeGeometry args={[1.0, 0.62]} />
            <meshBasicMaterial map={card ?? undefined} toneMapped={false} />
          </mesh>
        </group>
      ) : null}

      {active ? (
        <InWorldControls
          position={[5.2, 1.82, 1.8]}
          width={1.16}
          height={0.72}
          rotationY={-Math.PI / 2}
          onClose={closeStation}
          onPrev={() => setSelected((selected + medalAwards.length - 1) % medalAwards.length)}
          onNext={() => setSelected((selected + 1) % medalAwards.length)}
          prevLabel="Previous award"
          nextLabel="Next award"
        />
      ) : null}
    </group>
  )
}

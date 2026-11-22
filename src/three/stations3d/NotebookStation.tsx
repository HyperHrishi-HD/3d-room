import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import {
  notebookExtraSpreads,
  notebookSections,
  type AlbumPageContent,
  type AlbumSpread,
} from '../../data/content'
import { stationById } from '../../data/stations'
import { useRoom } from '../../state/roomStore'
import PageBook, { type BookTab } from '../PageBook'
import { COLORS } from '../palette'
import { usePointerCursor } from '../usePointerCursor'
import { tapCall } from '../tapGuard'

const STATION = stationById('notebook')!

const letterPages: { page: AlbumPageContent; sectionHand?: string }[] = [
  ...notebookSections[0].entries.map((entry, index) => ({
    page: {
      title: entry.title,
      body: entry.body,
      art: entry.art,
    },
    sectionHand: index === 0 ? notebookSections[0].hand : undefined,
  })),
  ...notebookSections[1].entries.map((entry, index) => ({
    page: {
      title: entry.title,
      body: entry.body,
      art: entry.art,
    },
    sectionHand: index === 0 ? notebookSections[1].hand : undefined,
  })),
]

const letterSpreads: AlbumSpread[] = []
for (let index = 0; index < letterPages.length; index += 2) {
  const left = letterPages[index]
  const right = letterPages[index + 1]
  letterSpreads.push({
    left: { ...left.page, hand: left.sectionHand },
    right: right
      ? { ...right.page, hand: right.sectionHand }
      : { title: '', body: '' },
  })
}

const spreads: AlbumSpread[] = [...letterSpreads, ...notebookExtraSpreads]

const tabs: BookTab[] = [
  { label: 'Thank You', color: '#D8BE8A', page: 0 },
  { label: 'Promises', color: '#B9C2A5', page: 2 },
]

export default function NotebookStation() {
  const { activeId, closeStation, selectStation } = useRoom()
  const active = activeId === STATION.id
  const cursor = usePointerCursor()
  const hidden = useMemo(() => !active, [active])

  return (
    <group>
      {hidden ? (
        <group
          position={[5.55, 0.33, -2.05]}
          rotation={[0, -Math.PI / 2, 0]}
          {...cursor}
          onPointerDown={(event: ThreeEvent<PointerEvent>) => event.stopPropagation()}
          onPointerUp={(event: ThreeEvent<PointerEvent>) =>
            tapCall(event, () => {
              if (!activeId) selectStation(STATION.id)
            })
          }
        >
          <mesh>
            <boxGeometry args={[0.32, 0.08, 0.45]} />
            <meshStandardMaterial color="#6F4C36" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.042, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.4, 0.27]} />
            <meshStandardMaterial color="#C8B18C" roughness={0.9} />
          </mesh>
          <mesh position={[0.12, 0.045, 0]}>
            <boxGeometry args={[0.012, 0.005, 0.34]} />
            <meshStandardMaterial color={COLORS.gold} roughness={0.4} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.5, 0.2, 0.6]} />
            <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ) : (
        <PageBook
          stage="read"
          home={{ position: [3.92, 1.36, -1.15], rotation: [0, 0, 0] }}
          read={{ position: [3.92, 1.34, -1.15], rotation: [-0.03, -0.03, 0] }}
          width={0.7}
          height={0.82}
          cover={{
            title: 'The Notebook',
            number: 'notes',
            hand: 'the pages I keep adding to',
            background: '#5A3E2E',
            accent: '#D8BE8A',
          }}
          spreads={spreads}
          tabs={tabs}
          onClose={closeStation}
          spineColor="#3E2A1E"
        />
      )}
    </group>
  )
}

import { useEffect, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { albumBookCover, albums, type ArtTone } from '../../data/content'
import { albumStations, stationById } from '../../data/stations'
import { markVisited, useProgress } from '../../lib/progress'
import { playSfx } from '../../lib/sfx'
import { useRoom } from '../../state/roomStore'
import PageBook from '../PageBook'
import { COLORS } from '../palette'
import { makeCoverTexture, useFontVersion } from '../textEngine'
import { usePointerCursor } from '../usePointerCursor'
import { tapCall } from '../tapGuard'

const BACKGROUNDS: Record<ArtTone, string> = {
  rose: '#9B5358',
  leaf: '#4B6040',
  gold: '#A98434',
  plum: '#4C2E40',
  cream: '#B9A27F',
  blue: '#50767A',
}

const BOOK_HOME = {
  position: [5.53, 1.355, -2.8] as [number, number, number],
  rotation: [0, -Math.PI / 2, 0] as [number, number, number],
}

const BOOK_READ = {
  position: [4.0, 1.4, -2.8] as [number, number, number],
  rotation: [0, -Math.PI / 2, 0] as [number, number, number],
}

export default function AlbumStation() {
  const { activeId, closeStation, selectStation } = useRoom()
  const { visited } = useProgress()
  const activeStation = stationById(activeId)
  const albumActive = activeStation?.kind === 'album'
  const albumIndex = activeStation?.albumIndex ?? 0
  const album = albums[albumIndex]
  const version = useFontVersion()
  const cursor = usePointerCursor()

  const coverTexture = useMemo(
    () =>
      makeCoverTexture({
        title: albumBookCover.title,
        hand: albumBookCover.hand,
        background: BACKGROUNDS[albumBookCover.tone],
        accent: albumBookCover.accent,
        motif: 'four-dots',
      }),
    [version],
  )
  useEffect(() => () => coverTexture.dispose(), [coverTexture])

  const tabs = useMemo(
    () =>
      albums.map((entry) => ({
        label: entry.title,
        color: BACKGROUNDS[entry.coverTone],
        page: 0,
      })),
    [],
  )

  const chooseBook = () => {
    if (activeId) return
    // The shelves and the album cover both open the same book. Give this
    // entry point the same page-open sound as a cover tap in the reading view.
    playSfx('page-flip')
    const stations = albumStations()
    const next =
      stations.find((station) => !visited.includes(station.n)) ?? stations[0]
    selectStation(next.id, 'manual')
  }

  const switchAlbum = (index: number) => {
    const target = albumStations()[index]
    if (!target) return
    playSfx('page-flip')
    markVisited(target.n)
    selectStation(target.id, 'manual')
  }

  useEffect(() => {
    if (albumActive) playSfx('page-flip')
  }, [albumActive])

  return (
    <group>
      {albumActive ? (
        <PageBook
          stage="read"
          home={BOOK_HOME}
          read={BOOK_READ}
          width={0.9}
          height={0.92}
          cover={{
            title: albumBookCover.title,
            hand: albumBookCover.hand,
            background: BACKGROUNDS[albumBookCover.tone],
            accent: albumBookCover.accent,
          }}
          spreads={album.spreads}
          tabs={tabs}
          onTabSelect={switchAlbum}
          onClose={closeStation}
          controlRotationY={-Math.PI / 2}
          spineColor={COLORS.ink}
        />
      ) : (
        <group
          position={BOOK_HOME.position}
          rotation={BOOK_HOME.rotation}
          {...cursor}
          onPointerDown={(event: ThreeEvent<PointerEvent>) => event.stopPropagation()}
          onPointerUp={(event: ThreeEvent<PointerEvent>) => tapCall(event, chooseBook)}
        >
          <mesh>
            <boxGeometry args={[0.34, 0.46, 0.07]} />
            <meshStandardMaterial color={BACKGROUNDS[albumBookCover.tone]} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.037]}>
            <planeGeometry args={[0.3, 0.42]} />
            <meshBasicMaterial map={coverTexture} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.055]}>
            <planeGeometry args={[0.38, 0.5]} />
            <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <boxGeometry args={[0.54, 0.66, 0.14]} />
            <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  )
}

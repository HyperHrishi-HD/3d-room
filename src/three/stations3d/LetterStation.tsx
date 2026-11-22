import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { letterContent } from '../../data/content'
import { stationById } from '../../data/stations'
import { playSfx } from '../../lib/sfx'
import { useRoom } from '../../state/roomStore'
import InWorldControls from '../InWorldControls'
import { COLORS } from '../palette'
import { makeCanvasTexture, makeTextTexture, paginate, useFontVersion } from '../textEngine'
import { usePointerCursor } from '../usePointerCursor'
import { tapCall } from '../tapGuard'

const STATION = stationById('letter')!
const PAPER_WIDTH = 0.84
const PAPER_HEIGHT = 0.86

// The book's float between the desk and the reading pose runs on the SAME
// 1,100 ms clock and the SAME smoothstep easing as the camera flight, and
// starts on the same state change, so book and camera arrive together
// instead of the book outrunning the view.
const FLIGHT_MS = 1100
const HOME_POSE = {
  position: new THREE.Vector3(5.2, 0.852, -3.32),
  rotation: new THREE.Euler(-Math.PI / 2, 0, 0.28),
}
const READ_POSE = {
  position: new THREE.Vector3(...STATION.anchor),
  rotation: new THREE.Euler(-0.07, -0.13, 0),
}

export default function LetterStation() {
  const { activeId, closeStation, selectStation } = useRoom()
  const active = activeId === STATION.id
  const [page, setPage] = useState(0)
  const version = useFontVersion()
  const cursor = usePointerCursor()
  const flap = useRef<THREE.Group>(null)
  const group = useRef<THREE.Group>(null)
  const flight = useRef<{ start: number; toRead: boolean } | null>(null)
  const reduced = useRef(false)
  const homeQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(HOME_POSE.rotation),
    [],
  )
  const readQuat = useMemo(
    () => new THREE.Quaternion().setFromEuler(READ_POSE.rotation),
    [],
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.current = media.matches
    const onChange = (event: MediaQueryListEvent) => {
      reduced.current = event.matches
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    // Starts the same frame the camera's goal changes, so both flights share
    // one clock. Closing is the exact reverse of opening.
    flight.current = { start: performance.now(), toRead: active }
  }, [active])

  useFrame(() => {
    const book = group.current
    const current = flight.current
    if (!book || !current) return
    if (reduced.current) {
      book.position.copy(current.toRead ? READ_POSE.position : HOME_POSE.position)
      book.quaternion.copy(current.toRead ? readQuat : homeQuat)
      return
    }
    const raw = Math.min(1, (performance.now() - current.start) / FLIGHT_MS)
    const eased = raw * raw * (3 - 2 * raw)
    const t = current.toRead ? eased : 1 - eased
    // The path arcs over the desk, keeping clearance from the tabletop.
    const arc = Math.sin(Math.PI * eased) * 0.05
    book.position.set(
      HOME_POSE.position.x + (READ_POSE.position.x - HOME_POSE.position.x) * t,
      HOME_POSE.position.y + (READ_POSE.position.y - HOME_POSE.position.y) * t + arc,
      HOME_POSE.position.z + (READ_POSE.position.z - HOME_POSE.position.z) * t,
    )
    book.quaternion.slerpQuaternions(homeQuat, readQuat, t)
  })

  const pages = useMemo(() => {
    const raw = paginate(letterContent.paragraphs, {
      width: 768,
      height: 1100,
      padding: 82,
      fontSize: 28,
      lineHeight: 1.5,
    })
    return raw.map((body, index) => {
      const first = index === 0
      const last = index === raw.length - 1
      return makeTextTexture({
        width: 768,
        height: 1100,
        padding: 70,
        background: '#F7F0DF',
        border: 'paper',
        blocks: [
          ...(first
            ? [
                {
                  text: letterContent.greeting,
                  font: 'hand' as const,
                  size: 50,
                  gapAfter: 14,
                },
              ]
            : []),
          { text: body, font: 'body' as const, size: 28, lineHeight: 1.5, gapAfter: 14 },
          ...(last
            ? [
                { type: 'rule' as const, gapAfter: 12 },
                { text: letterContent.sign, font: 'hand' as const, size: 32, align: 'right' as const },
              ]
            : []),
        ],
      })
    })
  }, [version])

  useEffect(() => () => pages.forEach((texture) => texture.dispose()), [pages])
  useEffect(() => {
    if (page > pages.length - 1) setPage(0)
  }, [page, pages.length])
  useEffect(() => {
    if (!active) setPage(0)
    else playSfx('letter-open')
  }, [active])

  const panelTextures = useMemo(() => {
    const pageTexture = pages[page]
    if (!pageTexture) return null
    const top = pageTexture.clone()
    const bottom = pageTexture.clone()
    top.repeat.set(1, 0.5)
    top.offset.set(0, 0.5)
    bottom.repeat.set(1, 0.5)
    bottom.offset.set(0, 0)
    top.needsUpdate = true
    bottom.needsUpdate = true
    return { top, bottom }
  }, [page, pages])

  useEffect(
    () => () => {
      panelTextures?.top.dispose()
      panelTextures?.bottom.dispose()
    },
    [panelTextures],
  )

  useFrame((_, delta) => {
    if (!flap.current) return
    flap.current.rotation.x = THREE.MathUtils.damp(
      flap.current.rotation.x,
      active ? 0 : -Math.PI,
      6,
      Math.min(delta, 0.05),
    )
  })

  const closedTexture = useMemo(
    () =>
      makeCanvasTexture(600, 800, (ctx) => {
        ctx.fillStyle = '#EFE6D4'
        ctx.fillRect(0, 0, 600, 800)
        ctx.strokeStyle = 'rgba(201,162,75,0.6)'
        ctx.lineWidth = 2
        ctx.strokeRect(30, 30, 540, 740)
        ctx.strokeStyle = 'rgba(90,67,48,0.22)'
        ctx.beginPath()
        ctx.moveTo(300, 46)
        ctx.lineTo(430, 250)
        ctx.lineTo(300, 360)
        ctx.lineTo(170, 250)
        ctx.closePath()
        ctx.stroke()
        ctx.fillStyle = '#5A4330'
        ctx.font = "600 48px Caveat, cursive"
        ctx.textAlign = 'center'
        ctx.fillText('for you', 300, 470)
        ctx.fillStyle = 'rgba(42,33,24,0.5)'
        ctx.font = "400 24px Georgia, serif"
        ctx.fillText('open slowly', 300, 518)
        ctx.fillStyle = COLORS.gold
        ctx.beginPath()
        ctx.arc(300, 660, 12, 0, Math.PI * 2)
        ctx.fill()
      }),
    [],
  )
  useEffect(() => () => closedTexture.dispose(), [closedTexture])

  return (
    <>
      <group ref={group} position={[5.2, 0.852, -3.32]} rotation={[-Math.PI / 2, 0, 0.28]}>
      {!active ? (
        <group
          {...cursor}
          onPointerDown={(event: ThreeEvent<PointerEvent>) => event.stopPropagation()}
          onPointerUp={(event: ThreeEvent<PointerEvent>) =>
            tapCall(event, () => {
              if (!activeId) selectStation(STATION.id)
            })
          }
        >
          <mesh>
            <boxGeometry args={[0.56, 0.72, 0.018]} />
            <meshStandardMaterial color="#EFE6D4" roughness={0.92} />
          </mesh>
          <mesh position={[0, 0, 0.011]}>
            <planeGeometry args={[0.54, 0.7]} />
            <meshBasicMaterial map={closedTexture} toneMapped={false} />
          </mesh>
        </group>
      ) : null}

      {active ? (
        <group>
          <mesh position={[0, 0, -0.012]}>
            <boxGeometry args={[PAPER_WIDTH + 0.02, PAPER_HEIGHT + 0.02, 0.02]} />
            <meshStandardMaterial color="#E7DBC5" roughness={0.92} />
          </mesh>
          <mesh position={[0, PAPER_HEIGHT / 4, 0.002]}>
            <planeGeometry args={[PAPER_WIDTH, PAPER_HEIGHT / 2]} />
            <meshBasicMaterial map={panelTextures?.top ?? null} toneMapped={false} />
          </mesh>
          <group ref={flap} position={[0, 0, 0.006]}>
            <mesh position={[0, -PAPER_HEIGHT / 4, 0]}>
              <planeGeometry args={[PAPER_WIDTH, PAPER_HEIGHT / 2]} />
              <meshBasicMaterial map={panelTextures?.bottom ?? null} toneMapped={false} />
            </mesh>
          </group>
        </group>
      ) : null}
    </group>

      {active ? (
        <InWorldControls
          position={STATION.anchor}
          width={PAPER_WIDTH}
          height={PAPER_HEIGHT + 0.18}
          onClose={closeStation}
          onPrev={() => setPage((value) => Math.max(0, value - 1))}
          onNext={() =>
            setPage((value) => {
              if (value >= pages.length - 1) {
                closeStation()
                return value
              }
              return value + 1
            })
          }
          prevDisabled={page === 0}
          nextIcon={page >= pages.length - 1 ? 'check' : 'next'}
          prevLabel="Previous part of the letter"
          nextLabel={page >= pages.length - 1 ? 'Done with the letter' : 'Next part of the letter'}
        />
      ) : null}
    </>
  )
}

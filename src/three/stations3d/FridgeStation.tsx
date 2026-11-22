import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { fridgePairs, fridgeQuestions, type ArtSpec } from '../../data/content'
import { stationById } from '../../data/stations'
import { playSfx } from '../../lib/sfx'
import { useRoom } from '../../state/roomStore'
import InWorldControls from '../InWorldControls'
import { COLORS } from '../palette'
import { makeCanvasTexture, useArtTexture, useFontVersion, useTextTexture } from '../textEngine'
import { usePointerCursor } from '../usePointerCursor'

const STATION = stationById('fridge')!
const HANDLE_X = 0.28
const HANDLE_RADIUS = 0.022
const GAME_Z = 0.535
const TILE_SIZE = 0.105
const COLUMN_STEP = 0.103
const COLUMNS = [-1.5, -0.5, 0.5, 1.5].map((column) => column * COLUMN_STEP)
const ROWS = [0.7, 0.87, 1.04]
const CARD_WIDTH = 0.44
const CARD_HEIGHT = 0.78
const CARD_Y = 0.93
const CARD_X = -0.014
const TAB_Y = [1.47, 1.37]

type TileData = {
  id: string
  label: string
  caption: string
  tone: string
  photo: ArtSpec
  key: string
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  let seed = 19
  for (let index = copy.length - 1; index > 0; index -= 1) {
    seed = (seed * 16807) % 2147483647
    const target = seed % (index + 1)
    const swap = copy[index]
    copy[index] = copy[target]
    copy[target] = swap
  }
  return copy
}

function MemoryTile({
  tile,
  index,
  faceUp,
  matched,
  onFlip,
}: {
  tile: TileData
  index: number
  faceUp: boolean
  matched: boolean
  onFlip: (index: number) => void
}) {
  const group = useRef<THREE.Group>(null)
  const cursor = usePointerCursor()
  const photo = useArtTexture(tile.photo, 282, 224)
  const texture = useMemo(
    () =>
      makeCanvasTexture(300, 300, (ctx) => {
        ctx.fillStyle = tile.tone
        ctx.fillRect(0, 0, 300, 300)
        ctx.drawImage(photo.image as CanvasImageSource, 9, 9, 282, 224)
        ctx.strokeStyle = 'rgba(245,239,226,0.62)'
        ctx.lineWidth = 3
        ctx.strokeRect(9, 9, 282, 224)
        ctx.fillStyle = 'rgba(245,239,226,0.94)'
        ctx.fillRect(9, 233, 282, 58)
        ctx.fillStyle = '#2A2118'
        ctx.font = "600 28px Caveat, cursive"
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(tile.caption, 150, 261)
      }),
    [photo, tile],
  )
  useEffect(() => () => texture.dispose(), [texture])

  useFrame((_, delta) => {
    if (!group.current) return
    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      faceUp || matched ? Math.PI : 0,
      8,
      Math.min(delta, 0.05),
    )
  })

  const x = COLUMNS[index % 4]
  const y = ROWS[Math.floor(index / 4)]

  return (
    <group
      ref={group}
      position={[x, y, GAME_Z]}
      {...cursor}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()
        onFlip(index)
      }}
    >
      <mesh position={[0, 0, 0.007]}>
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
        <meshStandardMaterial
          color={matched ? '#D8BE8A' : '#E8D8B9'}
          roughness={0.7}
          emissive={matched ? '#4A3511' : '#000000'}
          emissiveIntensity={matched ? 0.35 : 0}
        />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[TILE_SIZE - 0.01, TILE_SIZE - 0.01]} />
        <meshBasicMaterial color="#F5EFE2" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.008]} rotation-y={Math.PI}>
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[TILE_SIZE + 0.01, TILE_SIZE + 0.01, 0.025]} />
        <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

type RowState = 'idle' | 'correct' | 'wrong'

/**
 * One tappable quiz answer: a letter disc (A/B/C) plus the answer text, drawn
 * as its own canvas texture with idle / hover / correct / wrong treatments.
 * Hover lifts the row toward the viewer; a wrong pick shakes it briefly.
 */
function AnswerRow({
  index,
  text,
  state,
  onPick,
}: {
  index: number
  text: string
  state: RowState
  onPick: () => void
}) {
  const rowY = [0.87, 0.735, 0.6][index]
  const [hovered, setHovered] = useState(false)
  const group = useRef<THREE.Group>(null)
  const shakeStart = useRef(0)
  const version = useFontVersion()
  const cursor = usePointerCursor()

  useEffect(() => {
    if (state === 'wrong') shakeStart.current = performance.now()
  }, [state])

  const texture = useMemo(
    () =>
      makeCanvasTexture(1024, 270, (ctx) => {
        const background =
          state === 'correct'
            ? '#E7EEDD'
            : state === 'wrong'
              ? '#F2DFD8'
              : hovered
                ? '#FBF3E1'
                : '#F7EFDF'
        roundRectPath(ctx, 10, 10, 1004, 250, 28)
        ctx.fillStyle = background
        ctx.fill()
        ctx.strokeStyle =
          hovered || state !== 'idle' ? 'rgba(201,162,75,0.95)' : 'rgba(201,162,75,0.45)'
        ctx.lineWidth = hovered ? 10 : 5
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(122, 135, 72, 0, Math.PI * 2)
        ctx.fillStyle = state === 'idle' ? '#C9A24B' : state === 'correct' ? '#7B9857' : '#B06060'
        ctx.fill()
        ctx.fillStyle = '#2A2118'
        ctx.font = "600 74px Georgia, 'Times New Roman', serif"
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(state === 'correct' ? '✓' : String.fromCharCode(65 + index), 122, 140)
        ctx.textAlign = 'left'
        ctx.font = "500 46px Georgia, 'Times New Roman', serif"
        ctx.fillStyle =
          state === 'correct'
            ? '#2F4A26'
            : state === 'wrong'
              ? '#7A2E2E'
              : 'rgba(42,33,24,0.85)'
        ctx.fillText(text, 236, 141)
      }),
    [hovered, index, state, text, version],
  )
  useEffect(() => () => texture.dispose(), [texture])

  useFrame((_, delta) => {
    if (!group.current) return
    const targetZ = GAME_Z + (hovered && state === 'idle' ? 0.013 : 0.006)
    group.current.position.z = THREE.MathUtils.damp(
      group.current.position.z,
      targetZ,
      10,
      Math.min(delta, 0.05),
    )
    if (state === 'wrong' && shakeStart.current > 0) {
      const t = (performance.now() - shakeStart.current) / 450
      group.current.rotation.z = t < 1 ? Math.sin(t * Math.PI * 6) * 0.02 * (1 - t) : 0
    } else {
      group.current.rotation.z = 0
    }
  })

  return (
    <group
      ref={group}
      position={[CARD_X, rowY, GAME_Z + 0.006]}
      {...cursor}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()
        onPick()
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh renderOrder={12}>
        <planeGeometry args={[0.4, 0.105]} />
        <meshBasicMaterial map={texture ?? undefined} toneMapped={false} transparent />
      </mesh>
      <mesh position={[0, 0, 0.012]} renderOrder={13}>
        <planeGeometry args={[0.43, 0.13]} />
        <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/**
 * The PAIRS / QUIZ tabs. The active tab sits physically raised off the door,
 * the inactive one rests flush — the same raised-tab treatment on both.
 */
function GameTab({
  y,
  label,
  activeTab,
  texture,
  onSelect,
}: {
  y: number
  label: string
  activeTab: boolean
  texture: THREE.CanvasTexture | null
  onSelect: () => void
}) {
  const ref = useRef<THREE.Group>(null)
  const cursor = usePointerCursor()
  useFrame((_, delta) => {
    if (!ref.current) return
    const target = activeTab ? 0.02 : 0
    ref.current.position.z = THREE.MathUtils.damp(
      ref.current.position.z,
      GAME_Z + target,
      10,
      Math.min(delta, 0.05),
    )
  })
  return (
    <group
      ref={ref}
      position={[0, y, GAME_Z]}
      {...cursor}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()
        onSelect()
      }}
    >
      <mesh>
        <boxGeometry args={[0.24, 0.065, 0.018]} />
        <meshStandardMaterial color={activeTab ? '#C9A24B' : '#D8C7A8'} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.011]}>
        <planeGeometry args={[0.22, 0.05]} />
        <meshBasicMaterial map={texture ?? undefined} toneMapped={false} />
      </mesh>
      <group userData={{ label }} />
    </group>
  )
}

export default function FridgeStation() {
  const {
    activeId,
    closeStation,
    fridgeScore,
    recordMatch,
    recordQuiz,
    resetFridgeScore,
    selectStation,
  } = useRoom()
  const active = activeId === STATION.id
  const [mode, setMode] = useState<'pairs' | 'quiz'>('pairs')
  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<Set<string>>(() => new Set())
  const [question, setQuestion] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const timers = useRef<number[]>([])
  const door = useRef<THREE.Group>(null)
  const { camera, size } = useThree()

  const deck = useMemo<TileData[]>(() => {
    const tones = ['#D8A0A0', '#A9BE93', '#A9C7CC', '#D9C08A', '#C0A2B4', '#E0D3B7']
    return shuffle(
      fridgePairs.flatMap((pair, index) => [
        {
          id: pair.id,
          label: pair.label,
          caption: pair.caption,
          photo: pair.photo,
          tone: tones[index],
          key: `${pair.id}-a`,
        },
        {
          id: pair.id,
          label: pair.label,
          caption: pair.caption,
          photo: pair.photo,
          tone: tones[index],
          key: `${pair.id}-b`,
        },
      ]),
    )
  }, [])

  const pairsTexture = useTextTexture({
    width: 300,
    height: 72,
    padding: 8,
    background: '#F0E4D0',
    border: 'none',
    blocks: [
      { text: 'PAIRS', font: 'body', size: 20, align: 'center', color: '#5A4330', letterSpacing: 2 },
    ],
  })
  const quizButtonTexture = useTextTexture({
    width: 300,
    height: 72,
    padding: 8,
    background: '#F0E4D0',
    border: 'none',
    blocks: [
      { text: 'QUIZ', font: 'body', size: 20, align: 'center', color: '#5A4330', letterSpacing: 2 },
    ],
  })

  const scoreTexture = useTextTexture({
    width: 640,
    height: 96,
    padding: 10,
    background: '#F0E4D0',
    border: 'none',
    blocks: [
      {
        text: `pairs ${fridgeScore.matches}  ·  quiz ${fridgeScore.quiz}`,
        font: 'hand',
        size: 34,
        align: 'center',
        color: '#5A4330',
      },
    ],
  })

  const quiz = fridgeQuestions[question]
  const quizDotStep = Math.min(0.05, 0.16 / Math.max(1, fridgeQuestions.length - 1))
  const complete = mode === 'pairs' && matched.size === fridgePairs.length
  const quizDone = mode === 'quiz' && question >= fridgeQuestions.length

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const debug = window as typeof window & {
      __FRIDGE_DEBUG__?: {
        setMode: (next: 'pairs' | 'quiz') => void
        measure: () => unknown
        pick: (choice: number) => void
        picked: () => number | null
      }
    }
    const measure = () => {
      const root = door.current
      if (!root) return null
      root.updateWorldMatrix(true, true)
      camera.updateMatrixWorld()
      const projectBox = (
        center: [number, number, number],
        dimensions: [number, number, number],
      ) => {
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const x of [-1, 1]) {
          for (const y of [-1, 1]) {
            for (const z of [-1, 1]) {
              const point = new THREE.Vector3(
                center[0] + (x * dimensions[0]) / 2,
                center[1] + (y * dimensions[1]) / 2,
                center[2] + (z * dimensions[2]) / 2,
              )
              root.localToWorld(point)
              point.project(camera)
              const screenX = ((point.x + 1) / 2) * size.width
              const screenY = ((1 - point.y) / 2) * size.height
              minX = Math.min(minX, screenX)
              maxX = Math.max(maxX, screenX)
              minY = Math.min(minY, screenY)
              maxY = Math.max(maxY, screenY)
            }
          }
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
      }

      const handles = {
        left: projectBox([-HANDLE_X, 1.48, 0.485], [HANDLE_RADIUS, 0.34, 0.05]),
        right: projectBox([HANDLE_X, 1.48, 0.485], [HANDLE_RADIUS, 0.34, 0.05]),
      }
      const tiles = deck.map((tile, index) => ({
        key: tile.key,
        box: projectBox(
          [COLUMNS[index % 4], ROWS[Math.floor(index / 4)], GAME_Z],
          [TILE_SIZE, TILE_SIZE, 0.01],
        ),
      }))
      const tabs = [
        { label: 'PAIRS', box: projectBox([0, TAB_Y[0], GAME_Z], [0.24, 0.065, 0.01]) },
        { label: 'QUIZ', box: projectBox([0, TAB_Y[1], GAME_Z], [0.24, 0.065, 0.01]) },
      ]
      const close = (window as typeof window & {
        __DISC_METRICS__?: Record<string, { x: number; y: number; width: number; height: number }>
      }).__DISC_METRICS__?.['fridge-close']

      return {
        active,
        mode,
        size: { width: size.width, height: size.height },
        handles,
        tiles: mode === 'pairs' && !complete ? tiles : [],
        tabs,
        score: projectBox([0, 0.52, GAME_Z], [0.36, 0.075, 0.01]),
        reset:
          active && (complete || quizDone)
            ? projectBox([CARD_X, 0.92 - 0.255, GAME_Z + 0.072], [0.22, 0.047, 0.01])
            : null,
        card:
          active && mode === 'quiz' && !quizDone
            ? projectBox([CARD_X, CARD_Y, GAME_Z], [CARD_WIDTH, CARD_HEIGHT, 0.01])
            : active && mode === 'pairs' && complete
              ? projectBox([CARD_X, 0.92, GAME_Z + 0.06], [0.5, 0.4, 0.01])
              : null,
        close: close ?? null,
      }
    }
    debug.__FRIDGE_DEBUG__ = {
      setMode,
      measure,
      // QA hooks: force a correct or wrong pick on the current question.
      pick: (choice: number) => answer(choice),
      picked: () => picked,
    }
    return () => {
      delete debug.__FRIDGE_DEBUG__
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, camera, deck, mode, quizDone, complete, size.height, size.width])
  // Quiz card body: eyebrow, gold rule, and the prompt in large display type
  // on a >=1024 px canvas. The answers are separate tappable rows below.
  const quizTexture = useTextTexture(
    active && mode === 'quiz' && !quizDone && quiz
      ? {
          width: 1024,
          height: 1816,
          padding: 64,
          background: '#F4EAD8',
          border: 'gold',
          blocks: [
            {
              text: `QUESTION ${question + 1} OF ${fridgeQuestions.length}`,
              font: 'body',
              size: 40,
              color: '#9B7732',
              letterSpacing: 4,
              gapAfter: 22,
            },
            {
              type: 'rule',
              color: 'rgba(201,162,75,0.65)',
              gapAfter: 30,
            },
            {
              text: quiz.prompt,
              font: 'display',
              size: 96,
              lineHeight: 1.16,
            },
          ],
        }
      : null,
  )

  const resultTexture = useTextTexture(
    active && (complete || quizDone)
      ? {
          width: 640,
          height: 500,
          padding: 48,
          background: '#F4EAD8',
          border: 'gold',
          blocks: [
            {
              text: complete ? 'THE DOOR REMEMBERS' : 'THE MONITOR IS READY',
              font: 'body',
              size: 24,
              color: '#9B7732',
              align: 'center',
              letterSpacing: 3,
              gapAfter: 18,
            },
            { text: complete ? 'All six pairs.' : 'That is the whole quiz.', font: 'display', size: 52, align: 'center', gapAfter: 18 },
            {
              text: complete
                ? 'You found every one. Play again whenever you like.'
                : 'The little monitor is waiting on the table if you want a longer answer.',
              font: 'body',
              size: 25,
              align: 'center',
              lineHeight: 1.4,
            },
          ],
        }
      : null,
  )

  const resetTexture = useTextTexture(
    active && (complete || quizDone)
      ? {
          width: 360,
          height: 76,
          padding: 10,
          background: '#2A2118',
          blocks: [
            {
              text: 'Play again',
              font: 'hand',
              size: 34,
              color: '#F5EFE2',
              align: 'center',
            },
          ],
        }
      : null,
  )

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  useEffect(() => {
    setFlipped([])
    setMatched(new Set())
    setQuestion(0)
    setPicked(null)
  }, [mode])

  useEffect(() => {
    if (!active) {
      setFlipped([])
      setPicked(null)
    }
  }, [active])

  const flip = (index: number) => {
    playSfx('fridge-pop')
    if (!activeId) {
      selectStation(STATION.id)
      return
    }
    if (mode !== 'pairs' || complete) return
    if (flipped.includes(index) || matched.has(deck[index].id) || flipped.length >= 2) return
    const next = [...flipped, index]
    setFlipped(next)
    if (next.length === 2) {
      const first = deck[next[0]]
      const second = deck[next[1]]
      if (first.id === second.id) {
        recordMatch()
        // The pop above is still inside the shared 120 ms gap.
        window.setTimeout(() => playSfx('success-soft'), 160)
        const timer = window.setTimeout(() => {
          setMatched((current) => new Set(current).add(first.id))
          setFlipped([])
        }, 380)
        timers.current.push(timer)
      } else {
        const timer = window.setTimeout(() => setFlipped([]), 850)
        timers.current.push(timer)
      }
    }
  }

  const answer = (choice: number) => {
    if (picked !== null || !quiz) return
    playSfx('fridge-pop')
    setPicked(choice)
    if (choice === quiz.answer) recordQuiz()
    const timer = window.setTimeout(() => {
      setQuestion((value) => value + 1)
      setPicked(null)
    }, 1150)
    timers.current.push(timer)
  }

  return (
    <>
    <group ref={door} position={[-5.55, 0, -1.15]} rotation-y={Math.PI / 2}>
      {mode === 'pairs' && !complete
        ? deck.map((tile, index) => (
            <MemoryTile
              key={tile.key}
              tile={tile}
              index={index}
              faceUp={flipped.includes(index)}
              matched={matched.has(tile.id)}
              onFlip={flip}
            />
          ))
        : null}

      {mode === 'quiz' && !quizDone ? (
        <>
          <mesh position={[CARD_X, CARD_Y, GAME_Z]} renderOrder={11}>
            <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
            <meshBasicMaterial map={quizTexture ?? undefined} toneMapped={false} />
          </mesh>
          {quiz && picked === null
            ? quiz.options.map((option, index) => (
                <AnswerRow
                  key={option}
                  index={index}
                  text={option}
                  state="idle"
                  onPick={() => {
                    if (!activeId) {
                      selectStation(STATION.id)
                      return
                    }
                    answer(index)
                  }}
                />
              ))
            : null}
          {quiz && picked !== null
            ? quiz.options.map((option, index) => (
                <AnswerRow
                  key={option}
                  index={index}
                  text={option}
                  state={index === quiz.answer ? 'correct' : index === picked ? 'wrong' : 'idle'}
                  onPick={() => undefined}
                />
              ))
            : null}
          <group position={[CARD_X, 0.505, GAME_Z + 0.004]}>
            {fridgeQuestions.map((_, index) => (
              <mesh
                key={index}
                position={[(index - (fridgeQuestions.length - 1) / 2) * quizDotStep, 0, 0]}
              >
                <circleGeometry args={[0.011, 16]} />
                <meshBasicMaterial
                  color={
                    index < question
                      ? COLORS.gold
                      : index === question
                        ? COLORS.brightGold
                        : 'rgba(245,239,226,0.32)'
                  }
                  toneMapped={false}
                />
              </mesh>
            ))}
          </group>
        </>
      ) : null}

      <GameTab
        y={TAB_Y[0]}
        label="PAIRS"
        activeTab={mode === 'pairs'}
        texture={pairsTexture}
        onSelect={() => {
          if (!activeId) selectStation(STATION.id)
          else setMode('pairs')
        }}
      />

      <GameTab
        y={TAB_Y[1]}
        label="QUIZ"
        activeTab={mode === 'quiz'}
        texture={quizButtonTexture}
        onSelect={() => {
          if (!activeId) selectStation(STATION.id)
          else setMode('quiz')
        }}
      />

      <mesh position={[0, 0.52, GAME_Z]}>
        <planeGeometry args={[0.36, 0.075]} />
        <meshBasicMaterial map={scoreTexture ?? undefined} toneMapped={false} />
      </mesh>

      {active && (complete || quizDone) ? (
        <group position={[CARD_X, 0.92, GAME_Z + 0.06]}>
          <mesh renderOrder={22}>
            <planeGeometry args={[0.5, 0.4]} />
            <meshBasicMaterial
              map={resultTexture ?? undefined}
              toneMapped={false}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
          {complete || quizDone ? (
            <group
              position={[0, -0.255, 0.012]}
              onPointerDown={(event: ThreeEvent<PointerEvent>) => {
                event.stopPropagation()
                setMatched(new Set())
                setFlipped([])
                setQuestion(0)
                setPicked(null)
                resetFridgeScore()
              }}
            >
              <mesh renderOrder={23}>
                <planeGeometry args={[0.22, 0.047]} />
                <meshBasicMaterial
                  map={resetTexture ?? undefined}
                  toneMapped={false}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
            </group>
          ) : null}
        </group>
      ) : null}

    </group>
    {active ? (
      <InWorldControls
        position={STATION.anchor}
        width={0.78}
        height={1.25}
        onClose={closeStation}
        hidePrev
        hideNext
        closeLabel="Close the fridge door"
        debugKey="fridge"
      />
    ) : null}
    </>
  )
}

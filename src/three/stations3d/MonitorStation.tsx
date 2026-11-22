import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { type ThreeEvent } from '@react-three/fiber'
import { monitorContent } from '../../data/content'
import { stationById } from '../../data/stations'
import { fetchMonitorAnswer } from '../../lib/monitor'
import { playSfx } from '../../lib/sfx'
import { useRoom } from '../../state/roomStore'
import InWorldControls, { DiscButton } from '../InWorldControls'
import { useFontVersion } from '../textEngine'
import { usePointerCursor } from '../usePointerCursor'
import { tapCall } from '../tapGuard'

const STATION = stationById('ai')!

type ChatMessage = { role: 'monitor' | 'user'; text: string }

type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

function speechConstructor(): (new () => SpeechRecognitionLike) | null {
  const candidate = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
    // A single unbroken word can still be wider than the screen. Break it so
    // typed questions cannot escape the monitor's inner text column.
    while (!line.includes(' ') && ctx.measureText(line).width > maxWidth) {
      let cut = line.length - 1
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut -= 1
      lines.push(line.slice(0, cut))
      line = line.slice(cut)
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawScreen(
  ctx: CanvasRenderingContext2D,
  messages: ChatMessage[],
  active: boolean,
  listening: boolean,
) {
  const width = 1024
  const height = 640
  ctx.fillStyle = '#15100D'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#221914'
  ctx.fillRect(0, 0, width, 72)
  ctx.fillStyle = '#D8BE8A'
  ctx.font = "600 30px Caveat, cursive"
  ctx.textAlign = 'left'
  ctx.fillText(monitorContent.title, 36, 45)
  ctx.font = "400 18px Georgia, serif"
  ctx.fillStyle = listening ? '#D98B72' : 'rgba(245,239,226,0.45)'
  ctx.textAlign = 'right'
  ctx.fillText(listening ? 'listening' : active ? 'awake' : 'asleep', 988, 43)

  if (!active) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#F5EFE2'
    ctx.font = "500 42px Caveat, cursive"
    ctx.fillText('Ask the room', width / 2, 242)
    ctx.fillStyle = 'rgba(245,239,226,0.5)'
    ctx.font = "400 20px Georgia, serif"
    ctx.fillText(monitorContent.standby, width / 2, 288, 760)
    ctx.strokeStyle = 'rgba(201,162,75,0.55)'
    ctx.lineWidth = 2
    ctx.strokeRect(30, 30, 964, 580)
    ctx.fillStyle = '#C9A24B'
    ctx.beginPath()
    ctx.arc(width / 2, 360, 8, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  let y = 106
  ctx.textAlign = 'left'
  if (messages.length === 0) {
    ctx.fillStyle = 'rgba(245,239,226,0.65)'
    ctx.font = "400 27px Georgia, serif"
    ctx.fillText(monitorContent.intro, 42, y + 4, 910)
    y += 44
  }
  const shown = messages.slice(-4)
  const innerPadding = 22
  const textMaxWidth = 690
  const bubbleMaxWidth = textMaxWidth + innerPadding * 2
  for (const message of shown) {
    const mine = message.role === 'user'
    ctx.font = mine ? "400 28px Georgia, serif" : "400 30px Georgia, serif"
    const lines = wrap(ctx, message.text, textMaxWidth)
    const boxHeight = lines.length * 40 + 36
    const measured = Math.max(0, ...lines.map((line) => ctx.measureText(line).width))
    const boxWidth = Math.min(bubbleMaxWidth, 230 + measured)
    const x = mine ? width - 36 - boxWidth : 36
    ctx.fillStyle = mine ? '#5B4630' : '#2D231B'
    ctx.beginPath()
    ctx.roundRect(x, y, boxWidth, boxHeight, 14)
    ctx.fill()
    ctx.fillStyle = mine ? '#F5EFE2' : '#E5D5BC'
    ctx.fillText(lines[0] ?? '', x + innerPadding, y + 36, textMaxWidth)
    for (let index = 1; index < lines.length; index += 1) {
      ctx.fillText(lines[index], x + innerPadding, y + 36 + index * 40, textMaxWidth)
    }
    y += boxHeight + 18
  }
  if (messages.length > 0 && messages[messages.length - 1].text === '') {
    ctx.fillStyle = 'rgba(245,239,226,0.42)'
    ctx.font = "400 18px Georgia, serif"
    ctx.fillText('…', 54, y + 20)
  }

  const chips = monitorContent.chips
  const chipWidth = 294
  chips.forEach((chip, index) => {
    const x = 36 + index * (chipWidth + 26)
    const chipY = height - 112
    ctx.fillStyle = 'rgba(201,162,75,0.14)'
    ctx.strokeStyle = 'rgba(201,162,75,0.45)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(x, chipY, chipWidth, 76, 12)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#EAD8BA'
    ctx.font = "400 20px Georgia, serif"
    const lines = wrap(ctx, chip.question, chipWidth - 34)
    ctx.fillText(lines[0] ?? '', x + 17, chipY + 34)
    if (lines[1]) ctx.fillText(lines[1], x + 17, chipY + 60)
  })

  ctx.fillStyle = 'rgba(245,239,226,0.32)'
  ctx.font = "400 16px Georgia, serif"
  ctx.textAlign = 'right'
  ctx.fillText('or type below', width - 36, height - 22)
}

export default function MonitorStation() {
  const {
    activeId,
    askMonitor,
    closeStation,
    monitorRequest,
    selectStation,
  } = useRoom()
  const active = activeId === STATION.id
  const version = useFontVersion()
  const cursor = usePointerCursor()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [listening, setListening] = useState(false)
  const typingTimer = useRef<number | null>(null)
  const lastTypeTick = useRef(0)
  const handled = useRef(0)
  const activeRef = useRef(active)
  const requestId = useRef(0)
  const bus = useRef<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture } | null>(null)

  const screen = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 640
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    bus.current = { canvas, ctx, texture }
    return texture
  }, [])
  useEffect(() => () => screen?.dispose(), [screen])

  useEffect(() => {
    const data = bus.current
    if (!data) return
    drawScreen(data.ctx, messages, active, listening)
    data.texture.needsUpdate = true
  }, [active, listening, messages, screen, version])

  useEffect(() => {
    activeRef.current = active
    if (!active) {
      requestId.current += 1
      setMessages([])
      if (typingTimer.current) window.clearInterval(typingTimer.current)
      typingTimer.current = null
    }
  }, [active])

  const ask = useCallback(async (question: string) => {
    const clean = question.trim()
    if (!clean) return
    playSfx('ui-click')
    if (typingTimer.current) window.clearInterval(typingTimer.current)
    const request = ++requestId.current
    setMessages((current) => [
      ...current,
      { role: 'user', text: clean },
      { role: 'monitor', text: '' },
    ])
    const reply = await fetchMonitorAnswer(clean)
    if (request !== requestId.current || !activeRef.current) return
    let index = 0
    typingTimer.current = window.setInterval(() => {
      index = Math.min(reply.length, index + 6)
      const now = performance.now()
      if (now - lastTypeTick.current >= 90) {
        lastTypeTick.current = now
        playSfx('ai-type')
      }
      const part = reply.slice(0, index)
      setMessages((current) => {
        const next = [...current]
        next[next.length - 1] = { role: 'monitor', text: part }
        return next
      })
      if (index >= reply.length && typingTimer.current) {
        window.clearInterval(typingTimer.current)
        typingTimer.current = null
      }
    }, 22)
  }, [])

  useEffect(() => {
    if (!active || !monitorRequest || monitorRequest.id === handled.current) return
    handled.current = monitorRequest.id
    void ask(monitorRequest.question)
  }, [active, ask, monitorRequest])

  useEffect(() => () => {
    if (typingTimer.current) window.clearInterval(typingTimer.current)
  }, [])

  const startListening = () => {
    if (!activeId) {
      selectStation(STATION.id)
      return
    }
    const Constructor = speechConstructor()
    if (!Constructor) return
    const recognition = new Constructor()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.continuous = false
    setListening(true)
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      if (transcript) {
        askMonitor(transcript)
      }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    try {
      recognition.start()
    } catch {
      setListening(false)
    }
  }

  const hasSpeech = Boolean(speechConstructor())
  const chipWidth = 0.29

  return (
    <group>
      <group
        position={[5.2, 1.22, -1.95]}
        rotation-y={-Math.PI / 2}
        {...cursor}
        onPointerDown={(event: ThreeEvent<PointerEvent>) => event.stopPropagation()}
        onPointerUp={(event: ThreeEvent<PointerEvent>) =>
          tapCall(event, () => {
            if (!activeId) selectStation(STATION.id)
          })
        }
      >
        <mesh position={[0, 0, -0.055]}>
          <boxGeometry args={[1.0, 0.68, 0.08]} />
          <meshStandardMaterial color="#2B211A" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[0.94, 0.6]} />
          <meshBasicMaterial map={screen ?? undefined} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.36, -0.03]}>
          <cylinderGeometry args={[0.075, 0.12, 0.1, 14]} />
          <meshStandardMaterial color="#33261C" roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.485, -0.03]}>
          <boxGeometry args={[0.34, 0.025, 0.22]} />
          <meshStandardMaterial color="#3B2B20" roughness={0.7} />
        </mesh>

        {active
          ? monitorContent.chips.map((chip, index) => (
              <mesh
                key={chip.question}
                position={[-0.29 + index * chipWidth, -0.205, 0.025]}
                onPointerDown={(event: ThreeEvent<PointerEvent>) => {
                  event.stopPropagation()
                  askMonitor(chip.question)
                }}
              >
                <planeGeometry args={[0.285, 0.11]} />
                <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
              </mesh>
            ))
          : null}

        {active && hasSpeech ? (
          <DiscButton
            icon="mic"
            position={[0.41, -0.36, 0.03]}
            size={0.038}
            onClick={startListening}
            label="Ask by voice"
          />
        ) : null}
      </group>

      {active ? (
        <InWorldControls
          position={[5.16, 1.23, -1.95]}
          width={1.0}
          height={0.68}
          onClose={closeStation}
          hidePrev
          hideNext
          closeLabel="Close the monitor"
        />
      ) : null}
    </group>
  )
}

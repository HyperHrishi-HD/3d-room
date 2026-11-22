import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Html, RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { tvContent } from '../../data/content'
import { stationById } from '../../data/stations'
import { getMediaImageByPath } from '../../lib/mediaCache'
import { playSfx } from '../../lib/sfx'
import { useProgress } from '../../lib/progress'
import { useRoom } from '../../state/roomStore'
import InWorldControls, { DiscButton } from '../InWorldControls'
import { COLORS } from '../palette'
import {
  drawImageContained,
  makeCanvasTexture,
  useFontVersion,
} from '../textEngine'
import { usePointerCursor } from '../usePointerCursor'
import { tapCall } from '../tapGuard'

const STATION = stationById('tv')!
const MAX_BOUQUET = 17

export default function TvStation() {
  const { activeId, cinema, closeStation, selectStation, setCinema } = useRoom()
  const active = activeId === STATION.id
  const { visited } = useProgress()
  const version = useFontVersion()
  const cursor = usePointerCursor()
  const [channel, setChannel] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [envelopeHover, setEnvelopeHover] = useState(false)
  const [videoInteracted, setVideoInteracted] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture } | null>(null)
  const lastDraw = useRef(0)
  const bouquet = useRef<THREE.InstancedMesh>(null)
  const bouquetHeads = useRef<THREE.InstancedMesh>(null)
  // Every channel is a placeholder card from data/content.ts. Add a `photo`
  // or a `video` path to any entry to show real media instead.
  const channels = tvContent.channels
  const current = channels[Math.min(channel, channels.length - 1)]
  useEffect(() => {
    document.documentElement.dataset.tvChannel = String(channel + 1)
    document.documentElement.dataset.tvChannels = String(channels.length)
  }, [channel, channels.length])
  useEffect(() => {
    setChannel((value) => Math.min(value, channels.length - 1))
  }, [channels.length])

  useEffect(() => {
    const onControl = (event: Event) => {
      const action = (event as CustomEvent<'prev' | 'next' | 'toggle'>).detail
      if (action === 'prev') {
        setVideoInteracted(true)
        setChannel((value) => (value + channels.length - 1) % channels.length)
        setPlaying(true)
      } else if (action === 'next') {
        setVideoInteracted(true)
        setChannel((value) => (value + 1) % channels.length)
        setPlaying(true)
      } else if (action === 'toggle') {
        setVideoInteracted(true)
        setPlaying((value) => !value)
      }
    }
    window.addEventListener('room-tv-control', onControl)
    return () => window.removeEventListener('room-tv-control', onControl)
  }, [channels.length])

  const screen = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 576
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    // Paint a designed standby card immediately so the set never flashes a
    // blank black panel while fonts or the station state settle.
    ctx.fillStyle = '#0D0B0A'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#F5EFE2'
    ctx.textAlign = 'center'
    ctx.font = '500 48px Caveat, cursive'
    ctx.fillText('The Television', canvas.width / 2, canvas.height / 2 - 8)
    ctx.fillStyle = 'rgba(245,239,226,0.44)'
    ctx.font = '400 22px Georgia, serif'
    ctx.fillText('touch the screen to wake it', canvas.width / 2, canvas.height / 2 + 44)
    ctx.strokeStyle = 'rgba(201,162,75,0.4)'
    ctx.lineWidth = 2
    ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56)
    texture.needsUpdate = true
    canvasRef.current = { canvas, ctx, texture }
    return texture
  }, [])
  useEffect(() => () => screen?.dispose(), [screen])

  useEffect(() => {
    const source = current.video
    let video: HTMLVideoElement | null = null
    if (source) {
      video = document.createElement('video')
      // CORS mode has to be set before the source so the canvas can read the
      // cross-origin bucket video without tainting the texture.
      video.crossOrigin = 'anonymous'
      video.src = source
      // The letters run as one continuous cut: each film hands over to the
      // next instead of looping on its own frame.
      video.loop = false
      // Channel films stay muted by default so a browser can autoplay them.
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      video.load()
      videoRef.current = video
    } else {
      videoRef.current = null
    }

    return () => {
      if (video) {
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
      if (videoRef.current === video) videoRef.current = null
    }
  }, [current.video])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active && playing && videoInteracted) {
      void video.play().catch(() => undefined)
    } else {
      video.pause()
    }
  }, [active, playing, videoInteracted, current.video])

  // A finished film moves the set on by itself, so the letters play back to
  // back and the last one lands on the closing portrait.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onEnded = () => {
      if (!active) return
      setVideoInteracted(true)
      setPlaying(true)
      setChannel((value) => (value + 1) % channels.length)
    }
    video.addEventListener('ended', onEnded)
    return () => video.removeEventListener('ended', onEnded)
  }, [active, channels.length, current.video])

  // A thin glass sheen over the picture, so the print reads as a screen rather
  // than paint on the wall. Not used for live video, where it would cost a
  // gradient fill on every frame.
  const drawGlass = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const sheen = ctx.createLinearGradient(0, 0, width * 0.92, height)
    sheen.addColorStop(0, 'rgba(255,255,255,0.05)')
    sheen.addColorStop(0.16, 'rgba(255,255,255,0.02)')
    sheen.addColorStop(0.4, 'rgba(255,255,255,0)')
    sheen.addColorStop(1, 'rgba(0,0,0,0.2)')
    ctx.fillStyle = sheen
    ctx.fillRect(0, 0, width, height)
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      height * 0.34,
      width / 2,
      height / 2,
      height * 0.98,
    )
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.36)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = 'rgba(255,255,255,0.055)'
    ctx.lineWidth = 3
    ctx.strokeRect(4, 4, width - 8, height - 8)
  }

  const draw = (time: number) => {
    const data = canvasRef.current
    if (!data) return
    const { ctx } = data
    const width = 1024
    const height = 576
    ctx.fillStyle = '#0D0B0A'
    ctx.fillRect(0, 0, width, height)
    if (!active) {
      ctx.fillStyle = '#F5EFE2'
      ctx.textAlign = 'center'
      ctx.font = "500 48px Caveat, cursive"
      ctx.fillText('The Television', width / 2, height / 2 - 8)
      ctx.fillStyle = 'rgba(245,239,226,0.44)'
      ctx.font = "400 22px Georgia, serif"
      ctx.fillText('touch the screen to wake it', width / 2, height / 2 + 44)
      ctx.strokeStyle = 'rgba(201,162,75,0.4)'
      ctx.lineWidth = 2
      ctx.strokeRect(28, 28, width - 56, height - 56)
      drawGlass(ctx, width, height)
      data.texture.needsUpdate = true
      return
    }

    // Video channels are shown without any title, caption, channel bug,
    // progress line, or other overlay. The dark frame is the same fill used
    // by the TV bezel, and contain-fitting keeps portraits uncropped.
    if (current.video) {
      const video = videoRef.current
      ctx.fillStyle = '#0D0B0A'
      ctx.fillRect(0, 0, width, height)
      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        const scale = Math.min(width / video.videoWidth, height / video.videoHeight)
        const drawWidth = video.videoWidth * scale
        const drawHeight = video.videoHeight * scale
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(
          video,
          (width - drawWidth) / 2,
          (height - drawHeight) / 2,
          drawWidth,
          drawHeight,
        )
      }
      drawGlass(ctx, width, height)
      data.texture.needsUpdate = true
      return
    }

    const gradient = ctx.createLinearGradient(0, 0, width, height)
    const tones: Record<string, [string, string]> = {
      plum: ['#2A1320', '#613B4F'],
      gold: ['#2B1D0C', '#8E682A'],
      blue: ['#0E2225', '#42666B'],
      rose: ['#2A1414', '#8E4448'],
      leaf: ['#15200F', '#4C6038'],
      cream: ['#2A2418', '#8E7653'],
    }
    const tone = tones[current.tone] ?? tones.plum
    gradient.addColorStop(0, tone[0])
    gradient.addColorStop(1, tone[1])
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    const photo = getMediaImageByPath(current.photo)
    if (photo && photo.naturalWidth > 0 && photo.naturalHeight > 0) {
      ctx.fillStyle = '#0D0B0A'
      ctx.fillRect(0, 0, width, height)
      drawImageContained(ctx, photo, 0, 0, width, height)
      if (current.poster) {
        drawGlass(ctx, width, height)
        data.texture.needsUpdate = true
        return
      }
      const shade = ctx.createLinearGradient(0, height * 0.4, 0, height)
      shade.addColorStop(0, 'rgba(13,11,10,0)')
      shade.addColorStop(0.58, 'rgba(13,11,10,0.34)')
      shade.addColorStop(1, 'rgba(13,11,10,0.9)')
      ctx.fillStyle = shade
      ctx.fillRect(0, 0, width, height)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#F5EFE2'
      ctx.font = "500 44px Georgia, serif"
      ctx.fillText(current.title, width / 2, height * 0.79, 840)
      ctx.fillStyle = 'rgba(245,239,226,0.72)'
      ctx.font = "400 22px Georgia, serif"
      ctx.fillText(current.subtitle, width / 2, height * 0.87, 760)
    } else {
      ctx.globalAlpha = 0.16
      for (let index = 0; index < 10; index += 1) {
        const x = ((index * 137 + time * 9) % (width + 220)) - 110
        const y = height * 0.36 + Math.sin(time * 0.8 + index) * 68
        ctx.fillStyle = index % 2 ? '#F5E5C2' : '#C96F6F'
        ctx.beginPath()
        ctx.ellipse(x, y, 44, 16, Math.sin(time * 0.3 + index), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      ctx.textAlign = 'center'
      ctx.fillStyle = '#F5EFE2'
      ctx.font = "500 58px Georgia, serif"
      ctx.fillText(current.title, width / 2, height * 0.44, 840)
      ctx.fillStyle = 'rgba(245,239,226,0.66)'
      ctx.font = "400 24px Georgia, serif"
      ctx.fillText(current.subtitle, width / 2, height * 0.52, 760)
    }

    ctx.fillStyle = 'rgba(245,239,226,0.32)'
    ctx.font = "400 15px Georgia, serif"
    ctx.fillText(`CHANNEL ${channel + 1}`, width / 2, 70)
    ctx.textAlign = 'left'
    ctx.fillText('THE ROOM', 44, 70)
    ctx.textAlign = 'right'
    ctx.fillText(playing ? 'PLAYING' : 'PAUSED', width - 44, 70)

    ctx.fillStyle = 'rgba(245,239,226,0.16)'
    ctx.fillRect(44, height - 44, width - 88, 3)
    ctx.fillStyle = COLORS.gold
    ctx.fillRect(44, height - 44, (width - 88) * ((time * 0.025 + channel * 0.2) % 1), 3)

    ctx.globalAlpha = 0.08
    ctx.fillStyle = '#000000'
    for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1)
    ctx.globalAlpha = 1
    drawGlass(ctx, width, height)
    data.texture.needsUpdate = true
  }

  useEffect(() => {
    draw(0)
  }, [active, channel, playing, version])

  useFrame((state) => {
    if (!active) return
    if (!playing && !current.video) return
    // Video needs every frame while it is playing. Photos keep their slow
    // canvas timing, and a paused video only needs a low-rate refresh.
    const interval = current.video && playing ? 0 : 0.12
    if (state.clock.elapsedTime - lastDraw.current < interval) return
    lastDraw.current = state.clock.elapsedTime
    draw(state.clock.elapsedTime)
  })

  const lettersTexture = useMemo(
    () =>
      makeCanvasTexture(420, 280, (ctx) => {
        ctx.fillStyle = '#F2E5CB'
        ctx.fillRect(0, 0, 420, 280)
        ctx.strokeStyle = '#B98C3E'
        ctx.lineWidth = 5
        ctx.strokeRect(12, 12, 396, 256)
        ctx.beginPath()
        ctx.moveTo(12, 12)
        ctx.lineTo(210, 142)
        ctx.lineTo(408, 12)
        ctx.stroke()
        ctx.fillStyle = '#5A3A1C'
        ctx.font = "600 58px Caveat, cursive"
        ctx.textAlign = 'center'
        ctx.fillText('Letters', 210, 206)
        ctx.fillStyle = '#8B6A3C'
        ctx.font = "400 22px Georgia, serif"
        ctx.fillText('a note', 210, 242)
      }),
    [version],
  )
  useEffect(() => () => lettersTexture.dispose(), [lettersTexture])
  const bouquetGeometry = useMemo(() => new THREE.CylinderGeometry(0.004, 0.006, 0.3, 5), [])
  const bouquetHeadGeometry = useMemo(() => new THREE.SphereGeometry(0.026, 7, 5), [])
  const bouquetMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5C7949', roughness: 0.9 }),
    [],
  )
  const bouquetHeadMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    [],
  )

  useLayoutEffect(() => {
    if (!bouquet.current || !bouquetHeads.current) return
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const total = Math.min(MAX_BOUQUET, Math.max(0, visited.length))
    for (let index = 0; index < MAX_BOUQUET; index += 1) {
      const shown = index < total
      const angle = index * 2.4
      const radius = 0.02 + (index % 4) * 0.018
      position.set(Math.cos(angle) * radius, 0.18 + (index % 5) * 0.026, Math.sin(angle) * radius)
      scale.set(shown ? 1 : 0, shown ? 1 : 0, shown ? 1 : 0)
      matrix.compose(position, quaternion, scale)
      bouquet.current.setMatrixAt(index, matrix)
      position.y += 0.15
      matrix.compose(position, quaternion, scale)
      bouquetHeads.current.setMatrixAt(index, matrix)
      bouquetHeads.current.setColorAt(
        index,
        new THREE.Color(['#C96F6F', '#D8B25C', '#E9DCC1', '#8F6078'][index % 4]),
      )
    }
    bouquet.current.instanceMatrix.needsUpdate = true
    bouquetHeads.current.instanceMatrix.needsUpdate = true
    if (bouquetHeads.current.instanceColor) bouquetHeads.current.instanceColor.needsUpdate = true
  }, [visited.length])

  useEffect(
    () => () => {
      bouquetGeometry.dispose()
      bouquetHeadGeometry.dispose()
      bouquetMaterial.dispose()
      bouquetHeadMaterial.dispose()
    },
    [bouquetGeometry, bouquetHeadGeometry, bouquetHeadMaterial, bouquetMaterial],
  )

  return (
    <group>
      <group position={[-3.4, 0, -4.05]}>
        {/* A deep wooden cabinet that meets the wall, a recessed dark lip, and
            a slim gold trim. The picture sits a hair proud of the casing, so
            it reads as glass in a real set rather than paint on the plaster. */}
        <RoundedBox
          args={[2.5, 1.5, 0.62]}
          radius={0.045}
          smoothness={4}
          position={[0, 1.28, -0.21]}
        >
          <meshStandardMaterial color="#2A1A12" roughness={0.58} metalness={0.12} />
        </RoundedBox>
        {/* A deep matte bezel, like a real panel set into the cabinet. It is
            wide enough to read as glass and metal from across the room, not as
            a print in a thin picture frame. */}
        <mesh position={[0, 1.28, 0.112]}>
          <planeGeometry args={[2.3, 1.34]} />
          <meshPhysicalMaterial
            color="#050404"
            roughness={0.52}
            metalness={0.14}
            clearcoat={0.22}
            clearcoatRoughness={0.5}
          />
        </mesh>
        {/* The brushed gold band around the outside of the bezel picks up the
            same warm lamp as the console, so the frame sits in the room. */}
        <mesh position={[0, 1.948, 0.118]}>
          <boxGeometry args={[2.298, 0.009, 0.005]} />
          <meshStandardMaterial color={COLORS.gold} roughness={0.28} metalness={0.62} />
        </mesh>
        <mesh position={[0, 0.612, 0.118]}>
          <boxGeometry args={[2.298, 0.009, 0.005]} />
          <meshStandardMaterial color={COLORS.gold} roughness={0.28} metalness={0.62} />
        </mesh>
        <mesh position={[-1.146, 1.28, 0.118]}>
          <boxGeometry args={[0.009, 1.335, 0.005]} />
          <meshStandardMaterial color={COLORS.gold} roughness={0.28} metalness={0.62} />
        </mesh>
        <mesh position={[1.146, 1.28, 0.118]}>
          <boxGeometry args={[0.009, 1.335, 0.005]} />
          <meshStandardMaterial color={COLORS.gold} roughness={0.28} metalness={0.62} />
        </mesh>
        {/* A warm pool of light on the cabinet and wall, as if the panel were
            throwing its picture back into the room. */}
        <pointLight
          position={[0, 1.28, 0.72]}
          color="#F5D3A0"
          intensity={0.52}
          distance={2.6}
          decay={2}
        />
        <mesh position={[0, 0.6, 0.124]}>
          <boxGeometry args={[0.24, 0.007, 0.004]} />
          <meshBasicMaterial color={COLORS.gold} toneMapped={false} />
        </mesh>
        <mesh position={[1.04, 0.6, 0.126]}>
          <sphereGeometry args={[0.006, 10, 8]} />
          <meshBasicMaterial color="#D8624E" toneMapped={false} />
        </mesh>
        {/* The narrow ledge under the glass holds the letters and the channel
            discs, so neither floats where the old sofa used to be. */}
        <mesh position={[0, 0.545, 0.18]}>
          <boxGeometry args={[2.54, 0.05, 0.17]} />
          <meshStandardMaterial color="#3B2618" roughness={0.72} />
        </mesh>
        <mesh position={[0, 0.572, 0.18]}>
          <boxGeometry args={[2.5, 0.008, 0.155]} />
          <meshStandardMaterial color="#5A3C26" roughness={0.68} />
        </mesh>
        <mesh position={[0, 1.28, 0.125]} onPointerDown={(event: ThreeEvent<PointerEvent>) => event.stopPropagation()}
        onPointerUp={(event: ThreeEvent<PointerEvent>) => tapCall(event, () => {
          playSfx('tv-click')
          setVideoInteracted(true)
          if (!activeId) {
            selectStation(STATION.id)
            return
          }
          if (current.video && !videoInteracted) {
            setPlaying(true)
            return
          }
          setPlaying((value) => !value)
        })}
        onDoubleClick={(event) => {
          event.stopPropagation()
          playSfx('tv-click')
          setCinema(!cinema)
        }}>
          <planeGeometry args={[2.08, 1.17]} />
          <meshBasicMaterial map={screen ?? undefined} toneMapped={false} />
        </mesh>
      </group>

      {active ? (
        <>
          {!cinema ? (
            <Html position={[-4.26, 0.66, -3.64]} center zIndexRange={[26, 0]}>
              <button
                type="button"
                className="tv-fullscreen-button"
                aria-label="Full screen"
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  playSfx('ui-click')
                  setCinema(true)
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">
                  <path
                    d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
            </Html>
          ) : null}
          <DiscButton
            icon="previous"
            position={[-3.95, 0.62, -3.86]}
            size={0.045}
            onClick={() => {
              playSfx('tv-click')
              setVideoInteracted(true)
              setChannel((value) => (value + channels.length - 1) % channels.length)
              setPlaying(true)
            }}
            label="Previous channel"
          />
          <DiscButton
            icon="next"
            position={[-3.65, 0.62, -3.86]}
            size={0.045}
            onClick={() => {
              playSfx('tv-click')
              setVideoInteracted(true)
              setChannel((value) => (value + 1) % channels.length)
              setPlaying(true)
            }}
            label="Next channel"
          />
        </>
      ) : null}

      <group
        position={[-3.05, 0.71, -3.86]}
        rotation={[-0.1, 0, 0]}
        {...cursor}
        onPointerOver={(event) => {
          event.stopPropagation()
          setEnvelopeHover(true)
        }}
        onPointerOut={() => setEnvelopeHover(false)}
        onPointerDown={(event) => event.stopPropagation()}
        // The card is part of the open station, where look-drag is off, so it
        // can take a plain click. The shared tap guard could reject the click
        // with a stale drag from the overview and made the letter feel like it
        // only worked in the full-screen view.
        onClick={(event) => {
          event.stopPropagation()
          playSfx('ui-click')
          window.dispatchEvent(new CustomEvent('room-open-letters'))
        }}
      >
        <mesh scale={envelopeHover ? 1.04 : 1}>
          <boxGeometry args={[0.38, 0.25, 0.022]} />
          <meshStandardMaterial
            color="#E9D9BA"
            roughness={0.68}
            emissive={envelopeHover ? '#C9A24B' : '#000000'}
            emissiveIntensity={envelopeHover ? 0.36 : 0}
          />
        </mesh>
        <mesh position={[0, 0, 0.014]}>
          <planeGeometry args={[0.34, 0.22]} />
          <meshBasicMaterial map={lettersTexture} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.01, 0.02]}>
          <planeGeometry args={[0.62, 0.46]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      <group position={[-2.48, 0.02, -3.7]}>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.055, 0.085, 0.15, 14]} />
          <meshStandardMaterial color="#8D6D4E" roughness={0.72} />
        </mesh>
        <instancedMesh ref={bouquet} args={[bouquetGeometry, bouquetMaterial, MAX_BOUQUET]} />
        <instancedMesh
          ref={bouquetHeads}
          args={[bouquetHeadGeometry, bouquetHeadMaterial, MAX_BOUQUET]}
        />
      </group>

      {active ? (
        <InWorldControls
          position={[-3.4, 1.28, -3.96]}
          width={2.15}
          height={1.16}
          onClose={closeStation}
          hidePrev
          hideNext
          closeIcon="close"
          closeLabel="Close the television and return to the overview"
        />
      ) : null}
    </group>
  )
}

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { useRoom } from '../state/roomStore'
import CameraRig, { useFrameDirector } from './CameraRig'
import LookControls from './LookControls'
import { CameraChevrons } from './InWorldControls'
import DoorCounter from './furniture/DoorCounter'
import Fridge from './furniture/Fridge'
import Kitchen from './furniture/Kitchen'
import LampClock from './furniture/LampClock'
import Plants from './furniture/Plants'
import Shell from './furniture/Shell'
import Sofa from './furniture/Sofa'
import Table from './furniture/Table'
import Bookshelf from './furniture/Bookshelf'
import AlbumStation from './stations3d/AlbumStation'
import FlowerStation from './stations3d/FlowerStation'
import FridgeStation from './stations3d/FridgeStation'
import KitchenStation from './stations3d/KitchenStation'
import LetterStation from './stations3d/LetterStation'
import MailStation from './stations3d/MailStation'
import MedalStation from './stations3d/MedalStation'
import MonitorStation from './stations3d/MonitorStation'
import NotebookStation from './stations3d/NotebookStation'
import PlacesStation from './stations3d/PlacesStation'
import PolaroidStation from './stations3d/PolaroidStation'
import TimelineStation from './stations3d/TimelineStation'
import TvStation from './stations3d/TvStation'
import ShadowCaster from './ShadowCaster'

function SceneAudit() {
  const { gl, scene } = useThree()
  const last = useMemo(
    () => ({ at: 0, fpsAt: performance.now(), frames: 0, fps: 0 }),
    [],
  )

  useFrame((state) => {
    last.frames += 1
    const now = performance.now()
    if (now - last.fpsAt >= 1000) {
      last.fps = (last.frames * 1000) / (now - last.fpsAt)
      last.frames = 0
      last.fpsAt = now
      document.documentElement.dataset.fps = last.fps.toFixed(1)
      document.documentElement.dataset.dpr = gl.getPixelRatio().toFixed(2)
    }
    if (state.clock.elapsedTime - last.at < 1.5) return
    last.at = state.clock.elapsedTime
    let meshes = 0
    scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes += 1
    })
    document.documentElement.dataset.meshes = String(meshes)
    document.documentElement.dataset.textures = String(gl.info.memory.textures)
    document.documentElement.dataset.calls = String(gl.info.render.calls)
    document.documentElement.dataset.triangles = String(gl.info.render.triangles)
  })
  return null
}

function AdaptiveDpr({ initial }: { initial: number }) {
  const { gl } = useThree()
  const state = useMemo(
    () => ({ at: performance.now(), frames: 0, low: 0, high: 0 }),
    [],
  )

  useEffect(() => {
    gl.setPixelRatio(initial)
  }, [gl, initial])

  useFrame(() => {
    state.frames += 1
    const now = performance.now()
    if (now - state.at < 2000) return
    const fps = (state.frames * 1000) / (now - state.at)
    state.at = now
    state.frames = 0
    const root = document.documentElement
    // Never change resolution mid-flight. A short settle keeps the adjustment
    // invisible between scenes instead of popping while the camera is moving.
    if (root.dataset.traveling !== 'false' || root.dataset.destination) return
    const current = gl.getPixelRatio()
    if (fps < 45) {
      state.low += 1
      state.high = 0
    } else if (fps > 57) {
      state.high += 1
      state.low = 0
    } else {
      state.low = 0
      state.high = 0
    }
    if (state.low >= 2 && current > 1) {
      gl.setPixelRatio(Math.max(1, current - 0.25))
      state.low = 0
    } else if (state.high >= 3 && current < initial) {
      gl.setPixelRatio(Math.min(initial, current + 0.25))
      state.high = 0
    }
  })
  return null
}

function ShadowRefresh() {
  const { activeId, destinationId } = useRoom()
  const { gl } = useThree()

  useEffect(() => {
    gl.shadowMap.needsUpdate = true
  }, [activeId, destinationId, gl])

  useFrame(() => {
    // Page turns are the only moving shadow casters. Refresh only while one of
    // those moments is genuinely animating.
    const flip = document.documentElement.dataset.pageFlip ?? ''
    if (flip) gl.shadowMap.needsUpdate = true
  })
  return null
}

function CameraDirector() {
  const { arrive, arriveOverview } = useRoom()
  const goal = useFrameDirector()
  return <CameraRig goal={goal} onArrive={arrive} onOverviewArrive={arriveOverview} />
}

export default function RoomScene() {
  const {
    active,
    closeStation,
    destination,
    overviewTravel,
    selectStation,
    stepStation,
    traveling,
  } = useRoom()
  const initialDpr = Math.min(
    window.devicePixelRatio || 1,
    window.innerWidth < 760 ? 1.5 : 2,
  )

  const choose = (id: string) => {
    if (active) return
    selectStation(id, 'manual')
  }

  useEffect(() => {
    document.documentElement.dataset.active = active?.id ?? ''
    document.documentElement.dataset.destination = destination?.id ?? ''
    document.documentElement.dataset.traveling = String(traveling)
    document.documentElement.dataset.overview = String(overviewTravel)
  }, [active?.id, destination?.id, overviewTravel, traveling])

  return (
    <>
    <Canvas
      dpr={initialDpr}
      frameloop="always"
      shadows
      onCreated={(state) => {
        const { gl } = state
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.18
        gl.shadowMap.enabled = true
        // PCFSoft was removed from this three release; PCF is the supported soft variant.
        gl.shadowMap.type = THREE.PCFShadowMap
        // Static room content reuses one 1024 map. It is refreshed when a
        // station changes or a genuinely dynamic caster is moving.
        gl.shadowMap.autoUpdate = false
        gl.shadowMap.needsUpdate = true
      }}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        // QA only: lets the capture harness read the current frame directly.
        preserveDrawingBuffer:
          import.meta.env.DEV && new URLSearchParams(window.location.search).has('capture'),
      }}
      camera={{
        fov: 46,
      near: 0.15,
      far: 45,
        position: [0, 2.7, 10.6],
      }}
      onPointerMissed={() => {
        if (active) closeStation()
      }}
    >
      <color attach="background" args={['#17100B']} />
      <fog attach="fog" args={['#17100B', 13, 60]} />
      <ambientLight intensity={0.44} color="#FFE3B3" />
      <directionalLight
        position={[3, 4.2, 6]}
        intensity={0.56}
        color="#FFF1D6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-far={22}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-4, 3.2, -2.5]} intensity={0.16} color="#9FB6CE" />
      <pointLight position={[0, 2.85, 2.6]} intensity={0.42} distance={5.8} color="#FFD39A" />

      <Shell />
      <DoorCounter onSelect={choose} />
      <Kitchen onSelect={choose} />
      <Fridge onSelect={choose} />
      <Table onSelect={choose} />
      <Bookshelf onSelect={choose} />
      <Sofa />
      <LampClock boosted />
      <Plants />

      <MailStation />
      <FridgeStation />
      <ShadowCaster>
        <KitchenStation />
      </ShadowCaster>
      <PlacesStation />
      <PolaroidStation />
      <TimelineStation />
      <LetterStation />
      <ShadowCaster>
        <AlbumStation />
        <NotebookStation />
      </ShadowCaster>
      <MonitorStation />
      <ShadowCaster>
        <MedalStation />
        <FlowerStation />
      </ShadowCaster>
      <TvStation />

      <ContactShadows
        position={[0, 0.012, 0]}
        scale={13}
        blur={2.3}
        opacity={0.5}
        far={2.8}
        resolution={512}
        frames={1}
      />
      <CameraDirector />
      <AdaptiveDpr initial={initialDpr} />
      <ShadowRefresh />
      {active ? (
        <CameraChevrons
          onPrevious={() => stepStation(-1)}
          onNext={() => stepStation(1)}
        />
      ) : null}
      <SceneAudit />
    </Canvas>
    <LookControls />
    </>
  )
}

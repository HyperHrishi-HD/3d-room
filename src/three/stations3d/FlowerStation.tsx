import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { flowerCards, type ArtTone } from '../../data/content'
import { stationById } from '../../data/stations'
import { useThree } from '@react-three/fiber'
import { playSfx } from '../../lib/sfx'
import { useRoom } from '../../state/roomStore'
import InWorldControls from '../InWorldControls'
import { COLORS } from '../palette'
import { usePointerCursor } from '../usePointerCursor'
import { tapCall } from '../tapGuard'

const STATION = stationById('flowers')!
const COUNT = 21
const MAX_PETALS = 32
const NECK = new THREE.Vector3(5.6, 1.12, 1.84)
const VASE_BASE = new THREE.Vector3(5.6, 0.84, 1.84)

type HeadType = 'rose' | 'marigold' | 'tulip'

const TONE_COLORS: Record<ArtTone, string> = {
  rose: '#C96F6F',
  leaf: '#7D9864',
  gold: '#D8B25C',
  plum: '#8F6078',
  cream: '#E9DCC1',
  blue: '#8BB0B2',
}

function headTypeFor(tone: ArtTone): HeadType {
  if (tone === 'rose' || tone === 'plum') return 'rose'
  if (tone === 'gold' || tone === 'cream') return 'marigold'
  return 'tulip'
}

function random(seed: number) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

const FLOWERS = (() => {
  const randomValue = random(77)
  const ringStarts = [0, 1, 7]
  const ringCounts = [1, 6, 14]
  const ringRadii = [0, 0.105, 0.205]
  return Array.from({ length: COUNT }, (_, index) => {
    const card = index % flowerCards.length
    const ring = index < 7 ? (index < 1 ? 0 : 1) : 2
    const local = index - ringStarts[ring]
    const angle = ring === 0 ? randomValue() * Math.PI * 2 : (local / ringCounts[ring]) * Math.PI * 2 + ring * 0.35
    const radius = ringRadii[ring]
    const tone = (flowerCards[card].tone ?? 'gold') as ArtTone
    return {
      x: 5.6 + Math.cos(angle) * radius * 0.68 + (randomValue() - 0.5) * 0.008,
      y: 1.42 - ring * 0.03 + (randomValue() - 0.5) * 0.008,
      z: 1.84 + Math.sin(angle) * radius + (randomValue() - 0.5) * 0.008,
      card,
      tone,
      type: headTypeFor(tone),
      size: 0.88 + randomValue() * 0.22,
      angle,
    }
  })
})()

const HEAD_RINGS: Record<
  HeadType,
  Array<{ count: number; radius: number; tilt: number; scale: number; lift: number }>
> = {
  rose: [
    { count: 5, radius: 0.042, tilt: 0.36, scale: 0.92, lift: 0.002 },
    { count: 4, radius: 0.026, tilt: 0.62, scale: 0.82, lift: 0.007 },
    { count: 3, radius: 0.012, tilt: 0.9, scale: 0.65, lift: 0.011 },
  ],
  marigold: [
    { count: 7, radius: 0.043, tilt: 0.28, scale: 0.72, lift: 0 },
    { count: 7, radius: 0.032, tilt: 0.5, scale: 0.68, lift: 0.004 },
    { count: 7, radius: 0.021, tilt: 0.74, scale: 0.6, lift: 0.008 },
    { count: 7, radius: 0.01, tilt: 1.0, scale: 0.5, lift: 0.011 },
  ],
  tulip: [{ count: 6, radius: 0.016, tilt: 0.1, scale: 1.2, lift: 0.008 }],
}

const VASE_POINTS = [
  new THREE.Vector2(0.078, 0),
  new THREE.Vector2(0.102, 0.035),
  new THREE.Vector2(0.098, 0.12),
  new THREE.Vector2(0.064, 0.2),
  new THREE.Vector2(0.05, 0.24),
  new THREE.Vector2(0.066, 0.255),
]


export default function FlowerStation() {
  const { activeId, closeStation, selectStation } = useRoom()
  const { camera, scene } = useThree()
  const active = activeId === STATION.id
  const [selected, setSelected] = useState(0)
  const [cardOpen, setCardOpen] = useState(false)
  const [debugHide, setDebugHide] = useState<string | null>(null)
  const root = useRef<THREE.Group>(null)
  const petals = useRef<THREE.InstancedMesh>(null)
  const centers = useRef<THREE.InstancedMesh>(null)
  const stems = useRef<THREE.InstancedMesh>(null)
  const leaves = useRef<THREE.InstancedMesh>(null)
  const hits = useRef<THREE.InstancedMesh>(null)
  const cursor = usePointerCursor()

  const petalGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0.008, 0.003),
          new THREE.Vector2(0.016, 0.013),
          new THREE.Vector2(0.014, 0.026),
          new THREE.Vector2(0.007, 0.034),
          new THREE.Vector2(0, 0.038),
        ],
        10,
      ),
    [],
  )
  const centerTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')!
    context.fillStyle = '#F4E4B8'
    context.beginPath()
    context.arc(64, 64, 60, 0, Math.PI * 2)
    context.fill()
    const randomValue = random(311)
    for (let index = 0; index < 90; index += 1) {
      const angle = randomValue() * Math.PI * 2
      const radius = Math.sqrt(randomValue()) * 54
      context.fillStyle = randomValue() > 0.55 ? '#9A6A30' : '#C78C42'
      context.beginPath()
      context.arc(64 + Math.cos(angle) * radius, 64 + Math.sin(angle) * radius, 1.5 + randomValue() * 2, 0, Math.PI * 2)
      context.fill()
    }
    return new THREE.CanvasTexture(canvas)
  }, [])
  const centerGeometry = useMemo(() => new THREE.CircleGeometry(0.014, 18), [])
  const stemGeometry = useMemo(() => new THREE.CylinderGeometry(0.0035, 0.005, 1, 7), [])
  const hitGeometry = useMemo(() => new THREE.SphereGeometry(0.075, 8, 6), [])
  const vaseGeometry = useMemo(() => new THREE.LatheGeometry(VASE_POINTS, 24), [])
  const leafGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.bezierCurveTo(0.034, 0.018, 0.052, 0.072, 0.018, 0.14)
    shape.bezierCurveTo(-0.004, 0.092, -0.005, 0.032, 0, 0)
    return new THREE.ShapeGeometry(shape, 8)
  }, [])
  const petalMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.7,
        metalness: 0.02,
        side: THREE.DoubleSide,
        emissive: '#3E2E20',
        emissiveIntensity: 0.2,
      }),
    [],
  )
  const centerMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: centerTexture,
        roughness: 0.72,
        metalness: 0.04,
        side: THREE.DoubleSide,
        emissive: '#4A351C',
        emissiveIntensity: 0.24,
      }),
    [centerTexture],
  )
  const stemMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5C7949', roughness: 0.94 }),
    [],
  )
  const leafMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#4F6C40', roughness: 0.94, side: THREE.DoubleSide }),
    [],
  )
  const hitMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0, depthWrite: false }),
    [],
  )
  const vaseMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#B9A58D', roughness: 0.44, metalness: 0.08 }),
    [],
  )

  useEffect(() => {
    if (!active) {
      setCardOpen(false)
      window.dispatchEvent(new CustomEvent('room-flower-card-close'))
    }
  }, [active])

  useEffect(() => {
    if (!active || !cardOpen) return
    playSfx('flower-bloom')
    window.dispatchEvent(new CustomEvent('room-flower-card', { detail: { index: selected } }))
  }, [active, cardOpen, selected])

  useEffect(() => {
    const close = () => setCardOpen(false)
    const step = (event: Event) => {
      const direction = (event as CustomEvent<{ direction?: number }>).detail?.direction
      if (direction !== 1 && direction !== -1) return
      setSelected((current) => (current + direction + COUNT) % COUNT)
      setCardOpen(true)
    }
    window.addEventListener('room-flower-card-close', close)
    window.addEventListener('room-flower-step', step)
    return () => {
      window.removeEventListener('room-flower-card-close', close)
      window.removeEventListener('room-flower-step', step)
    }
  }, [])

  useEffect(
    () => () => {
      petalGeometry.dispose()
      centerTexture.dispose()
      centerGeometry.dispose()
      stemGeometry.dispose()
      hitGeometry.dispose()
      vaseGeometry.dispose()
      leafGeometry.dispose()
      petalMaterial.dispose()
      centerMaterial.dispose()
      leafMaterial.dispose()
      stemMaterial.dispose()
      hitMaterial.dispose()
      vaseMaterial.dispose()
    },
    [
      centerGeometry,
      centerMaterial,
      centerTexture,
      hitGeometry,
      hitMaterial,
      leafGeometry,
      leafMaterial,
      petalGeometry,
      petalMaterial,
      stemGeometry,
      stemMaterial,
      vaseGeometry,
      vaseMaterial,
    ],
  )

  useLayoutEffect(() => {
    if (!petals.current || !centers.current || !stems.current || !leaves.current || !hits.current) {
      return
    }
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const tilt = new THREE.Quaternion()
    const radial = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const position = new THREE.Vector3()
    const direction = new THREE.Vector3()
    const outward = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    const yAxis = new THREE.Vector3(0, 1, 0)
    const xAxis = new THREE.Vector3(1, 0, 0)
    const head = new THREE.Vector3()
    const baseColor = new THREE.Color()
    let petalIndex = 0
    let leafIndex = 0

    FLOWERS.forEach((entry, index) => {
      const chosen = active && selected === index
      const size = entry.size * (chosen ? 1.14 : 1)
      head.set(entry.x, entry.y + (chosen ? 0.035 : 0), entry.z)
      baseColor.set(TONE_COLORS[entry.tone])

      for (const ring of HEAD_RINGS[entry.type]) {
        for (let petal = 0; petal < ring.count; petal += 1) {
          const angle = entry.angle + (petal / ring.count) * Math.PI * 2
          const jitter = Math.sin(index * 14.3 + petal * 7.1) * 0.5
          position.set(
            head.x + Math.cos(angle) * ring.radius * size,
            head.y + ring.lift * size,
            head.z + Math.sin(angle) * ring.radius * size,
          )
          radial.setFromAxisAngle(yAxis, -angle + Math.PI / 2)
          tilt.setFromAxisAngle(xAxis, ring.tilt + jitter * 0.08)
          quaternion.copy(radial).multiply(tilt)
          scale.setScalar(0.9 * size * ring.scale * (1 + jitter * 0.06))
          matrix.compose(position, quaternion, scale)
          petals.current!.setMatrixAt(petalIndex, matrix)
          const color = baseColor.clone().offsetHSL(
            (jitter + 0.5) * 0.008,
            jitter * 0.045,
            (jitter + 0.5) * 0.06,
          )
          petals.current!.setColorAt(petalIndex, color)
          petalIndex += 1
        }
      }

      position.copy(head).add(new THREE.Vector3(0, 0.012, 0))
      quaternion.setFromAxisAngle(yAxis, Math.PI / 2)
      scale.setScalar(entry.type === 'tulip' ? 0.7 : 1.05)
      matrix.compose(position, quaternion, scale)
      centers.current!.setMatrixAt(index, matrix)
      centers.current!.setColorAt(
        index,
        new THREE.Color(entry.type === 'tulip' ? '#7A4A33' : '#D8B25C'),
      )

      direction.subVectors(head, NECK)
      const length = direction.length()
      direction.normalize()
      position.copy(NECK).addScaledVector(direction, length / 2)
      quaternion.setFromUnitVectors(up, direction)
      scale.set(1, length, 1)
      matrix.compose(position, quaternion, scale)
      stems.current!.setMatrixAt(index, matrix)

      for (let leaf = 0; leaf < 2; leaf += 1) {
        const t = leaf === 0 ? 0.26 : 0.48
        const angle = entry.angle + (leaf === 0 ? -0.8 : 1.05)
        outward.set(Math.cos(angle), 0, Math.sin(angle))
        position
          .copy(NECK)
          .addScaledVector(direction, length * t)
          .addScaledVector(outward, 0.028)
        quaternion.setFromEuler(
          new THREE.Euler(0.55 + leaf * 0.12, -angle + Math.PI / 2, 0.85),
        )
        scale.setScalar(0.9 + entry.size * 0.12)
        matrix.compose(position, quaternion, scale)
        leaves.current!.setMatrixAt(leafIndex, matrix)
        leafIndex += 1
      }

      position.copy(head)
      scale.setScalar(0.8 + entry.size * 0.18)
      matrix.compose(position, quaternion.identity(), scale)
      hits.current!.setMatrixAt(index, matrix)
    })

    const blank = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let index = petalIndex; index < COUNT * MAX_PETALS; index += 1) {
      petals.current.setMatrixAt(index, blank)
    }
    for (let index = leafIndex; index < COUNT * 2; index += 1) {
      leaves.current.setMatrixAt(index, blank)
    }

    petals.current.instanceMatrix.needsUpdate = true
    if (petals.current.instanceColor) petals.current.instanceColor.needsUpdate = true
    centers.current.instanceMatrix.needsUpdate = true
    if (centers.current.instanceColor) centers.current.instanceColor.needsUpdate = true
    stems.current.instanceMatrix.needsUpdate = true
    leaves.current.instanceMatrix.needsUpdate = true
    hits.current.instanceMatrix.needsUpdate = true
  }, [active, selected])

  const choose = (index: number) => {
    setSelected(index)
    setCardOpen(true)
    if (!activeId) selectStation(STATION.id)
  }

  const chooseNearestFlower = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    let nearest = 0
    let nearestDistance = Infinity
    const bloom = new THREE.Vector3()
    FLOWERS.forEach((flower, index) => {
      bloom.set(flower.x, flower.y, flower.z)
      // Measure to the click ray, not the catch plane: the plane sits in front
      // of the bouquet, so plane distance always favored the centre bloom.
      const distance = event.ray.distanceSqToPoint(bloom)
      if (distance < nearestDistance) {
        nearest = index
        nearestDistance = distance
      }
    })
    choose(nearest)
  }

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const debug = window as typeof window & {
      __FLOWER_DEBUG__?: {
        choose: (index: number) => void
        selected: () => number
        count: number
        hide: (name: string | null) => void
        objects: () => unknown
        picked: () => unknown
        children: () => unknown
        hideChild: (index: number) => void
      }
    }
    debug.__FLOWER_DEBUG__ = {
      choose,
      selected: () => selected,
      count: COUNT,
      hide: (name: string | null) => setDebugHide(name),
      objects: () => {
        const boxes: unknown[] = []
        scene.traverse((object) => {
          if (!(object as THREE.Mesh).isMesh || !object.visible) return
          const box = new THREE.Box3().setFromObject(object)
          const size = box.getSize(new THREE.Vector3())
          if (size.x < 0.04 && size.y < 0.04 && size.z < 0.04) return
          const center = box.getCenter(new THREE.Vector3())
          if (center.x < 5.2 || center.x > 5.9 || center.y < 1.1 || center.y > 1.7) return
          const path: string[] = []
          let ancestor = object.parent
          while (ancestor) {
            path.push(ancestor.name || ancestor.type)
            ancestor = ancestor.parent
          }
          boxes.push({
            type: (object as THREE.Mesh).geometry.type,
            path,
            center: center.toArray().map((value) => +value.toFixed(3)),
            size: size.toArray().map((value) => +value.toFixed(3)),
            name: object.name,
            parent: object.parent?.name || object.parent?.type,
            parentType: object.parent?.type,
          })
        })
        return boxes
      },
      picked: () => {
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
        return raycaster.intersectObjects(scene.children, true).slice(0, 8).map((hit) => ({
          type: (hit.object as THREE.Mesh).geometry?.type ?? hit.object.type,
          name: hit.object.name,
          distance: +hit.distance.toFixed(3),
          parent: hit.object.parent?.name || hit.object.parent?.type,
        }))
      },
      children: () =>
        root.current?.children.map((child, index) => ({
          index,
          type: child.type,
          name: child.name,
          visible: child.visible,
          geometry: (child as THREE.Mesh).geometry?.type ?? null,
        })) ?? [],
      hideChild: (index) => {
        const child = root.current?.children[index]
        if (child) child.visible = false
      },
    }
    return () => {
      delete debug.__FLOWER_DEBUG__
    }
  }, [active, selected])

  return (
    <group ref={root} visible={debugHide !== 'all'}>
      <mesh name="flower-table" position={[5.72, 0.8, 1.84]}>
        <boxGeometry args={[0.26, 0.045, 0.72]} />
        <meshStandardMaterial color="#4B3522" roughness={0.9} />
      </mesh>
      <mesh position={[5.72, 0.825, 1.84]}>
        <boxGeometry args={[0.27, 0.012, 0.64]} />
        <meshStandardMaterial color={COLORS.gold} roughness={0.42} metalness={0.4} />
      </mesh>

      <mesh
        name="flower-vase"
        geometry={vaseGeometry}
        material={vaseMaterial}
        position={[VASE_BASE.x, VASE_BASE.y, VASE_BASE.z]}
        castShadow={false}
        visible={debugHide !== 'vase'}
      />
      <mesh
        position={[VASE_BASE.x, VASE_BASE.y + 0.1, VASE_BASE.z]}
        rotation-x={Math.PI / 2}
        visible={debugHide !== 'rim'}
      >
        <torusGeometry args={[0.083, 0.006, 8, 24]} />
        <meshStandardMaterial color={COLORS.gold} roughness={0.4} metalness={0.35} />
      </mesh>

      <instancedMesh
        ref={stems}
        name="flower-stems"
        args={[stemGeometry, stemMaterial, COUNT]}
        position={[0, 0, 0]}
        visible={debugHide !== 'stems'}
      />
      <instancedMesh
        ref={petals}
        name="flower-petals"
        args={[petalGeometry, petalMaterial, COUNT * MAX_PETALS]}
        position={[0, 0, 0]}
        visible={debugHide !== 'petals'}
      />
      <instancedMesh
        ref={leaves}
        name="flower-leaves"
        args={[leafGeometry, leafMaterial, COUNT * 2]}
        position={[0, 0, 0]}
        visible={debugHide !== 'leaves'}
      />
      <instancedMesh
        ref={centers}
        name="flower-centers"
        args={[centerGeometry, centerMaterial, COUNT]}
        position={[0, 0, 0]}
        visible={debugHide !== 'centers'}
      />
      <instancedMesh
        ref={hits}
        name="flower-hits"
        args={[hitGeometry, hitMaterial, COUNT]}
        position={[0, 0, 0]}
        visible={debugHide !== 'hits'}
        {...cursor}
        onPointerDown={(event: ThreeEvent<PointerEvent>) => event.stopPropagation()}
        onPointerUp={(event: ThreeEvent<PointerEvent>) =>
          tapCall(event, () => {
            if (event.instanceId !== undefined) choose(event.instanceId)
          })
        }
      />

      {/* One generous tap surface for the whole bunch. The nearest bloom wins,
          so a tap between small petals still selects the flower you meant. */}
      <mesh
        position={[5.3, 1.4, 1.84]}
        rotation-y={-Math.PI / 2}
        visible={debugHide !== 'hits'}
        {...cursor}
        onPointerDown={(event: ThreeEvent<PointerEvent>) => event.stopPropagation()}
        onPointerUp={(event: ThreeEvent<PointerEvent>) =>
          tapCall(event, () => chooseNearestFlower(event))
        }
      >
        <planeGeometry args={[0.54, 0.48]} />
        <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
      </mesh>

      {active ? (
        <InWorldControls
          position={[4.5, 0.98, 1.86]}
          width={0.96}
          height={0.62}
          closeLift={0.22}
          rotationY={-1.25}
          pageButtonsDrop={0.28}
          onClose={closeStation}
          onPrev={() => {
            setSelected((selected + COUNT - 1) % COUNT)
            setCardOpen(true)
          }}
          onNext={() => {
            setSelected((selected + 1) % COUNT)
            setCardOpen(true)
          }}
          prevLabel="Previous flower"
          nextLabel="Next flower"
        />
      ) : null}
    </group>
  )
}

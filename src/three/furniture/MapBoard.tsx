import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { places } from '../../data/content'
import { assetUrl } from '../../lib/assetUrl'
import { COLORS } from '../palette'
import { usePointerCursor } from '../usePointerCursor'
import { isTapPointer } from '../tapGuard'

type Props = {
  active: boolean
  selected: number
  onSelectPin: (index: number) => void
  onActivate: () => void
}

const MAP_IMAGE_WIDTH = 2058
const MAP_IMAGE_HEIGHT = 1036
const MAP_WIDTH = 1.72
const MAP_HEIGHT = (MAP_WIDTH * MAP_IMAGE_HEIGHT) / MAP_IMAGE_WIDTH
const MAP_Z = 0.062

/**
 * The downloaded image is a north-up equirectangular map. Its longitude runs
 * from -180 to +180 across the plane and its latitude runs from -90 at the
 * bottom to +90 at the top, so the pins stay in their correct places.
 */
function latLonToMapPoint(lat: number, lon: number): THREE.Vector3 {
  return new THREE.Vector3(
    (lon / 360) * MAP_WIDTH,
    (lat / 180) * MAP_HEIGHT,
    MAP_Z + 0.006,
  )
}

export default function MapBoard({ active, selected, onSelectPin, onActivate }: Props) {
  const cursor = usePointerCursor()
  const selectedMarker = useRef<THREE.Group>(null)
  const [earthTexture, setEarthTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    let disposed = false
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      if (disposed) return
      const canvas = document.createElement('canvas')
      canvas.width = 1600
      canvas.height = 806
      const context = canvas.getContext('2d')
      if (!context) return
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      // This is a non-power-of-two canvas. Avoid mipmap allocation so the
      // texture uploads correctly on WebGL1 as well as WebGL2.
      texture.generateMipmaps = false
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.anisotropy = 4
      texture.needsUpdate = true
      setEarthTexture(texture)
    }
    image.onerror = () => undefined
    image.src = assetUrl('/media/world-map.jpg')
    return () => {
      disposed = true
    }
  }, [])

  useFrame(({ clock }) => {
    if (!selectedMarker.current) return
    const pulse = 1 + Math.sin(clock.elapsedTime * 3.2) * 0.08
    selectedMarker.current.scale.setScalar(pulse)
  })

  const isTap = (event: ThreeEvent<PointerEvent>) =>
    isTapPointer(event.nativeEvent.clientX, event.nativeEvent.clientY, event.pointerId)

  const activate = (event: ThreeEvent<PointerEvent>) => {
    if (!isTap(event)) return
    event.stopPropagation()
    onActivate()
  }

  const pickNearest = (event: ThreeEvent<PointerEvent>) => {
    if (!isTap(event)) return
    event.stopPropagation()
    if (!places.length) {
      onActivate()
      return
    }
    // The catch plane is larger than the map print, so read the hit in the
    // board's own coordinates instead of UVs. Anywhere on the frame resolves
    // to the closest pin, including the gold border and the wall margin.
    const local = event.object.worldToLocal(event.point.clone())
    let nearest = 0
    let nearestDistance = Infinity
    places.forEach((place, index) => {
      const point = latLonToMapPoint(place.mapCenter[0], place.mapCenter[1])
      const dx = point.x - local.x
      const dy = point.y - local.y
      const distance = dx * dx + dy * dy
      if (distance < nearestDistance) {
        nearest = index
        nearestDistance = distance
      }
    })
    onSelectPin(nearest)
  }

  return (
    // Like the timeline board, keep the whole frame clear of the wall face
    // instead of letting its back edge enter the wall mesh.
    <group position={[-0.55, 1.85, -4.30]} {...cursor}>
      <mesh onPointerUp={activate}>
        <boxGeometry args={[1.95, 1.35, 0.08]} />
        <meshStandardMaterial color={COLORS.gold} roughness={0.44} metalness={0.34} />
      </mesh>
      <mesh position={[0, 0, 0.057]}>
        <planeGeometry args={[1.82, 1.2]} />
        <meshStandardMaterial color="#15110e" roughness={0.82} />
      </mesh>

      <mesh position={[0, 0, 0.059]}>
        <planeGeometry args={[MAP_WIDTH + 0.035, MAP_HEIGHT + 0.035]} />
        <meshStandardMaterial color={COLORS.gold} roughness={0.5} metalness={0.25} />
      </mesh>
      <mesh key={earthTexture ? 'earth-map' : 'map-loading'} position={[0, 0, MAP_Z]}>
        <planeGeometry args={[MAP_WIDTH, MAP_HEIGHT]} />
        {earthTexture ? (
          <meshBasicMaterial map={earthTexture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color="#31576A" toneMapped={false} />
        )}
      </mesh>

      {places.map((place, index) => {
        const point = latLonToMapPoint(place.mapCenter[0], place.mapCenter[1])
        const isSelected = active && selected === index
        return (
          <group key={place.id} position={point}>
            <mesh scale={isSelected ? 1.35 : 1}>
              <sphereGeometry args={[0.021, 16, 12]} />
              <meshStandardMaterial
                color={isSelected ? COLORS.brightGold : COLORS.gold}
                emissive={isSelected ? '#7A5216' : '#3A2A12'}
                emissiveIntensity={isSelected ? 1.2 : 0.55}
                roughness={0.3}
                metalness={0.4}
              />
            </mesh>
            {isSelected ? (
              <group ref={selectedMarker}>
                <mesh position={[0, 0, 0.012]} renderOrder={4}>
                  <ringGeometry args={[0.032, 0.043, 28]} />
                  <meshBasicMaterial
                    color={COLORS.brightGold}
                    transparent
                    opacity={0.9}
                    toneMapped={false}
                    depthWrite={false}
                  />
                </mesh>
                <Html
                  position={[0, 0.072, 0]}
                  center
                  zIndexRange={[20, 0]}
                  style={{ pointerEvents: 'none' }}
                >
                  <span className="map-pin-label">{place.title}</span>
                </Html>
              </group>
            ) : null}
          </group>
        )
      })}

      {/* Anywhere on the board is a target, including the gold frame: the
          nearest pin always wins. The pins themselves have no handlers, so a
          tap on a marker falls through to this plane too and still resolves by
          distance instead of whichever hit sphere happened to be in front. */}
      <mesh position={[0, 0, MAP_Z + 0.008]} onPointerUp={pickNearest}>
        <planeGeometry args={[1.95, 1.35]} />
        <meshBasicMaterial visible={false} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type MergePart = {
  geometry: THREE.BufferGeometry
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
}

export function boxPart(
  width: number,
  height: number,
  depth: number,
  position: [number, number, number],
  rotation?: [number, number, number],
): MergePart {
  return { geometry: new THREE.BoxGeometry(width, height, depth), position, rotation }
}

export function planePart(
  width: number,
  height: number,
  position: [number, number, number],
  rotation?: [number, number, number],
): MergePart {
  return { geometry: new THREE.PlaneGeometry(width, height), position, rotation }
}

export function circlePart(
  radius: number,
  position: [number, number, number],
  rotation?: [number, number, number],
): MergePart {
  return { geometry: new THREE.CircleGeometry(radius, 18), position, rotation }
}

/**
 * Merge static, same-material geometry into one draw. Each part is cloned
 * before it is transformed, so a module-level part list can be merged again
 * whenever the scene remounts without its transforms
 * being applied twice. The returned geometry is owned by the caller (R3F
 * disposes it on unmount).
 */
export function mergeParts(parts: MergePart[]): THREE.BufferGeometry {
  const geometries = parts.map((part) => {
    const geometry = part.geometry.clone()
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    if (part.rotation) {
      quaternion.setFromEuler(new THREE.Euler(...part.rotation))
    }
    matrix.compose(
      new THREE.Vector3(...(part.position ?? [0, 0, 0])),
      quaternion,
      new THREE.Vector3(...(part.scale ?? [1, 1, 1])),
    )
    geometry.applyMatrix4(matrix)
    return geometry
  })
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  if (!merged) throw new Error('Unable to merge static room geometry')
  merged.computeBoundingSphere()
  return merged
}

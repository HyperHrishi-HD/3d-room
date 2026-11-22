import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { easing } from 'maath'

export type Stage = 'home' | 'picker' | 'read'
export type TransformSpec = {
  position: [number, number, number]
  rotation: [number, number, number]
}

export function useFloatToRead(
  stage: Stage,
  targets: {
    home: TransformSpec
    picker?: TransformSpec
    read: TransformSpec
  },
) {
  const ref = useRef<THREE.Group>(null)
  const reduced = useRef(false)
  const targetPosition = useMemo(() => new THREE.Vector3(), [])
  const targetEuler = useMemo(() => new THREE.Euler(), [])
  const targetRotation = useMemo(() => new THREE.Quaternion(), [])
  const scratchEuler = useMemo(() => new THREE.Euler(), [])
  // Settle bookkeeping: once the group is within SETTLE_EPSILON of the current
  // stage's target (position and rotation), it snaps exactly and stops
  // updating until the stage changes. This kills the endless asymptotic creep
  // that read as stutter on the floating letter.
  const settledStage = useRef<Stage | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.current = media.matches
    const onChange = (event: MediaQueryListEvent) => {
      reduced.current = event.matches
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useFrame((_, delta) => {
    const group = ref.current
    if (!group) return
    if (settledStage.current === stage) return
    const step = Math.min(delta, 0.5)
    const chosen =
      stage === 'read'
        ? targets.read
        : stage === 'picker' && targets.picker
          ? targets.picker
          : targets.home

    targetPosition.set(...chosen.position)
    targetEuler.set(...chosen.rotation)
    targetRotation.setFromEuler(targetEuler)

    const SETTLE_EPSILON = 0.0008
    if (
      group.position.distanceTo(targetPosition) < SETTLE_EPSILON &&
      group.quaternion.angleTo(targetRotation) < SETTLE_EPSILON
    ) {
      group.position.copy(targetPosition)
      group.quaternion.copy(targetRotation)
      settledStage.current = stage
      return
    }

    const smoothness = reduced.current ? 0.09 : stage === 'home' ? 0.22 : 0.26
    easing.damp3(group.position, targetPosition, smoothness, step)
    easing.dampE(
      scratchEuler.setFromQuaternion(group.quaternion, 'YXZ'),
      targetEuler,
      smoothness,
      step,
    )
    group.quaternion.setFromEuler(scratchEuler)
  })

  return ref
}

export function useReducedMotion(): boolean {
  const ref = useRef(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    ref.current = media.matches
    const onChange = (event: MediaQueryListEvent) => {
      ref.current = event.matches
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return ref.current
}

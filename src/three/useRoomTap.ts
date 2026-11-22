import type { ThreeEvent } from '@react-three/fiber'
import { isTapPointer } from './tapGuard'

/**
 * Room furniture activates on a clean tap only. A pointer that travelled more
 * than the 8 px slop belongs to the look gesture and must not open a station.
 */
export function useRoomTap(onTap: () => void) {
  return {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
    },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => {
      if (
        !isTapPointer(
          event.nativeEvent.clientX,
          event.nativeEvent.clientY,
          event.pointerId,
        )
      ) {
        return
      }
      event.stopPropagation()
      onTap()
    },
    onPointerCancel: () => undefined,
  }
}

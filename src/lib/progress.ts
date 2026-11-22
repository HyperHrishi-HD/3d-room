import { useSyncExternalStore } from 'react'
import { STATION_COUNT } from '../data/stations'

const STORAGE_KEY = 'room-room3d-v1'
const listeners = new Set<() => void>()

let snapshot: number[] = []
let loaded = false
let storageBound = false

function readVisited(): number[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const valid = parsed.filter(
      (value): value is number =>
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= STATION_COUNT,
    )
    return [...new Set(valid)].sort((a, b) => a - b)
  } catch {
    return []
  }
}

function ensureLoaded() {
  if (!loaded) {
    snapshot = readVisited()
    loaded = true
  }
}

function emit() {
  for (const listener of listeners) listener()
}

function bindStorage() {
  if (storageBound) return
  storageBound = true
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return
    snapshot = readVisited()
    emit()
  })
}

export function getVisited(): number[] {
  ensureLoaded()
  return snapshot
}

export function markVisited(stationNumber: number): void {
  ensureLoaded()
  if (
    !Number.isInteger(stationNumber) ||
    stationNumber < 1 ||
    stationNumber > STATION_COUNT ||
    snapshot.includes(stationNumber)
  ) {
    return
  }

  snapshot = [...snapshot, stationNumber].sort((a, b) => a - b)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Storage can be unavailable; the visit still counts for this session.
  }
  emit()
}

function subscribe(onStoreChange: () => void): () => void {
  bindStorage()
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

export function useProgress(): { visited: number[]; count: number; total: number } {
  const visited = useSyncExternalStore(subscribe, getVisited, () => [])
  return { visited, count: visited.length, total: STATION_COUNT }
}

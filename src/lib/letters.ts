import { useSyncExternalStore } from 'react'
import { defaultLetters, type DefaultLetter } from '../data/content'

/**
 * LETTERS, KEPT IN THIS BROWSER
 * -----------------------------
 * The room has no server and no database. A letter written in the composer is
 * added to localStorage, appears on the hall counter and in the letters sheet,
 * and is still there after a reload. The three letters in data/content.ts are
 * the built-in placeholders and always lead the stack.
 *
 * Replace `addLetter` with a request to your own endpoint if you ever want
 * letters shared between visitors. Nothing here sends anything anywhere.
 */

export interface Letter extends DefaultLetter {
  /** Set on letters written in this browser; absent on placeholder letters. */
  savedAt?: number
}

interface StoredLetter {
  id: string
  name: string
  message: string
  savedAt: number
}

const STORAGE_KEY = 'room-letters-v1'
const MAX_SAVED = 40
const MAX_NAME = 60
const MAX_MESSAGE = 500

const PLACEHOLDERS: Letter[] = defaultLetters.map((letter) => ({ ...letter }))
const listeners = new Set<() => void>()

let saved: StoredLetter[] = []
let all: Letter[] = PLACEHOLDERS
let loaded = false
let storageBound = false

const clip = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

function sanitize(value: unknown): StoredLetter | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Partial<StoredLetter>
  const name = clip(entry.name, MAX_NAME)
  const message = clip(entry.message, MAX_MESSAGE)
  if (!name || !message) return null
  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id.slice(0, 80) : makeId(),
    name,
    message,
    savedAt:
      typeof entry.savedAt === 'number' && Number.isFinite(entry.savedAt)
        ? entry.savedAt
        : Date.now(),
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `letter-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function read(): StoredLetter[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(sanitize)
      .filter((entry): entry is StoredLetter => entry !== null)
      .slice(-MAX_SAVED)
  } catch {
    return []
  }
}

function rebuild(): void {
  all = [
    ...PLACEHOLDERS,
    ...saved.map((entry) => ({
      id: entry.id,
      name: entry.name,
      message: entry.message,
      savedAt: entry.savedAt,
    })),
  ]
}

function ensureLoaded(): void {
  if (loaded) return
  saved = read()
  rebuild()
  loaded = true
}

function emit(): void {
  for (const listener of listeners) listener()
}

function bindStorage(): void {
  if (storageBound) return
  storageBound = true
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return
    saved = read()
    rebuild()
    emit()
  })
}

function subscribe(listener: () => void): () => void {
  bindStorage()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): Letter[] {
  ensureLoaded()
  return all
}

/**
 * Add a letter to this browser. Returns the new letter and whether it was
 * actually written to storage; private windows can refuse persistence, in
 * which case the letter still lives for the rest of the visit.
 */
export function addLetter(
  name: string,
  message: string,
): { letter: Letter | null; persisted: boolean } {
  const cleanName = clip(name, MAX_NAME)
  const cleanMessage = clip(message, MAX_MESSAGE)
  if (!cleanName || !cleanMessage) return { letter: null, persisted: false }

  ensureLoaded()
  const entry: StoredLetter = {
    id: makeId(),
    name: cleanName,
    message: cleanMessage,
    savedAt: Date.now(),
  }
  saved = [...saved, entry].slice(-MAX_SAVED)
  rebuild()
  emit()

  let persisted = false
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    persisted = true
  } catch {
    // The letter is still in the in-memory list for this visit.
  }

  return {
    letter: {
      id: entry.id,
      name: entry.name,
      message: entry.message,
      savedAt: entry.savedAt,
    },
    persisted,
  }
}

export function useLetters(): { letters: Letter[] } {
  const letters = useSyncExternalStore(subscribe, getSnapshot, () => PLACEHOLDERS)
  return { letters }
}

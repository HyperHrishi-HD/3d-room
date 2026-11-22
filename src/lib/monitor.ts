import { monitorContent } from '../data/content'
import { askRoomApi } from './api'

/**
 * Ask the room's monitor. The placeholder answers come from content.ts; if an
 * endpoint is configured in lib/api.ts, its answer wins. Any failure stays
 * inside the room's voice.
 */
export async function fetchMonitorAnswer(question: string): Promise<string> {
  const clean = question.trim().slice(0, 240)
  if (!clean) return monitorContent.unavailable
  const remote = await askRoomApi(clean)
  if (remote) return remote.answer
  return monitorAnswer(clean)
}

export function monitorAnswer(question: string): string {
  const clean = question.trim().toLowerCase()
  if (!clean) return monitorContent.fallback
  const exact = monitorContent.chips.find(
    (chip) => chip.question.toLowerCase() === clean,
  )
  if (exact) return exact.answer
  const words = clean.split(/\W+/).filter((word) => word.length > 3)
  let best: { score: number; answer: string } | null = null
  for (const chip of monitorContent.chips) {
    const haystack = `${chip.question} ${chip.answer}`.toLowerCase()
    const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0)
    if (score > 0 && (!best || score > best.score)) best = { score, answer: chip.answer }
  }
  return best?.answer ?? monitorContent.fallback
}

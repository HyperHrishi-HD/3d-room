/**
 * API PLACEHOLDER
 * ---------------
 * The template ships with no backend, no keys and no vendor SDK. The call
 * below resolves locally so every station works offline; letters never touch
 * this file and are stored by lib/letters.ts.
 *
 * To connect a real AI service, serve a small server-side endpoint that accepts
 *   POST { question: string }  ->  200 { answer: string }
 * and either set `ROOM_AI_ENDPOINT` below or point it at your deployed origin.
 * Keep the provider key on the server; never put it in a VITE_ variable.
 *
 * See server/ai-proxy.example.js for a framework-neutral handler, and
 * AI_API.md for the contract and deployment notes.
 */

/** Set this to your own endpoint, or leave empty for local placeholder answers. */
export const ROOM_AI_ENDPOINT = (import.meta.env.VITE_AI_ENDPOINT ?? '').trim()

const TIMEOUT_MS = 12_000

export interface RoomAnswer {
  answer: string
}

export async function askRoomApi(question: string): Promise<RoomAnswer | null> {
  if (!ROOM_AI_ENDPOINT) return null
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(ROOM_AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.trim().slice(0, 240) }),
      signal: controller.signal,
    })
    if (!response.ok) return null
    const payload: unknown = await response.json()
    if (
      payload &&
      typeof payload === 'object' &&
      typeof (payload as RoomAnswer).answer === 'string'
    ) {
      const answer = (payload as RoomAnswer).answer.trim()
      return answer ? { answer } : null
    }
    return null
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

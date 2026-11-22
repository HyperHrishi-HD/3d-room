/**
 * EXAMPLE ENDPOINT — not imported by the app and not required to build.
 *
 * A framework-neutral handler for the monitor's contract:
 *   POST { question: string }  ->  200 { answer: string }
 *
 * It uses the WinterCG Request/Response API, so it runs as-is on Cloudflare
 * Workers/Pages Functions and Deno Deploy, and behind a small adapter anywhere
 * else. Copy it to your host, set the variables below as secrets, then point
 * ROOM_AI_ENDPOINT (src/lib/api.ts) or VITE_AI_ENDPOINT at its URL.
 *
 * Required environment:
 *   AI_API_URL       e.g. https://api.example.com/v1
 *   AI_API_KEY       provider key — server-only, never in the browser
 *   AI_MODEL         e.g. a small, fast chat model
 * Recommended environment:
 *   ALLOWED_ORIGIN   the exact origin of your site, e.g. https://room.example.com
 *                    Without it, only same-origin calls are accepted.
 * Optional:
 *   AI_SYSTEM_PROMPT what the room is allowed to say
 *   CLIENT_TOKEN     a shared token the browser sends as x-room-token
 *   RATE_LIMIT       requests allowed per client per window (default 20)
 *
 * The provider key never leaves this function. Errors are swallowed and the
 * caller only ever sees the fallback sentence, so no provider detail leaks.
 */

const FALLBACK = 'The monitor could not reach its model just now. Please try again.'

const WINDOW_MS = 10 * 60 * 1000
const MAX_BODY_BYTES = 2048
const hits = new Map()

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

function text(body, status, headers = {}) {
  return new Response(body, { status, headers: { ...JSON_HEADERS, ...headers } })
}

function answer(body, status, headers = {}) {
  return text(JSON.stringify({ answer: body }), status, headers)
}

/** Sliding-window counter, per client and per warm isolate. */
function overLimit(key, limit) {
  const now = Date.now()
  if (hits.size > 5000) {
    for (const [entry, times] of hits) {
      const live = times.filter((time) => now - time < WINDOW_MS)
      if (live.length) hits.set(entry, live)
      else hits.delete(entry)
    }
  }
  const times = (hits.get(key) || []).filter((time) => now - time < WINDOW_MS)
  if (times.length >= limit) {
    hits.set(key, times)
    return true
  }
  times.push(now)
  hits.set(key, times)
  return false
}

function clientKey(request) {
  const header =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for') ||
    ''
  return header.split(',')[0].trim() || 'unknown'
}

async function callModel(question, env) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(`${env.AI_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              env.AI_SYSTEM_PROMPT ||
              'You are the small monitor in a quiet 3D room. Answer in one or two short sentences.',
          },
          { role: 'user', content: question },
        ],
        max_tokens: 300,
      }),
      signal: controller.signal,
    })
    if (!response.ok) return null
    const payload = await response.json()
    return payload?.choices?.[0]?.message?.content?.trim().slice(0, 600) || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const requestOrigin = new URL(request.url).origin
    const allowed = env.ALLOWED_ORIGIN || requestOrigin
    const sameOrigin = !origin || origin === requestOrigin
    const permitted = origin === allowed || (sameOrigin && !env.ALLOWED_ORIGIN)

    const cors = {
      'Access-Control-Allow-Origin': permitted ? allowed : requestOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-room-token',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: permitted ? 204 : 403, headers: cors })
    }
    if (request.method !== 'POST') {
      return text('Method not allowed', 405, cors)
    }
    if (!permitted) {
      return text('Forbidden origin', 403, cors)
    }
    if (env.CLIENT_TOKEN && request.headers.get('x-room-token') !== env.CLIENT_TOKEN) {
      return text('Forbidden', 403, cors)
    }
    const declared = Number(request.headers.get('content-length') || 0)
    if (declared > MAX_BODY_BYTES) {
      return answer(FALLBACK, 413, cors)
    }

    const limit = Number(env.RATE_LIMIT) > 0 ? Number(env.RATE_LIMIT) : 20
    if (overLimit(clientKey(request), limit)) {
      return answer(FALLBACK, 429, { ...cors, 'Retry-After': String(WINDOW_MS / 1000) })
    }

    let question = ''
    try {
      const raw = await request.text()
      if (raw.length > MAX_BODY_BYTES) return answer(FALLBACK, 413, cors)
      const body = JSON.parse(raw)
      question = typeof body?.question === 'string' ? body.question.trim().slice(0, 240) : ''
    } catch {
      return answer(FALLBACK, 200, cors)
    }

    if (!question) return answer(FALLBACK, 200, cors)

    const reply = await callModel(question, env)
    return answer(reply || FALLBACK, 200, cors)
  },
}

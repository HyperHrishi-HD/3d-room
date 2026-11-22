# Connecting the monitor to an AI API

The monitor on the table is the only station that would talk to a model. This template ships it
inert: answers come from `src/data/content.ts` and no request leaves the browser.

Follow these three steps when you want real answers.

---

## 1. The contract

Your endpoint receives one JSON body and returns one JSON field.

```http
POST https://your-domain.example/api/chat
Content-Type: application/json

{ "question": "What is this room?" }
```

```json
{ "answer": "A short reply." }
```

Rules the client already enforces:

- the question is trimmed and capped at 240 characters;
- the request times out after 12 seconds;
- a non-200 status, a timeout, invalid JSON or a missing `answer` falls back to the local answer;
- nothing is retried automatically, so a slow provider cannot stack up requests.

---

## 2. Point the room at it

In `src/lib/api.ts`:

```ts
export const ROOM_AI_ENDPOINT =
  import.meta.env.VITE_AI_ENDPOINT ?? 'https://your-domain.example/api/chat'
```

Or leave the constant empty and set `VITE_AI_ENDPOINT` in `.env.local`:

```
VITE_AI_ENDPOINT=https://your-domain.example/api/chat
```

`VITE_` variables are compiled into the public bundle. That is fine for a URL and **never** fine for
a key.

---

## 3. Implement the endpoint

`server/ai-proxy.example.js` is a framework-neutral handler (WinterCG `Request`/`Response`) with:

- method and content-type checks,
- an optional same-origin check,
- an optional shared token,
- a provider call with a timeout,
- a fixed fallback answer.

It is written against the OpenAI-compatible chat-completions shape because that shape is widely
supported. Swap `callModel()` for your provider's SDK and keep everything else.

### Keys

Store the provider key in your host's secret manager:

| Host | Where |
|---|---|
| Cloudflare Workers / Pages | `wrangler secret put AI_API_KEY` |
| Deno Deploy | project environment variables |
| Netlify functions | site environment variables |
| A Node server | your process environment or a secrets file outside the repo |

Never commit a key, never log it, never send it to the browser.

### Abuse limits

The example handler is deliberately unfriendly to strangers:

| Guard | Default | Why |
|---|---|---|
| Origin check | same origin only unless `ALLOWED_ORIGIN` is set | an unknown site cannot spend your credits |
| Body cap | 2 KB | a 240-character question never needs more |
| Rate limit | 20 calls per client per 10 minutes (`RATE_LIMIT`) | a loop or a bot cannot drain the key |
| Timeout | 12 s, aborted server-side | one slow provider call cannot hold the request |
| Answer cap | 600 characters | the monitor screen is small anyway |
| Errors | always the fallback sentence | provider messages and keys never reach the browser |

The counter lives in memory, so it is per warm instance: it stops a single client hammering one
worker, not a distributed botnet. For real traffic put a shared limiter in front (Cloudflare rate
limiting rules, a WAF, or a small KV/D1 counter).

### A minimal provider call

```js
async function callModel(question, env) {
  const response = await fetch(`${env.AI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages: [
        { role: 'system', content: env.AI_SYSTEM_PROMPT },
        { role: 'user', content: question },
      ],
      max_tokens: 300,
    }),
  })
  if (!response.ok) return null
  const payload = await response.json()
  return payload?.choices?.[0]?.message?.content?.trim() || null
}
```

### What to put in the system prompt

Feed the model only what the room is allowed to say. Keep it short, keep it factual, and tell it to
answer in one or two sentences, because the screen is small. Do not paste private data you would not
put on the public site.

---

## Letters are local, not an API

The letter sheet needs no backend. `src/lib/letters.ts` writes each letter to `localStorage` under
`room-letters-v1` and feeds the same list to the counter and the viewer. There is no letter function
in `src/lib/api.ts`, and writing a letter never makes a request.

If you want letters shared between visitors, add an endpoint and call it from `addLetter()`:

```ts
await fetch('/api/letters', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: cleanName, message: cleanMessage }),
})
```

Moderate and approve on the server, never in the browser, and never render an unapproved message.
The AI contract above stays separate.

# context.md — 3D Room: how the whole thing works

> **What this file is.** A complete, technical description of this repository: the room, every
> station, the camera system, the data model, the rendering tricks, the state machine, and the
> places where you would connect a real API. It describes *this* project only. Every word and
> photograph in it is a placeholder.
>
> If you are an AI assistant or a new developer picking this repo up, read this file first. It is
> written so you can make changes without reverse-engineering the scene.

---

## 1. What this is

A single warm room, built in real-time 3D with Three.js through `@react-three/fiber`. There is one
page. Sixteen "places" live inside the room, and **all station content is rendered into the room
itself**: text is painted onto canvas textures, photographs become planes, albums are physical
books that open in place, and the television is a live canvas screen.

The governing rule is:

> **Nothing pops up. Everything is in the room.**

Four small DOM layers are allowed, because they are chrome rather than content:

| Layer | File | Why it exists |
|---|---|---|
| Header (wordmark, mute, Explore) | `src/ui/Header.tsx` | Always-available navigation |
| Section menu (Explore) | `src/ui/SectionMenu.tsx` | The only list of all places |
| Station close button | `src/ui/StationCloseButton.tsx` | A 48 px, notch-safe close control |
| Compact input dock for the monitor | `src/ui/AiDock.tsx` | Text input cannot live on a canvas |

Plus four small contextual overlays that exist because a 3D surface is too small to read on a
phone: the timeline card (`TimelineCardOverlay`), the flower card (`FlowerCardOverlay`), the TV
cinema controls (`TvBackButton`, `TvCloseControls`) and the letters sheet (`LetterOverlay`).

There is **no tour, no onboarding card and no separate reading page**: the Explore menu and the
room's own objects are the whole navigation. There is also **no backend, database, analytics or
vendor SDK** — the site is static and self-contained.

---

## 2. Run it

```bash
npm install
npm run dev      # Vite dev server
npm run build    # tsc -b + vite build -> dist/
npm run preview  # serve the built site
```

Node 20.19+ (Vite 7). There is no `.env` requirement; the app runs offline. The only external
request at runtime is the Google Fonts stylesheet imported at the top of `src/index.css`.

---

## 3. File map

```
index.html                  document shell; data-mode="room" drives the page height
vite.config.ts              React + Tailwind plugins; ignores qa captures
src/
  App.tsx                   the shell: header, canvas, error retry, overlays
  main.tsx                  React root + RoomProvider
  index.css                 design tokens, chrome, overlays, responsive rules
  data/
    stations.ts             the 16 places: geometry, camera presets, sections, hash parsing
    content.ts              EVERY word in the room (all placeholder)
    mediaManifest.ts        optional list of real images to preload (empty by default)
  state/
    roomStore.tsx           the entire interaction state machine
  lib/
    api.ts                  API PLACEHOLDER (AI only); no network by default
    letters.ts              letters written here, kept in localStorage
    assetUrl.ts             prefixes public files with Vite's base (Pages subpath)
    monitor.ts              local answer matching for the monitor
    progress.ts             visited places, persisted in localStorage
    frameChrome.ts          measures header/close-button chrome for the camera solver
    mediaCache.ts           progressive image loader for optional real photographs
    music.ts, sfx.ts        optional audio, muted-safe
  three/
    RoomScene.tsx           the Canvas, lights, furniture and stations
    CameraRig.tsx           frame director + 1,100 ms flights + look/zoom
    frameSolver.ts          solves a camera position that fits a 3D box in a safe screen rect
    overviewLook.ts         mutable yaw/pitch/zoom state for the wide room view
    LookControls.tsx        pointer drag, pinch, wheel, keyboard for the wide view
    FloatToRead.ts          the animation that floats an object out to be read
    PageBook.tsx            the physical album/notebook with turning pages
    InWorldControls.tsx     gold discs: previous, next, cinema
    textEngine.ts           canvas text layout + motif art, used by every station
    textures.ts             floor, album cover, TV and monitor standby cards
    palette.ts, merge.ts, tapGuard.ts, useRoomTap.ts, usePointerCursor.ts
    furniture/              Shell, DoorCounter, Fridge, Kitchen, Table, Bookshelf,
                            MapBoard, Pinboard, MedalShelf, Plants, Sofa, LampClock
    stations3d/             one component per station kind (13 files)
  ui/                       the permitted DOM layers + the error boundary
server/
  ai-proxy.example.js       a framework-neutral example endpoint (not used by the app)
public/
  favicon.svg               gold-and-ink mark
  og.png                    1200 × 630 social card, rendered from the overview
  media/world-map.jpg       equirectangular map print (pins use lat/lon over it)
  media/LICENSE.md, music/LICENSE.md, sfx/LICENSE.md   asset credits
  music/peaceful-loop.mp3   background bed, 0.08 volume (ogg fallback)
  sfx/*.mp3                 18 interface sounds
LICENSE                     MIT (bundled assets keep their own licences)
```

---

## 4. The room

### 4.1 Dimensions

- Interior: `X ∈ [−6, 6]`, `Z ∈ [−4.5, 4.5]`, walls 3.4 m high.
- Three visible walls — front at `z = −4.5`, left at `x = −6`, right at `x = +6` — open on the
  camera side, no ceiling. This is the "270°" room.
- Floor is a generated plank texture; a red rug sits at the centre; one warm pool of light hangs
  near the middle of the room.

### 4.2 What stands where

| Wall | Furniture | Stations that live there |
|---|---|---|
| Left (`x = −6`) | Front door, mail counter, fridge, kitchen run with counter and upper cabinets | Letters, Fridge, Kitchen |
| Front (`z = −4.5`) | Television on a console with a shelf, map board, pinned photo wall, timeline pinboard | Places, Photos, Timeline, The TV |
| Right (`x = +6`) | Table with the letter, bookshelf with the albums and notebook, monitor on the table, medal shelf, flowers below it | The Letter, Albums 1–4, Notebook, Monitor, Shelf, Flowers |

Every object you can tap is a station, and every station is a place to read something. Nothing on
a surface is decoration only: the counter, table and shelf hold the room's paper, prints and
screen.

### 4.3 Furniture is fixed; stations animate

`furniture/*` draws only the static room (walls, counters, shelves, lamps). Each station component
draws its own object and animates it between three poses:

1. **closed** — sitting naturally in the room, framed by `focusBox`;
2. **read** — floated out toward the viewer at `anchor`, framed by `readBox`;
3. **close** — optional, for a specific moment (the flowers close-up, the TV cinema view).

`FloatToRead.ts` owns the interpolation. `PageBook.tsx` owns page turns.

---

## 5. The sixteen places

`src/data/stations.ts` is the single list. `n` is the visit order and the progress key; `id` is the
stable hash and the `stationById()` key.

| # | id | Section | Title | Kind | What it is |
|---|----|---------|-------|------|------------|
| 01 | `mail` | By the Door | Letters | `mail` | Envelopes fly out of the door slot onto the hall counter; selecting one floats the letter out |
| 02 | `fridge` | Fridge & Kitchen | Fridge | `fridge` | Two magnet games on the fridge door: a memory pair game and a three-option quiz |
| 03 | `kitchen` | Fridge & Kitchen | Kitchen | `kitchen` | Five gold-framed placeholders on the kitchen wall, with a caption card |
| 04 | `places` | The Wall | Places | `board` (map) | Four map pins, each with a placeholder photograph and a note |
| 05 | `polaroids` | The Wall | Photos | `polaroids` | Fourteen draggable placeholder prints with handwritten captions |
| 06 | `timeline` | The Wall | Timeline | `board` (timeline) | Twelve pinned placeholder moments, readable one at a time |
| 07 | `letter` | By the Table | The Letter | `letter` | A single page that floats off the table and opens |
| 08 | `album-one` | By the Table | Album One | `album` | A physical book, four spreads, one print per page |
| 09 | `album-two` | By the Table | Album Two | `album` | The same book, second tab |
| 10 | `album-three` | By the Table | Album Three | `album` | The same book, third tab |
| 11 | `album-four` | By the Table | Album Four | `album` | The same book, fourth tab, with a drag-to-compare spread |
| 12 | `notebook` | By the Table | The Notebook | `notebook` | Two tabbed sections of placeholder notes, plus photo pages |
| 13 | `ai` | By the Table | The Monitor | `monitor` | A small screen with three chips and a typed question dock |
| 14 | `medals` | By the Table | The Shelf | `medals` | Five placeholder awards on a gold shelf |
| 15 | `flowers` | By the Table | The Flowers | `flowers` | A patch of blooms; each opens a placeholder card |
| 16 | `tv` | The TV | The TV | `tv` | Five placeholder channels, cinema mode, a letters card, a progress bouquet |

The four albums share one book. `AlbumStation` renders the book once; switching between album
stations swaps the tab and the spreads rather than flying to a new object.

### 5.1 Adding, removing or reordering a place

1. Add an entry to `STATIONS` in `stations.ts` with a unique `n` and `id`, a `section`, and a
   matching entry in `FRAME_BOXES` (same `id`) for `focus`/`read`.
2. Give it an `anchor`, `camPos`, `camTarget` and a `kind`.
3. If the `kind` is new, add a component in `src/three/stations3d/` and mount it in
   `RoomScene.tsx`.
4. The Explore menu, progress, neighbour chevrons and hashes update automatically, because they
   all read `STATIONS` and `SECTIONS`.

`adjacentStation()` defines previous/next order, so reordering `n` reorders the chevrons.

---

## 6. The camera system

The camera is fully scripted. There is no `OrbitControls`, no free-fly and no collision mesh.

### 6.1 Frame solving

`solveBoxFrame(box, viewDir, aspect, safeRect)` takes a 3D box (`focusBox` or `readBox`), a viewing
direction, the viewport aspect and a "safe" rectangle (viewport minus header and close button),
and returns a camera position plus FOV that fits the whole box inside the safe rect. It is solved
per viewport size, so a phone and a TV frame the same object differently without any hard-coded
phone camera.

`frameChrome.ts` publishes the current chrome measurements so the solver never hides an object
behind the header or the close button.

### 6.2 Flights

`CameraRig.tsx` animates from the current pose to the new goal over **1,100 ms** with a
smoothstep, including a FOV lerp. `prefers-reduced-motion` snaps instead. Arrival fires
`arrive(id)`, which is what marks a station "open".

### 6.3 Look and zoom

In the wide room view, `LookControls` drives mutable state in `overviewLook.ts`:

- one-finger drag (or click-drag) yaws and pitches the camera around a fixed standing point;
- pinch, wheel, `+`/`-` change the lens, never the position — the camera cannot pass through a
  wall;
- yaw is unbounded; pitch is clamped to ±30°;
- the same pinch/wheel zoom works while a station is open, which is how you magnify a section on a
  phone.

A multi-touch gesture is claimed by `tapGuard.beginGesture()` and ends with a cancelled tap, so a
pinch never accidentally opens a station.

---

## 7. The state machine

`src/state/roomStore.tsx` is a single provider with a small, explicit state:

| Field | Meaning |
|---|---|
| `activeId` / `active` | The station that is open and readable |
| `destinationId` / `destination` | The station the camera is flying to |
| `traveling` | `destinationId !== null` |
| `overviewTravel` | True while the wide view is settling after a return |
| `arrivalSource` | `manual \| menu \| hash` — how the current station was opened |
| `menuOpen` | The Explore sheet |
| `cinema` | The TV's tight close view |
| `fridgeScore` | Memory matches and quiz answers for this session |
| `monitorRequest` | The last typed question, with an incrementing id |
| `canvasFailed` / `canvasKey` | Renderer failure and the retry counter |

Transitions:

- `selectStation(id)` — closes the menu, starts a flight (`destinationId`), writes the hash.
  Album → album is special-cased to switch tabs without a flight.
- `arrive(id)` — called by the camera when the flight lands; opens the station and marks it visited.
- `closeStation()` — clears everything and returns to the wide view.
- `stepStation(±1)` — previous/next place, using `adjacentStation`.
- `handleCanvasError()` — sets `canvasFailed`, which shows the retry panel.
- `retryCanvas()` — bumps `canvasKey`, which remounts the canvas in place. No page reload.

### 7.1 URLs

`#/station/<id>` opens a station directly. `#/station/tv/letters` opens the letters sheet over the
television — it is a view of the TV, not a separate page. `#/` is the wide room. `parseStationHash()`
rejects unknown ids and any `/letters` suffix that is not on the TV. `roomStore.updateHash()` keeps
that suffix while the TV is open, so the station's own URL write cannot close the sheet.

### 7.2 Progress

`lib/progress.ts` keeps a sorted array of visited station numbers in `localStorage` under
`room3d-progress-v1`, exposed with `useSyncExternalStore`. It feeds the Explore dots and the TV's
progress bouquet. It is not a score and never blocks anything.

### 7.3 Letters written in the browser

`lib/letters.ts` is the only store for written letters. `addLetter(name, message)` trims and caps
the input (60 / 500 characters), appends an entry with a generated id and `savedAt`, keeps at most
40 saved letters, writes the array to `localStorage` under `room-letters-v1`, and publishes a new
snapshot through `useSyncExternalStore`. `useLetters()` returns the three `defaultLetters` first,
then the saved letters, so the placeholders always lead.

`LetterOverlay` owns the sheet and its `#/station/tv/letters` URL. `LetterEnvelopeViewer` opens on
the newest saved letter, and `MailStation` reads the same hook, so a new letter also becomes one of
the three envelopes on the hall counter. A `storage` event re-reads the key, which keeps two tabs
in step. Private windows that refuse storage still show the letter for the visit; the composer says
so instead of pretending it was saved. Nothing in this path makes a network request.

To collect letters centrally, replace the body of `addLetter()` with your own request. Keep
moderation server-side and never render an unapproved message.

---

## 8. How text and pictures exist in the room

### 8.1 Text is a texture

`textEngine.ts` builds a canvas, lays out blocks (heading, body, rules, spacers), wraps text to a
width, applies the grain/paper fill and returns a `CanvasTexture`. Every station uses it, so
changing copy never requires touching a mesh.

Two typefaces are used, both from the Google Fonts import: **Fraunces** for display and **Caveat**
for handwriting, with Georgia as the metric-compatible fallback. `useFontVersion()` re-paints
canvases once the web fonts arrive.

### 8.2 Pictures are procedural placeholders

`useArtTexture(spec)` draws a designed motif (`arch`, `portrait`, `window`, `garden`, `landscape`)
in one of six tones, seeded by `spec.seed`, so every placeholder is stable across reloads and no
two are identical. If `spec.src` is set and the image has loaded, the photograph is drawn instead.

That means **the template has no image files at all** and still looks intentional.

### 8.3 Adding real photographs

1. Put the file in `public/media/`, e.g. `public/media/letter-01.jpg`.
2. Set `src: '/media/letter-01.jpg'` on the relevant `ArtSpec` (in `content.ts`).
3. Optionally list it in `data/mediaManifest.ts` so it warms before the station opens, and add a
   96 px WebP thumbnail under `public/media/thumbs/` for the blur-up path.

`lib/mediaCache.ts` loads by seed or path and never throws when a file is missing: the designed
placeholder stays.

### 8.4 The clock, the books and the TV

- `PageBook.tsx` is a real page-turn: pages are meshes, the leaf rotates, and `data-page-flip`
  tells the shadow refresher when to update.
- `TvStation.tsx` keeps a 1024×576 canvas as the screen texture. Channels are data
  (`tvContent.channels`); a channel with `photo` or `video` paints real media, otherwise it paints
  a designed card with its title and subtitle.
- `MonitorStation.tsx` paints the chat transcript into its own canvas and reads answers from
  `lib/monitor.ts`.

---

## 9. The AI monitor and the API placeholder

The monitor is the only place that would talk to a model. It is deliberately inert:

1. `lib/monitor.ts` → `fetchMonitorAnswer(question)`.
2. That calls `askRoomApi()` in `lib/api.ts`.
3. `ROOM_AI_ENDPOINT` is empty by default, so `askRoomApi()` returns `null` immediately and the
   local matcher in `content.ts` answers instead.
4. Set `ROOM_AI_ENDPOINT` (or `VITE_AI_ENDPOINT`) to your own endpoint and the same screen starts
   using it. Any network error, timeout (12 s) or malformed payload falls back to the local answer
   without an unhandled rejection.

The wire contract is tiny:

```
POST <ROOM_AI_ENDPOINT>
Content-Type: application/json
{ "question": "…" }

200 OK
{ "answer": "…" }
```

`server/ai-proxy.example.js` is a framework-neutral handler for that contract, and `AI_API.md`
explains how to point it at any provider. **No key ever belongs in the browser bundle.**

Letters are separate from this API. They never leave the browser: `lib/letters.ts` stores them in
`localStorage` and `lib/api.ts` has no letter call at all. See section 7.3 for the store and how to
connect a real collection endpoint if you ever want one.

---

## 10. Audio

`lib/sfx.ts` plays short optional sounds from `public/sfx/`. It is silent by default until the first
user gesture, respects the header mute (persisted under `room3d-sfx-muted-v1`), throttles repeats,
and swallows every playback error. `lib/music.ts` is the same idea for ambient music. Removing a
file or a name from `SOURCES` never breaks an interaction.

---

## 11. Accessibility and input

- Every DOM control is a real `<button>`, with an accessible name and a visible focus ring.
- `Escape` closes the open station, then cinema mode.
- Arrow keys move DOM focus between visible controls; the arrow-look mode takes over only while it
  is active, so the two never fight.
- Focus is trapped in the Explore sheet and the letters sheet, and restored on close.
- The Explore sheet locks background scroll; the canvas is `touch-action: none` so drags are never
  stolen by page scrolling.
- `prefers-reduced-motion` removes idle drift and shortens flights.
- Pinch-zoom is enabled on reading surfaces and is the documented way to magnify a section.

---

## 12. Performance notes

- One `Canvas`, 1,024² shadow map, `shadowMap.autoUpdate = false` with targeted refreshes.
- `AdaptiveDpr` lowers the pixel ratio in 0.25 steps when FPS stays under 45, and restores it when
  there is headroom, but never mid-flight.
- Text and art are cached per spec; a texture is only rebuilt when its font version changes.
- The 3D bundle is lazy-loaded (`React.lazy`) so the shell paints first.
- `SceneAudit` (dev only) publishes `data-meshes`, `data-textures`, `data-calls` and `data-fps` on
  `<html>` for quick inspection.

---

## 13. Deliberate exclusions

The starter is the room and the systems it needs, and nothing around it:

- no tour, walkthrough bar or onboarding card — the Explore menu and the objects in the room are
  the whole navigation;
- no separate reading view or modal photo viewer; paper and prints are read in the scene;
- no accounts, database, analytics, CMS, serverless functions or vendor SDK;
- no letter server: written letters live in this browser's `localStorage` only;
- no `.env` requirement, and no runtime network call beyond the Google Fonts stylesheet;
- no real names, letters, captions or photographs — every string and every print is a placeholder.

If the renderer cannot start, the shell shows a plain message and a **Try the room again** button
that remounts the canvas in place.

---

## 14. Verification

```bash
npm run build          # type-checks every file, then builds
npm run preview        # serve dist/ and open it
```

There is no test suite: the app is a visual, real-time scene. The practical check is to open the
overview, open two or three stations from the Explore menu, resize the window, and confirm the
camera reframes without a reload.

For a Pages build, `BASE_PATH=3d-room npm run build` produces the same asset URLs the workflow
publishes. Serve `dist/` under that subpath (for example `vite preview`) and check that the map,
music, sounds and bundles all come from `/3d-room/`.

### 14.1 What was verified

`npm run build` passes. A production build served at `/3d-room/` was driven in Chromium, Firefox
and WebKit: all sixteen stations opened, the map and music loaded from the Pages subpath, a letter
was written, found in `localStorage`, shown after a reload, and the phone sheet stayed inside a
390 × 844 viewport. No console errors or failed requests were reported by any engine.

export type StationKind =
  | 'letter'
  | 'album'
  | 'notebook'
  | 'monitor'
  | 'board'
  | 'polaroids'
  | 'medals'
  | 'mail'
  | 'fridge'
  | 'flowers'
  | 'kitchen'
  | 'tv'

export type SectionId = 'door' | 'kitchen' | 'wall' | 'table' | 'tv'

export interface Section {
  id: SectionId
  title: string
  note: string
}

export type Vec3 = [number, number, number]

export interface FrameBox {
  center: Vec3
  size: Vec3
}

export interface CriticalBox {
  id: string
  label: string
  box: FrameBox
}

export interface Station {
  n: number
  id: string
  section: SectionId
  title: string
  subtitle: string
  kind: StationKind
  albumIndex?: 0 | 1 | 2 | 3
  boardMode?: 'timeline' | 'map'
  camPos: Vec3
  camTarget: Vec3
  /** Where the object comes to rest when it floats out to be read. */
  anchor: Vec3
  /** Reading preset, derived once from the focus preset and the anchor. */
  readPos: Vec3
  readTarget: Vec3
  /** Direction from the focus volume toward the camera. */
  viewDir: Vec3
  /** Optional pan toward the most important face (for example a screen). */
  targetBias?: Vec3
  /** The closed station object, in metres, in world space. */
  focusBox: FrameBox
  /** The open/reading station object, including its in-world controls. */
  readBox: FrameBox
  /** Optional object-specific close view (flowers). */
  closeupBox?: FrameBox
  closeupDir?: Vec3
  /** Tight TV-only close view used by the full screen control. */
  cinemaBox?: FrameBox
  /** Optional portrait framing for a station whose wide read box loses the counter. */
  portraitBox?: FrameBox
  intro: string
}

const READ_CLOSER = 0.34

function moveCloser(from: Vec3, toward: Vec3): Vec3 {
  return [
    from[0] + (toward[0] - from[0]) * READ_CLOSER,
    from[1] + (toward[1] - from[1]) * READ_CLOSER,
    from[2] + (toward[2] - from[2]) * READ_CLOSER,
  ]
}

type StationSeed = Omit<
  Station,
  'readPos' | 'readTarget' | 'viewDir' | 'focusBox' | 'readBox'
> & { viewDir?: Vec3 }

function normalizeDirection(from: Vec3, toward: Vec3): Vec3 {
  const direction: Vec3 = [toward[0] - from[0], toward[1] - from[1], toward[2] - from[2]]
  const length = Math.hypot(...direction) || 1
  return direction.map((value) => value / length) as Vec3
}

function station(seed: StationSeed): Station {
  return {
    ...seed,
    readPos: moveCloser(seed.camPos, seed.anchor),
    readTarget: seed.anchor,
    viewDir: seed.viewDir
      ? normalizeDirection([0, 0, 0], seed.viewDir)
      : normalizeDirection(FRAME_BOXES[seed.id].focus.center, seed.camPos),
    focusBox: FRAME_BOXES[seed.id].focus,
    readBox: FRAME_BOXES[seed.id].read,
    closeupBox: seed.closeupBox ?? FRAME_BOXES[seed.id].closeup,
    cinemaBox: seed.cinemaBox ?? FRAME_BOXES[seed.id].cinema,
  }
}

const ALBUM_FOCUS: FrameBox = {
  center: [5.49, 1.36, -2.8],
  size: [0.22, 0.58, 0.44],
}

const ALBUM_READ: FrameBox = {
  // The tabs sit on the +z side of the open book. Include the full strip so
  // the read framing does not cut the fourth tab on a small screen.
  center: [4.0, 1.4, -2.74],
  size: [0.8, 1.3, 1.72],
}

const FRAME_BOXES: Record<
  string,
  { focus: FrameBox; read: FrameBox; closeup?: FrameBox; cinema?: FrameBox }
> = {
  mail: {
    focus: { center: [-5.36, 1.0, -2.48], size: [1.0, 0.72, 1.5] },
    read: { center: [-5.12, 1.6, -2.48], size: [1.0, 1.35, 0.72] },
  },
  fridge: {
    focus: { center: [-5.48, 0.98, -1.15], size: [1.05, 1.9, 1.08] },
    read: { center: [-5.28, 1.18, -1.15], size: [1.12, 1.35, 1.08] },
  },
  kitchen: {
    focus: { center: [-5.45, 1.6, 2.3], size: [1.1, 2.15, 2.75] },
    read: { center: [-5.35, 1.58, 2.42], size: [1.12, 1.95, 2.15] },
  },
  places: {
    focus: { center: [-0.55, 1.86, -4.15], size: [3.0, 1.8, 0.65] },
    read: { center: [-0.55, 1.58, -3.9], size: [2.5, 1.6, 1.0] },
  },
  polaroids: {
    focus: { center: [1.4, 2.08, -4.22], size: [1.95, 1.75, 0.65] },
    read: { center: [1.4, 1.98, -2.35], size: [1.25, 1.5, 1.0] },
  },
  timeline: {
    focus: { center: [3.55, 1.9, -4.15], size: [3.5, 2.1, 0.72] },
    read: { center: [3.55, 1.9, -3.45], size: [3.6, 2.0, 1.0] },
  },
  letter: {
    focus: { center: [5.2, 0.95, -3.32], size: [0.8, 0.3, 1.0] },
    read: { center: [4.3, 1.4, -1.25], size: [1.25, 1.25, 0.55] },
  },
  'album-one': {
    focus: ALBUM_FOCUS,
    read: ALBUM_READ,
  },
  'album-two': {
    focus: ALBUM_FOCUS,
    read: ALBUM_READ,
  },
  'album-three': {
    focus: ALBUM_FOCUS,
    read: ALBUM_READ,
  },
  'album-four': {
    focus: ALBUM_FOCUS,
    read: ALBUM_READ,
  },
  notebook: {
    focus: { center: [4.0, 1.36, -1.15], size: [1.0, 1.05, 0.5] },
    read: { center: [4.0, 1.34, -1.15], size: [0.9, 1.02, 0.4] },
  },
  ai: {
    focus: { center: [5.15, 1.2, -1.95], size: [0.38, 1.4, 1.4] },
    read: { center: [5.195, 1.22, -1.95], size: [0.12, 0.72, 1.06] },
  },
  medals: {
    focus: { center: [5.55, 1.82, 1.8], size: [1.0, 1.1, 2.1] },
    read: { center: [5.38, 1.82, 1.8], size: [1.28, 0.96, 1.2] },
  },
  flowers: {
    focus: { center: [5.65, 1.1, 1.84], size: [0.5, 1.05, 1.6] },
    read: { center: [5.02, 1.1, 1.85], size: [1.3, 0.95, 1.3] },
    closeup: { center: [5.58, 1.42, 1.84], size: [0.58, 0.58, 0.7] },
  },
  tv: {
    focus: { center: [-3.4, 1.24, -3.98], size: [2.6, 2.0, 0.72] },
    read: { center: [-3.4, 1.28, -3.96], size: [2.5, 1.55, 0.55] },
    cinema: { center: [-3.4, 1.28, -3.96], size: [2.16, 1.16, 0.18] },
  },
}

export const SECTIONS: Section[] = [
  { id: 'door', title: 'By the Door', note: 'placeholder letters' },
  { id: 'kitchen', title: 'Fridge & Kitchen', note: 'the warm end of the room' },
  { id: 'wall', title: 'The Wall', note: 'placeholder pins and photographs' },
  { id: 'table', title: 'By the Table', note: 'paper, albums, a small screen' },
  { id: 'tv', title: 'The TV', note: 'the last stop' },
]

/**
 * The sixteen places, in visit order. Room coordinates are metres.
 * Every word and photograph in this template is a placeholder.
 */
export const STATIONS: Station[] = [
  station({
    n: 1,
    id: 'mail',
    section: 'door',
    title: 'Letters',
    subtitle: 'placeholder letters',
    kind: 'mail',
    camPos: [-4.0, 1.6, -1.3],
    camTarget: [-5.4, 1.05, -2.45],
    anchor: [-5.16, 1.38, -2.48],
    intro: 'Placeholder intro. These envelopes hold placeholder letters you can replace.',
  }),
  station({
    n: 2,
    id: 'fridge',
    section: 'kitchen',
    title: 'Fridge',
    subtitle: 'two small games on a door',
    kind: 'fridge',
    // The door faces +x (rotation-y pi/2). Focus and read cameras sit within
    // 8 degrees of the door's outward normal so the game surface is square to
    // the viewer and the side handles never graze a column on any size.
    viewDir: [1, 0.045, 0],
    camPos: [-3.78, 1.48, -0.25],
    camTarget: [-5.16, 1.08, -1.15],
    anchor: [-5.1, 1.12, -1.15],
    intro: 'Placeholder intro for the fridge door and its two placeholder games.',
  }),
  station({
    n: 3,
    id: 'kitchen',
    section: 'kitchen',
    title: 'Kitchen',
    subtitle: 'framed placeholders',
    kind: 'kitchen',
    camPos: [-3.45, 1.62, 0.85],
    camTarget: [-5.5, 1.34, 2.3],
    anchor: [-5.24, 1.32, 2.35],
    portraitBox: { center: [-5.45, 1.45, 2.42], size: [0.96, 1.55, 2.05] },
    intro: 'Placeholder intro for the kitchen wall and its placeholder frames.',
  }),
  station({
    n: 4,
    id: 'places',
    section: 'wall',
    title: 'Places',
    subtitle: 'a map with placeholder pins',
    kind: 'board',
    boardMode: 'map',
    camPos: [-0.55, 1.9, -1.0],
    camTarget: [-0.55, 1.85, -4.42],
    anchor: [-0.55, 1.76, -4.05],
    intro: 'Placeholder intro for the map board. Each pin can hold a place and a note.',
  }),
  station({
    n: 5,
    id: 'polaroids',
    section: 'wall',
    title: 'Photos',
    subtitle: 'draggable placeholders',
    kind: 'polaroids',
    camPos: [1.4, 1.95, -0.8],
    camTarget: [1.4, 2.02, -4.42],
    anchor: [1.4, 1.98, -2.35],
    intro: 'Placeholder intro for the pinned photographs. Drag them, replace them.',
  }),
  station({
    n: 6,
    id: 'timeline',
    section: 'wall',
    title: 'Timeline',
    subtitle: 'placeholder notes, in order',
    kind: 'board',
    boardMode: 'timeline',
    camPos: [3.55, 1.95, -0.9],
    camTarget: [3.55, 1.9, -4.42],
    anchor: [3.55, 1.98, -3.28],
    intro: 'Placeholder intro for the timeline. One note per placeholder moment.',
  }),
  station({
    n: 7,
    id: 'letter',
    section: 'table',
    title: 'The Letter',
    subtitle: 'a placeholder page on the table',
    kind: 'letter',
    camPos: [4.04, 1.6, 0.72],
    camTarget: [5.2, 0.98, -3.32],
    anchor: [4.3, 1.42, -1.25],
    intro: 'Placeholder intro for the letter. Replace the four paragraphs in the data file.',
  }),
  station({
    n: 8,
    id: 'album-one',
    section: 'table',
    title: 'Album One',
    subtitle: 'placeholder spreads',
    kind: 'album',
    albumIndex: 0,
    viewDir: [-1, 0.06, 0],
    camPos: [3.9, 1.6, 0.9],
    camTarget: [5.55, 1.18, -2.7],
    anchor: [4.0, 1.4, -2.8],
    intro: 'Placeholder intro for the first album.',
  }),
  station({
    n: 9,
    id: 'album-two',
    section: 'table',
    title: 'Album Two',
    subtitle: 'placeholder spreads',
    kind: 'album',
    albumIndex: 1,
    viewDir: [-1, 0.06, 0],
    camPos: [3.9, 1.6, 0.9],
    camTarget: [5.55, 1.18, -2.7],
    anchor: [4.0, 1.4, -2.8],
    intro: 'Placeholder intro for the second album.',
  }),
  station({
    n: 10,
    id: 'album-three',
    section: 'table',
    title: 'Album Three',
    subtitle: 'placeholder spreads',
    kind: 'album',
    albumIndex: 2,
    viewDir: [-1, 0.06, 0],
    camPos: [3.9, 1.6, 0.9],
    camTarget: [5.55, 1.18, -2.7],
    anchor: [4.0, 1.4, -2.8],
    intro: 'Placeholder intro for the third album.',
  }),
  station({
    n: 11,
    id: 'album-four',
    section: 'table',
    title: 'Album Four',
    subtitle: 'placeholder pairs',
    kind: 'album',
    albumIndex: 3,
    viewDir: [-1, 0.06, 0],
    camPos: [3.9, 1.6, 0.9],
    camTarget: [5.55, 1.18, -2.7],
    anchor: [4.0, 1.4, -2.8],
    intro: 'Placeholder intro for the fourth album.',
  }),
  station({
    n: 12,
    id: 'notebook',
    section: 'table',
    title: 'The Notebook',
    subtitle: 'placeholder pages with tabs',
    kind: 'notebook',
    // The open notebook reads at rotation [-0.03, -0.03, 0], so its face
    // normal is ~[0.03, 0.03, 1]. Focus and read cameras stay within 8
    // degrees of that normal, centred on the spread.
    viewDir: [0.16, 0.14, 0.98],
    camPos: [4.7, 1.72, 0.3],
    camTarget: [4.0, 1.32, -1.15],
    anchor: [3.92, 1.33, -1.15],
    intro: 'Placeholder intro for the notebook. Two tabbed placeholder sections.',
  }),
  station({
    n: 13,
    id: 'ai',
    section: 'table',
    title: 'The Monitor',
    subtitle: 'a placeholder AI screen',
    kind: 'monitor',
    camPos: [3.55, 1.45, -1.55],
    camTarget: [5.18, 1.24, -1.95],
    anchor: [5.16, 1.23, -1.95],
    intro: 'Placeholder intro for the monitor. It answers locally until you add an API.',
  }),
  station({
    n: 14,
    id: 'medals',
    section: 'table',
    title: 'The Shelf',
    subtitle: 'placeholder awards',
    kind: 'medals',
    camPos: [3.88, 1.66, 0.62],
    camTarget: [5.86, 1.56, 1.8],
    anchor: [5.2, 1.56, 1.8],
    intro: 'Placeholder intro for the shelf and its five placeholder awards.',
  }),
  station({
    n: 15,
    id: 'flowers',
    section: 'table',
    title: 'The Flowers',
    subtitle: 'a placeholder card per flower',
    kind: 'flowers',
    camPos: [4.0, 1.82, 2.1],
    camTarget: [5.4, 0.3, 1.85],
    anchor: [4.82, 0.94, 1.86],
    // The close-up frames the HEAD cluster (the blooms themselves), not the
    // vase: petal rings stay discernible with the heads filling the frame.
    closeupBox: { center: [5.55, 1.4, 1.84], size: [0.46, 0.4, 0.54] },
    closeupDir: [-1, 0.06, 0],
    intro: 'Placeholder intro for the flowers. Each bloom holds a placeholder card.',
  }),
  station({
    n: 16,
    id: 'tv',
    section: 'tv',
    title: 'The TV',
    subtitle: 'channels and a letters envelope',
    kind: 'tv',
    camPos: [-3.4, 1.52, -0.9],
    camTarget: [-3.4, 1.23, -4.0],
    anchor: [-3.4, 1.28, -3.96],
    intro: 'Placeholder intro for the television, its channels and its envelope.',
  }),
]

export const OVERVIEW_TARGET: Vec3 = [0, 1.05, -0.35]

export const OVERVIEW_CRITICAL_BOXES: CriticalBox[] = [
  {
    id: 'mail-door',
    label: 'door and mail counter',
    box: { center: [-5.4, 1.5, -2.8], size: [1.2, 1.95, 2.9] },
  },
  {
    id: 'fridge',
    label: 'fridge games',
    box: { center: [-5.5, 1.0, -1.15], size: [1.1, 1.9, 1.1] },
  },
  {
    id: 'kitchen',
    label: 'kitchen run',
    box: { center: [-5.45, 1.6, 2.0], size: [1.3, 2.7, 3.4] },
  },
  {
    id: 'tv',
    label: 'TV and console',
    box: { center: [-3.4, 1.28, -4.02], size: [2.9, 2.1, 0.9] },
  },
  {
    id: 'map',
    label: 'map board',
    box: { center: [-0.55, 1.9, -4.15], size: [3.3, 1.95, 0.7] },
  },
  {
    id: 'polaroids',
    label: 'polaroid wall',
    box: { center: [1.4, 2.08, -4.22], size: [2.1, 1.85, 0.7] },
  },
  {
    id: 'timeline',
    label: 'timeline pinboard',
    box: { center: [3.55, 1.9, -4.16], size: [3.5, 2.1, 0.7] },
  },
  {
    id: 'table',
    label: 'table, letter and monitor',
    box: { center: [5.1, 1.4, -2.4], size: [1.8, 2.0, 3.2] },
  },
  {
    id: 'bookshelf',
    label: 'bookshelf and albums',
    box: { center: [5.55, 1.2, -2.7], size: [1.0, 2.2, 2.5] },
  },
  {
    id: 'medals-flowers',
    label: 'shelf and flowers',
    box: { center: [5.55, 1.4, 1.8], size: [1.2, 2.1, 2.2] },
  },
]

export const STATION_COUNT = STATIONS.length

export function stationByNumber(n: number): Station | undefined {
  return STATIONS.find((entry) => entry.n === n)
}

export function stationById(id: string | null | undefined): Station | undefined {
  if (!id) return undefined
  return STATIONS.find((entry) => entry.id === id)
}

export function stationsInSection(section: SectionId): Station[] {
  return STATIONS.filter((entry) => entry.section === section)
}

export function albumStations(): Station[] {
  return STATIONS.filter((entry) => entry.kind === 'album')
}

export function boardStations(): Station[] {
  return STATIONS.filter((entry) => entry.kind === 'board')
}

/** Neighbour within the visitable range. */
export function adjacentStation(current: Station, direction: 1 | -1): Station | undefined {
  const target = current.n + direction
  if (target < 1 || target > STATION_COUNT) return undefined
  return stationByNumber(target)
}

export function parseStationHash(hash: string): string | null {
  // The TV's letter is a view of the station, not a separate page, so its
  // shareable URL is the station hash with a /letters suffix.
  const match = hash.match(/^#\/station\/([a-z0-9-]+)(?:\/letters)?$/)
  if (!match) return null
  const target = stationById(match[1])
  if (!target) return null
  if (hash.endsWith('/letters') && target.id !== 'tv') return null
  return target.id
}

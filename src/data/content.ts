/**
 * PLACEHOLDER CONTENT
 * -------------------
 * Every word and photograph in this template is a placeholder. Replace the
 * values below with your own copy and, optionally, point `art.src` at a real
 * image under /public/media.
 *
 * The room reads this file for all in-world text, so no station component
 * needs editing to change copy.
 */

export type ArtTone = 'rose' | 'leaf' | 'gold' | 'plum' | 'cream' | 'blue'
export type ArtMotif = 'arch' | 'portrait' | 'window' | 'garden' | 'landscape'

export interface ArtSpec {
  seed: number
  tone: ArtTone
  motif: ArtMotif
  label: string
  /** Optional real photograph under public/media. Omit for the placeholder art. */
  src?: string
}

export interface LetterContent {
  greeting: string
  paragraphs: string[]
  sign: string
}

export interface MemoryPair {
  id: string
  label: string
  caption: string
  tone: ArtTone
  photo: ArtSpec
}

export interface QuizQuestion {
  prompt: string
  options: [string, string, string]
  answer: 0 | 1 | 2
}

export interface KitchenFrame {
  id: string
  title: string
  caption: string
  art: ArtSpec
}

export interface Place {
  id: string
  title: string
  note: string
  x: number
  y: number
  /** Real map centre (latitude, longitude) for your own place. */
  mapCenter: [number, number]
  art: ArtSpec
  photos: Array<{ id: string; art: ArtSpec; caption: string }>
}

export interface Polaroid {
  id: string
  caption: string
  note: string
  x: number
  y: number
  tilt: number
  art: ArtSpec
}

export interface TimelineNote {
  id: string
  title: string
  body: string
  year?: string
  art?: ArtSpec
}

export interface AlbumPageContent {
  title: string
  body: string
  hand?: string
  art?: ArtSpec
  /** Fraction of the page height the print occupies. */
  artHeight?: number
}

export interface SliderPage {
  before: ArtSpec
  after: ArtSpec
  beforeLabel: string
  afterLabel: string
  caption: string
}

export interface AlbumSpread {
  left: AlbumPageContent
  right: AlbumPageContent
  slider?: SliderPage
}

export interface AlbumContent {
  index: 0 | 1 | 2 | 3
  stationId: string
  number: string
  title: string
  hand: string
  coverTone: ArtTone
  coverAccent: string
  spreads: AlbumSpread[]
}

export interface NotebookEntry {
  title: string
  body: string
  hand?: string
  art?: ArtSpec
}

export interface NotebookSection {
  label: string
  hand: string
  entries: NotebookEntry[]
}

export interface MonitorChip {
  question: string
  answer: string
}

export interface MedalAward {
  title: string
  line: string
  tone: ArtTone
}

export interface FlowerCard {
  kind: string
  text: string
  tone: ArtTone
  photo?: ArtSpec
}

export interface TvChannel {
  title: string
  subtitle: string
  motif: ArtMotif
  tone: ArtTone
  /** A local file under public/media. */
  video?: string
  /** A photograph under public/media, used as the channel image. */
  photo?: string
  /** Show the image without the channel caption overlay. */
  poster?: boolean
}

export interface DefaultLetter {
  id: string
  name: string
  message: string
}

const art = (seed: number, tone: ArtTone, motif: ArtMotif, label: string): ArtSpec => ({
  seed,
  tone,
  motif,
  label,
})

const TONES: ArtTone[] = ['rose', 'gold', 'leaf', 'plum', 'cream', 'blue']
const toneAt = (index: number) => TONES[index % TONES.length]

export const letterContent: LetterContent = {
  greeting: 'Dear you,',
  paragraphs: [
    'This is placeholder letter copy. Replace this paragraph with the first thing you want to say.',
    'This is the second placeholder paragraph. It can be about an ordinary day, a small habit, or a memory you keep returning to.',
    'This is the third placeholder paragraph. Keep each paragraph short enough to sit comfortably on the paper.',
    'This is placeholder sign-off copy. The last line should feel like you.',
  ],
  sign: 'Your name',
}

export const defaultLetters: DefaultLetter[] = [
  {
    id: 'placeholder-1',
    name: 'Guest One',
    message: 'Placeholder letter one. Replace this with a short letter from someone you love.',
  },
  {
    id: 'placeholder-2',
    name: 'Guest Two',
    message: 'Placeholder letter two. Letters appear as envelopes on the hall counter.',
  },
  {
    id: 'placeholder-3',
    name: 'Guest Three',
    message: 'Placeholder letter three. Add as many as you like in this file.',
  },
]

const FRIDGE_LABELS = ['PAIR 01', 'PAIR 02', 'PAIR 03', 'PAIR 04', 'PAIR 05', 'PAIR 06']
const FRIDGE_TONES: ArtTone[] = ['rose', 'leaf', 'blue', 'gold', 'plum', 'cream']
export const fridgePairs: MemoryPair[] = FRIDGE_LABELS.map((label, index) => ({
  id: `fridge-${index + 1}`,
  label,
  caption: `Placeholder memory caption ${index + 1}.`,
  tone: FRIDGE_TONES[index] ?? 'gold',
  photo: art(201 + index, FRIDGE_TONES[index] ?? 'gold', 'window', `Placeholder ${label}`),
}))

export const fridgeQuestions: QuizQuestion[] = [
  {
    prompt: 'Placeholder question one?',
    options: ['Placeholder answer A', 'Placeholder answer B', 'Placeholder answer C'],
    answer: 0,
  },
  {
    prompt: 'Placeholder question two?',
    options: ['Placeholder answer A', 'Placeholder answer B', 'Placeholder answer C'],
    answer: 1,
  },
  {
    prompt: 'Placeholder question three?',
    options: ['Placeholder answer A', 'Placeholder answer B', 'Placeholder answer C'],
    answer: 2,
  },
]

export const kitchenFrames: KitchenFrame[] = Array.from({ length: 5 }, (_, index) => ({
  id: `kitchen-${index + 1}`,
  title: `Placeholder frame ${index + 1}`,
  caption: 'Placeholder caption. Swap in a photograph and a line of copy.',
  art: art(31 + index, toneAt(index), 'window', 'Placeholder photograph'),
}))

export const kitchenCopy = {
  kitchenNote: 'Placeholder kitchen note. The frames on this wall are placeholders too.',
}

const PLACE_NOTES = [
  'placeholder note for the first pin',
  'placeholder note for the second pin',
  'placeholder note for the third pin',
  'placeholder note for the fourth pin',
]
const PLACE_PINS: Array<[number, number]> = [
  [0.22, 0.22],
  [0.74, 0.24],
  [0.23, 0.73],
  [0.75, 0.72],
]
/**
 * Demo pin positions (latitude, longitude) on the equirectangular map. They sit
 * far apart on different continents so the four pins never overlap; replace
 * them with your own places.
 */
const PLACE_MAP_CENTERS: Array<[number, number]> = [
  [48.86, 2.35],
  [35.68, 139.69],
  [-33.86, 151.21],
  [-22.95, -43.2],
]
export const places: Place[] = PLACE_PINS.map((pin, index) => ({
  id: `place-${index + 1}`,
  title: `Place ${index + 1}`,
  note: PLACE_NOTES[index],
  x: pin[0],
  y: pin[1],
  mapCenter: PLACE_MAP_CENTERS[index],
  art: art(41 + index, toneAt(index), 'landscape', 'Placeholder photograph'),
  photos: [
    {
      id: `place-${index + 1}-1`,
      caption: 'Placeholder photograph for this pin.',
      art: art(400 + index, toneAt(index), 'landscape', 'Placeholder photograph'),
    },
  ],
}))

const POLAROID_POSITIONS: Array<[number, number]> = [
  [0.08, 0.76], [0.3, 0.78], [0.52, 0.75], [0.74, 0.79], [0.92, 0.74],
  [0.1, 0.46], [0.32, 0.48], [0.54, 0.45], [0.76, 0.49], [0.93, 0.44],
  [0.14, 0.16], [0.36, 0.18], [0.58, 0.14], [0.8, 0.18],
]
export const polaroids: Polaroid[] = POLAROID_POSITIONS.map((position, index) => ({
  id: `polaroid-${index + 1}`,
  caption: `Placeholder photo ${index + 1}`,
  note: 'Placeholder note. Handwritten captions live here.',
  x: position[0],
  y: position[1],
  tilt: index % 3 === 0 ? -0.055 : index % 3 === 1 ? 0.045 : 0.015,
  art: art(51 + index, toneAt(index), 'portrait', 'Placeholder photograph'),
}))

export const timelineNotes: TimelineNote[] = Array.from({ length: 12 }, (_, index) => ({
  id: `timeline-${index + 1}`,
  title: `Placeholder moment ${index + 1}`,
  body: 'Placeholder note for this pinned moment. Replace it with a sentence or two.',
  year: `Year ${String(index + 1).padStart(2, '0')}`,
  art: art(61 + index, toneAt(index), 'window', 'Placeholder photograph'),
}))

const page = (
  title: string,
  body: string,
  seed: number,
  tone: ArtTone,
  motif: ArtMotif,
  hand?: string,
): AlbumPageContent => ({
  title,
  body,
  hand,
  art: art(seed, tone, motif, 'Placeholder photograph'),
})

const spreadPair = (albumIndex: number, spreadIndex: number): AlbumSpread => {
  const seed = 700 + albumIndex * 20 + spreadIndex * 2
  return {
    left: page(
      `Placeholder title`,
      'Placeholder album copy. One print per page, with room for a caption underneath.',
      seed,
      toneAt(albumIndex + spreadIndex),
      'portrait',
      'a placeholder note',
    ),
    right: page(
      `Placeholder title`,
      'Placeholder album copy. Replace the photograph and this line in the data file.',
      seed + 1,
      toneAt(albumIndex + spreadIndex + 1),
      'portrait',
      'a placeholder note',
    ),
  }
}

export const albums: AlbumContent[] = [
  {
    index: 0,
    stationId: 'album-one',
    number: 'one',
    title: 'Album One',
    hand: 'placeholder subtitle',
    coverTone: 'rose',
    coverAccent: '#E7C878',
    spreads: [spreadPair(0, 0), spreadPair(0, 1), spreadPair(0, 2), spreadPair(0, 3)],
  },
  {
    index: 1,
    stationId: 'album-two',
    number: 'two',
    title: 'Album Two',
    hand: 'placeholder subtitle',
    coverTone: 'leaf',
    coverAccent: '#E7C878',
    spreads: [spreadPair(1, 0), spreadPair(1, 1), spreadPair(1, 2), spreadPair(1, 3)],
  },
  {
    index: 2,
    stationId: 'album-three',
    number: 'three',
    title: 'Album Three',
    hand: 'placeholder subtitle',
    coverTone: 'gold',
    coverAccent: '#F8E1A9',
    spreads: [spreadPair(2, 0), spreadPair(2, 1), spreadPair(2, 2), spreadPair(2, 3)],
  },
  {
    index: 3,
    stationId: 'album-four',
    number: 'four',
    title: 'Album Four',
    hand: 'placeholder pairs, years apart',
    coverTone: 'plum',
    coverAccent: '#E7C878',
    spreads: [
      {
        ...spreadPair(3, 0),
        slider: {
          before: art(780, 'cream', 'portrait', 'Placeholder earlier photograph'),
          after: art(781, 'plum', 'portrait', 'Placeholder later photograph'),
          beforeLabel: 'Before',
          afterLabel: 'After',
          caption: 'Drag the gold handle. Two placeholders, side by side.',
        },
      },
      spreadPair(3, 1),
      spreadPair(3, 2),
      spreadPair(3, 3),
    ],
  },
]

export const albumBookCover = {
  title: 'The Albums',
  hand: 'four albums, one book',
  tone: 'gold' as ArtTone,
  accent: '#E7C878',
}

export const notebookSections: NotebookSection[] = [
  {
    label: 'Section One',
    hand: 'placeholder notes',
    entries: Array.from({ length: 5 }, (_, index) => ({
      title: 'Placeholder note',
      body: `Placeholder notebook line ${index + 1}. Replace it in the data file.`,
      art: index < 2 ? art(101 + index, toneAt(index), 'window', 'Placeholder photograph') : undefined,
    })),
  },
  {
    label: 'Section Two',
    hand: 'more placeholder notes',
    entries: Array.from({ length: 5 }, (_, index) => ({
      title: 'Placeholder note',
      body: `Another placeholder notebook line ${index + 1}.`,
      art: index < 2 ? art(103 + index, toneAt(index), 'landscape', 'Placeholder photograph') : undefined,
    })),
  },
]

export const notebookExtraSpreads: AlbumSpread[] = Array.from({ length: 4 }, (_, index) => ({
  left: page(
    'Placeholder page',
    'Placeholder notebook photograph page.',
    900 + index * 2,
    toneAt(index),
    'portrait',
  ),
  right: page(
    'Placeholder page',
    'Placeholder notebook photograph page.',
    901 + index * 2,
    toneAt(index + 1),
    'portrait',
  ),
}))

export const monitorContent = {
  title: 'Ask the room',
  standby: 'The screen is asleep. Touch a question when you are ready.',
  intro: 'Three placeholder questions. Add an API to answer freely.',
  chips: [
    {
      question: 'What is this room?',
      answer:
        'This is a placeholder answer from the local content file. Wire an API and the same screen can answer anything you like.',
    },
    {
      question: 'How do I change the text?',
      answer:
        'Open src/data/content.ts and replace the placeholder strings. Every station reads its copy from there.',
    },
    {
      question: 'Where do photographs go?',
      answer:
        'Drop files in public/media and point an art spec at them with src. Without a src, the room draws a placeholder motif instead.',
    },
  ] satisfies MonitorChip[],
  fallback:
    'This is a placeholder answer. The template answers locally until you connect an API endpoint.',
  unavailable: 'No answer right now. The placeholder API is not connected.',
  micUnavailable: 'Voice input is not available in this browser.',
  chatLabel: 'Ask the room',
  chatPlaceholder: 'Ask anything',
  chatNote: 'One short answer at a time.',
  chatSend: 'Ask',
  chatSending: 'Asking',
  chatThinking: 'Thinking',
}

export const medalAwards: MedalAward[] = [
  { title: 'Placeholder Award One', line: 'Placeholder line for this award.', tone: 'gold' },
  { title: 'Placeholder Award Two', line: 'Placeholder line for this award.', tone: 'rose' },
  { title: 'Placeholder Award Three', line: 'Placeholder line for this award.', tone: 'cream' },
  { title: 'Placeholder Award Four', line: 'Placeholder line for this award.', tone: 'leaf' },
  { title: 'Placeholder Award Five', line: 'Placeholder line for this award.', tone: 'plum' },
]

export const flowerCards: FlowerCard[] = Array.from({ length: 7 }, (_, index) => ({
  kind: 'a placeholder reason',
  text: `Placeholder card ${index + 1}. Each flower can hold a reason, a memory or a quote.`,
  tone: toneAt(index),
}))


export const tvFeatureChannel: TvChannel = {
  title: 'Placeholder Channel',
  subtitle: 'replace with a film',
  motif: 'portrait',
  tone: 'gold',
}

export const tvEndingChannel: TvChannel = {
  title: 'The Last Frame',
  subtitle: 'a placeholder closing card',
  motif: 'portrait',
  tone: 'plum',
}

export const tvContent = {
  channels: [
    {
      title: 'Placeholder Channel One',
      subtitle: 'add photo or video to this channel',
      motif: 'arch' as ArtMotif,
      tone: 'rose' as ArtTone,
    },
    {
      title: 'Placeholder Channel Two',
      subtitle: 'add photo or video to this channel',
      motif: 'arch' as ArtMotif,
      tone: 'leaf' as ArtTone,
    },
    {
      title: 'Placeholder Channel Three',
      subtitle: 'add photo or video to this channel',
      motif: 'arch' as ArtMotif,
      tone: 'blue' as ArtTone,
    },
    tvFeatureChannel,
    tvEndingChannel,
  ] satisfies TvChannel[],
  cinemaHint: 'The cinema disc brings the screen closer.',
  bouquetNote: 'The vase on the console grows with the places you have visited.',
  ending: 'The last channel is a placeholder closing card.',
}

export const exploreLetter = {
  label: 'Leave a letter',
  note: 'Open the composer and write a few words.',
}

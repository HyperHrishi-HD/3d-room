import { useEffect, useMemo, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import type { ArtSpec, ArtTone } from '../data/content'
import {
  getMediaImage,
  getMediaImageByPath,
  getMediaVersion,
  preloadMediaSlots,
  subscribeMedia,
} from '../lib/mediaCache'

export type CanvasFont = 'display' | 'hand' | 'body'

export interface TextBlock {
  type?: 'text' | 'rule' | 'spacer'
  text?: string
  font?: CanvasFont
  size?: number
  color?: string
  align?: CanvasTextAlign
  lineHeight?: number
  weight?: number
  italic?: boolean
  letterSpacing?: number
  maxLines?: number
  gapAfter?: number
}

export interface TextTextureSpec {
  width?: number
  height?: number
  background?: string
  padding?: number
  border?: 'none' | 'paper' | 'gold'
  art?: ArtSpec
  artHeight?: number
  blocks: TextBlock[]
  /** Ready for real media later; not used by the framework. */
  image?: CanvasImageSource
  imageRect?: { x: number; y: number; width: number; height: number }
  grain?: boolean
}

const PAPER = '#F5EFE2'
const INK = '#2A2118'
const GOLD = '#C9A24B'
const INK_SOFT = 'rgba(42, 33, 24, 0.72)'

const FONT_STACKS: Record<CanvasFont, string> = {
  display: "Georgia, 'Times New Roman', serif",
  hand: "Caveat, 'Segoe Script', cursive",
  body: "Georgia, 'Times New Roman', serif",
}

const TONES: Record<ArtTone, { bg: string; deep: string; soft: string; paper: string }> = {
  rose: { bg: '#C96F6F', deep: '#8E4448', soft: '#E8B0A0', paper: '#F1D9C8' },
  leaf: { bg: '#5F7A4E', deep: '#3F5637', soft: '#A7B989', paper: '#DDE2C7' },
  gold: { bg: '#C9A24B', deep: '#8D6A2C', soft: '#F2D18A', paper: '#F5E5C2' },
  plum: { bg: '#593346', deep: '#3A1F30', soft: '#A8788D', paper: '#E7CFD6' },
  cream: { bg: '#D8C7A8', deep: '#8E7653', soft: '#F3E8D2', paper: '#F8F0DF' },
  blue: { bg: '#6F9297', deep: '#42666B', soft: '#B9D2CD', paper: '#D9E7E1' },
}

let fontVersion = 0
let fontsStarted = false
const fontListeners = new Set<() => void>()

function bumpFonts() {
  fontVersion += 1
  for (const listener of fontListeners) listener()
}

function startFontLoading() {
  if (fontsStarted || typeof document === 'undefined') return
  fontsStarted = true
  preloadMediaSlots()
  const announce = () => bumpFonts()
  void document.fonts
    .load('600 40px Caveat')
    .then(() => document.fonts.load('500 32px Caveat'))
    .then(announce)
    .catch(() => announce())
  document.fonts.ready.then(announce).catch(() => undefined)
}

function subscribeFonts(listener: () => void) {
  startFontLoading()
  fontListeners.add(listener)
  const stopMedia = subscribeMedia(listener)
  return () => {
    fontListeners.delete(listener)
    stopMedia()
  }
}

export function useFontVersion(): number {
  return useSyncExternalStore(
    subscribeFonts,
    () => fontVersion + getMediaVersion(),
    () => 0,
  )
}

function fontString(
  font: CanvasFont = 'body',
  size = 32,
  weight = 400,
  italic = false,
): string {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT_STACKS[font]}`
}

function seeded(seed: number) {
  let value = Math.max(1, Math.floor(seed))
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = Number.POSITIVE_INFINITY,
): string[] {
  const lines: string[] = []
  const paragraphs = text.split('\n')
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('')
      if (lines.length >= maxLines) return lines.slice(0, maxLines)
      continue
    }
    const words = paragraph.trim().split(/\s+/)
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width <= maxWidth || line === '') {
        line = next
      } else {
        lines.push(line)
        line = word
        if (lines.length >= maxLines) return lines.slice(0, maxLines)
      }
    }
    if (line) lines.push(line)
    if (lines.length >= maxLines) return lines.slice(0, maxLines)
  }
  return lines
}

function drawPaper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: string,
  grain: boolean,
) {
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  if (!grain) return
  const random = seeded(width * 7 + height * 13)
  ctx.fillStyle = 'rgba(96, 73, 43, 0.045)'
  for (let index = 0; index < 320; index += 1) {
    const x = random() * width
    const y = random() * height
    const radius = 0.4 + random() * 1.2
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(96, 73, 43, 0.075)'
  ctx.lineWidth = 1
  for (let index = 0; index < 14; index += 1) {
    const y = random() * height
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y + (random() - 0.5) * 3)
    ctx.stroke()
  }
}

function drawMotif(
  ctx: CanvasRenderingContext2D,
  art: ArtSpec,
  x: number,
  y: number,
  width = 0,
  height = 0,
) {
  const media = art.src ? getMediaImageByPath(art.src) : getMediaImage(art.seed)
  if (media && media.naturalWidth > 0 && media.naturalHeight > 0 && width > 0 && height > 0) {
    drawImageContained(ctx, media, x, y, width, height)
    return
  }
  drawMotifPlaceholder(ctx, art, x, y, width, height)
}

/**
 * Draws the whole photograph inside the frame. The soft blurred fill behind it
 * keeps portrait prints from looking like they have hard black bars, while the
 * photograph itself is never cropped in any direction.
 */
export function drawImageContained(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const image = media as CanvasImageSource & {
    naturalWidth?: number
    naturalHeight?: number
    width?: number
    height?: number
  }
  const imageWidth = image.naturalWidth || image.width || 1
  const imageHeight = image.naturalHeight || image.height || 1
  const cover = Math.max(width / imageWidth, height / imageHeight)
  const coverWidth = imageWidth * cover
  const coverHeight = imageHeight * cover
  const contain = Math.min(width / imageWidth, height / imageHeight)
  const drawWidth = imageWidth * contain
  const drawHeight = imageHeight * contain

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, width, height)
  ctx.clip()
  ctx.fillStyle = '#D9CBB4'
  ctx.fillRect(x, y, width, height)
  ctx.globalAlpha = 0.6
  ctx.filter = 'blur(18px)'
  ctx.drawImage(
    media,
    x + (width - coverWidth) / 2,
    y + (height - coverHeight) / 2,
    coverWidth,
    coverHeight,
  )
  ctx.filter = 'none'
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(42, 33, 24, 0.18)'
  ctx.fillRect(x, y, width, height)
  ctx.drawImage(
    media,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  )
  ctx.restore()
}

function drawMotifPlaceholder(
  ctx: CanvasRenderingContext2D,
  art: ArtSpec,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const tone = TONES[art.tone]
  const random = seeded(art.seed)
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height)
  gradient.addColorStop(0, tone.paper)
  gradient.addColorStop(1, tone.bg)
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, width, height)

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, width, height)
  ctx.clip()
  ctx.globalAlpha = 0.32
  ctx.fillStyle = tone.deep
  ctx.beginPath()
  ctx.arc(x + width * 0.78, y + height * 0.2, width * 0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  const unit = Math.min(width, height)
  ctx.strokeStyle = tone.deep
  ctx.fillStyle = tone.deep
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (art.motif === 'arch') {
    ctx.save()
    ctx.globalAlpha = 0.2
    ctx.beginPath()
    ctx.moveTo(x + width * 0.26, y + height * 0.88)
    ctx.lineTo(x + width * 0.26, y + height * 0.52)
    ctx.arc(x + width * 0.5, y + height * 0.52, width * 0.24, Math.PI, 0)
    ctx.lineTo(x + width * 0.74, y + height * 0.88)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    ctx.strokeStyle = tone.paper
    ctx.globalAlpha = 0.58
    ctx.lineWidth = unit * 0.008
    ctx.beginPath()
    ctx.moveTo(x + width * 0.34, y + height * 0.86)
    ctx.lineTo(x + width * 0.34, y + height * 0.55)
    ctx.arc(x + width * 0.5, y + height * 0.55, width * 0.16, Math.PI, 0)
    ctx.lineTo(x + width * 0.66, y + height * 0.86)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = tone.soft
    ctx.beginPath()
    ctx.arc(x + width * 0.5, y + height * 0.58, unit * 0.055, 0, Math.PI * 2)
    ctx.fill()
  } else if (art.motif === 'portrait') {
    ctx.save()
    ctx.globalAlpha = 0.22
    ctx.beginPath()
    ctx.ellipse(x + width * 0.5, y + height * 0.42, width * 0.16, height * 0.16, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x + width * 0.25, y + height * 0.88)
    ctx.quadraticCurveTo(x + width * 0.5, y + height * 0.5, x + width * 0.75, y + height * 0.88)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = tone.paper
    ctx.lineWidth = unit * 0.006
    ctx.beginPath()
    ctx.arc(x + width * 0.62, y + height * 0.24, width * 0.07, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  } else if (art.motif === 'window') {
    const wx = x + width * 0.24
    const wy = y + height * 0.18
    const ww = width * 0.52
    const wh = height * 0.56
    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.fillStyle = tone.deep
    ctx.fillRect(wx, wy, ww, wh)
    ctx.restore()
    ctx.strokeStyle = tone.paper
    ctx.globalAlpha = 0.66
    ctx.lineWidth = unit * 0.012
    ctx.strokeRect(wx, wy, ww, wh)
    ctx.beginPath()
    ctx.moveTo(wx + ww / 2, wy)
    ctx.lineTo(wx + ww / 2, wy + wh)
    ctx.moveTo(wx, wy + wh / 2)
    ctx.lineTo(wx + ww, wy + wh / 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = tone.soft
    ctx.beginPath()
    ctx.arc(wx + ww * 0.3, wy + wh * 0.3, ww * 0.12, 0, Math.PI * 2)
    ctx.fill()
  } else if (art.motif === 'garden') {
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = tone.deep
    ctx.lineWidth = unit * 0.007
    const baseY = y + height * 0.86
    for (let index = 0; index < 6; index += 1) {
      const stemX = x + width * (0.18 + index * 0.13)
      const stemTop = y + height * (0.3 + random() * 0.34)
      ctx.beginPath()
      ctx.moveTo(stemX, baseY)
      ctx.quadraticCurveTo(stemX - width * 0.02, (baseY + stemTop) / 2, stemX + width * 0.01, stemTop)
      ctx.stroke()
      ctx.fillStyle = index % 2 === 0 ? tone.soft : tone.deep
      ctx.beginPath()
      ctx.arc(stemX + width * 0.01, stemTop, unit * 0.03, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  } else {
    ctx.globalAlpha = 0.2
    ctx.fillStyle = tone.deep
    ctx.beginPath()
    ctx.moveTo(x, y + height * 0.78)
    ctx.quadraticCurveTo(x + width * 0.3, y + height * 0.42, x + width * 0.58, y + height * 0.72)
    ctx.quadraticCurveTo(x + width * 0.78, y + height * 0.88, x + width, y + height * 0.6)
    ctx.lineTo(x + width, y + height)
    ctx.lineTo(x, y + height)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 0.42
    ctx.strokeStyle = tone.paper
    ctx.lineWidth = unit * 0.005
    ctx.beginPath()
    ctx.moveTo(x + width * 0.08, y + height * 0.72)
    ctx.quadraticCurveTo(x + width * 0.3, y + height * 0.5, x + width * 0.5, y + height * 0.68)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = tone.soft
    ctx.beginPath()
    ctx.arc(x + width * 0.75, y + height * 0.24, unit * 0.05, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalAlpha = 0.24
  ctx.fillStyle = '#2A2118'
  const grainCount = Math.floor((width * height) / 1100)
  for (let index = 0; index < grainCount; index += 1) {
    ctx.fillRect(x + random() * width, y + random() * height, 1, 1)
  }
  ctx.globalAlpha = 1
  ctx.restore()

  ctx.strokeStyle = 'rgba(245, 239, 226, 0.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2)

  ctx.fillStyle = INK
  ctx.font = fontString('hand', Math.max(18, Math.round(unit * 0.038)), 500)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.globalAlpha = 0.55
  ctx.fillText(art.label, x + width / 2, y + height - unit * 0.035)
  ctx.globalAlpha = 1
}

function drawBorder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  padding: number,
  style: 'none' | 'paper' | 'gold',
) {
  if (style === 'none') return
  ctx.strokeStyle = style === 'gold' ? GOLD : '#E3D7BE'
  ctx.lineWidth = style === 'gold' ? 2.5 : 2
  ctx.strokeRect(padding * 0.52, padding * 0.52, width - padding, height - padding)
  if (style === 'gold') {
    ctx.strokeStyle = 'rgba(201, 162, 75, 0.28)'
    ctx.lineWidth = 1
    ctx.strokeRect(padding * 0.52 + 5, padding * 0.52 + 5, width - padding - 10, height - padding - 10)
  }
}

export function renderTextCanvas(spec: TextTextureSpec): HTMLCanvasElement {
  const width = spec.width ?? 768
  const height = spec.height ?? 960
  const padding = spec.padding ?? Math.round(width * 0.075)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable')

  drawPaper(ctx, width, height, spec.background ?? PAPER, spec.grain ?? true)

  let cursorY = padding
  let contentWidth = width - padding * 2

  if (spec.art) {
    const artHeight = spec.artHeight ?? Math.round((height - padding * 2) * 0.45)
    drawMotif(ctx, spec.art, padding, cursorY, contentWidth, artHeight)
    cursorY += artHeight + Math.round(padding * 0.38)
  }

  if (spec.image) {
    const rect = spec.imageRect ?? {
      x: padding,
      y: cursorY,
      width: contentWidth,
      height: Math.round((height - padding * 2) * 0.45),
    }
    ctx.drawImage(spec.image, rect.x, rect.y, rect.width, rect.height)
    cursorY = rect.y + rect.height + Math.round(padding * 0.38)
  }

  for (const block of spec.blocks) {
    if (block.type === 'spacer') {
      cursorY += block.gapAfter ?? 18
      continue
    }

    if (block.type === 'rule') {
      cursorY += block.gapAfter ?? 14
      const inset = block.align === 'center' ? contentWidth * 0.22 : 0
      ctx.strokeStyle = block.color ?? 'rgba(201, 162, 75, 0.55)'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(padding + inset, cursorY)
      ctx.lineTo(width - padding - inset, cursorY)
      ctx.stroke()
      cursorY += (block.lineHeight ?? 1) * 12
      continue
    }

    if (!block.text) continue
    const font = block.font ?? 'body'
    const size = block.size ?? (font === 'display' ? 50 : font === 'hand' ? 40 : 32)
    const lineHeight = size * (block.lineHeight ?? (font === 'display' ? 1.12 : 1.45))
    ctx.font = fontString(font, size, block.weight ?? (font === 'display' ? 500 : 400), block.italic)
    ctx.fillStyle = block.color ?? (font === 'hand' ? '#5A4330' : INK)
    ctx.textAlign = block.align ?? 'left'
    ctx.textBaseline = 'top'
    ctx.letterSpacing = `${block.letterSpacing ?? 0}px`

    const lines = wrapText(ctx, block.text, contentWidth, block.maxLines)
    for (const line of lines) {
      if (cursorY + lineHeight > height - padding * 0.5) break
      const x = block.align === 'center' ? padding + contentWidth / 2 : block.align === 'right' ? width - padding : padding
      if (block.letterSpacing) {
        const characters = [...line]
        const widths = characters.map((character) => ctx.measureText(character).width + (block.letterSpacing ?? 0))
        const total = widths.reduce((sum, value) => sum + value, 0)
        let drawX = block.align === 'center' ? x - total / 2 : x
        if (block.align === 'right') drawX = x - total
        for (let index = 0; index < characters.length; index += 1) {
          ctx.fillText(characters[index], drawX, cursorY)
          drawX += widths[index]
        }
      } else {
        ctx.fillText(line, x, cursorY)
      }
      cursorY += lineHeight
    }
    ctx.letterSpacing = '0px'
    cursorY += block.gapAfter ?? 0
  }

  drawBorder(ctx, width, height, padding, spec.border ?? 'paper')
  return canvas
}

export function makeCanvasTexture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable')
  paint(ctx, canvas)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

export function makeTextTexture(spec: TextTextureSpec): THREE.CanvasTexture {
  const canvas = renderTextCanvas(spec)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

export function useTextTexture(spec: TextTextureSpec | null): THREE.CanvasTexture | null {
  const version = useFontVersion()
  // Callers build their specs inline. Keying on the contents keeps the texture
  // stable across unrelated re-renders instead of disposing and rebuilding
  // every page on each state change.
  const specKey = useMemo(
    () => (spec ? JSON.stringify(spec, (key, value) => (key === 'image' ? undefined : value)) : ''),
    [spec],
  )
  const texture = useMemo(
    () => (spec ? makeTextTexture(spec) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [specKey, version],
  )
  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}

function drawArtCanvas(art: ArtSpec, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable')
  const image = art.src ? getMediaImageByPath(art.src) : getMediaImage(art.seed)
  if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
    drawImageContained(ctx, image, 0, 0, width, height)
    return canvas
  }
  drawMotif(ctx, art, 0, 0, width, height)
  return canvas
}

export function makeArtTexture(art: ArtSpec, width = 512, height = 640): THREE.CanvasTexture {
  const canvas = drawArtCanvas(art, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

export function useArtTexture(art: ArtSpec, width = 512, height = 640): THREE.CanvasTexture {
  const version = useFontVersion()
  const texture = useMemo(() => makeArtTexture(art, width, height), [art, width, height, version])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

export function makeCoverTexture(options: {
  title: string
  number?: string
  hand: string
  background: string
  accent: string
  motif?: 'four-dots'
}): THREE.CanvasTexture {
  return makeCanvasTexture(640, 880, (ctx) => {
    ctx.fillStyle = options.background
    ctx.fillRect(0, 0, 640, 880)
    ctx.strokeStyle = options.accent
    ctx.lineWidth = 3
    ctx.strokeRect(32, 32, 576, 816)
    ctx.strokeStyle = 'rgba(245, 239, 226, 0.24)'
    ctx.lineWidth = 1
    ctx.strokeRect(44, 44, 552, 792)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    if (options.number) {
      ctx.fillStyle = options.accent
      ctx.font = fontString('hand', 47, 500)
      ctx.fillText(`album ${options.number}`, 320, 146)
    }

    ctx.fillStyle = '#F5EFE2'
    ctx.font = fontString('display', 62, 500)
    const words = options.title.split(' ')
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width > 470 && line) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
    const startY = 410 - ((lines.length - 1) * 72) / 2
    lines.forEach((entry, index) => ctx.fillText(entry, 320, startY + index * 72))

    ctx.strokeStyle = options.accent
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(230, 606)
    ctx.lineTo(410, 606)
    ctx.stroke()

    ctx.fillStyle = 'rgba(245, 239, 226, 0.75)'
    ctx.font = fontString('hand', 43, 500)
    ctx.fillText(options.hand, 320, 636)

    ctx.fillStyle = options.accent
    const petalCount = options.motif === 'four-dots' ? 4 : 8
    for (let index = 0; index < petalCount; index += 1) {
      const angle = (index / petalCount) * Math.PI * 2
      ctx.beginPath()
      ctx.ellipse(
        320 + Math.cos(angle) * 23,
        770 + Math.sin(angle) * 23,
        12,
        6,
        angle,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
    ctx.fillStyle = '#2A2118'
    ctx.beginPath()
    ctx.arc(320, 770, 9, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(245, 239, 226, 0.45)'
    ctx.font = fontString('body', 20, 400)
    ctx.fillText('a room for you', 320, 822)
  })
}

export type IconKind =
  | 'previous'
  | 'next'
  | 'close'
  | 'loop'
  | 'play'
  | 'pause'
  | 'mic'
  | 'cinema'
  | 'letter'
  | 'fullscreen'
  | 'back'
  | 'check'

const iconCache = new Map<string, THREE.CanvasTexture>()

export function getIconTexture(kind: IconKind, color = '#2A2118'): THREE.CanvasTexture {
  const key = `${kind}-${color}`
  const cached = iconCache.get(key)
  if (cached) return cached
  const texture = makeCanvasTexture(128, 128, (ctx) => {
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (kind === 'previous' || kind === 'next') {
      const direction = kind === 'previous' ? -1 : 1
      ctx.beginPath()
      ctx.moveTo(64 - direction * 16, 38)
      ctx.lineTo(64 + direction * 14, 64)
      ctx.lineTo(64 - direction * 16, 90)
      ctx.stroke()
    } else if (kind === 'close') {
      ctx.beginPath()
      ctx.moveTo(42, 42)
      ctx.lineTo(86, 86)
      ctx.moveTo(86, 42)
      ctx.lineTo(42, 86)
      ctx.stroke()
    } else if (kind === 'loop') {
      ctx.beginPath()
      ctx.arc(64, 64, 27, -0.4, Math.PI * 1.55)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(88, 29)
      ctx.lineTo(90, 49)
      ctx.lineTo(70, 47)
      ctx.stroke()
    } else if (kind === 'play') {
      ctx.beginPath()
      ctx.moveTo(49, 36)
      ctx.lineTo(94, 64)
      ctx.lineTo(49, 92)
      ctx.closePath()
      ctx.fill()
    } else if (kind === 'pause') {
      roundRect(ctx, 43, 38, 14, 52, 3)
      ctx.fill()
      roundRect(ctx, 71, 38, 14, 52, 3)
      ctx.fill()
    } else if (kind === 'check') {
      ctx.beginPath()
      ctx.moveTo(36, 66)
      ctx.lineTo(55, 86)
      ctx.lineTo(94, 42)
      ctx.stroke()
    } else if (kind === 'letter') {
      ctx.strokeRect(28, 40, 72, 50)
      ctx.beginPath()
      ctx.moveTo(28, 40)
      ctx.lineTo(64, 69)
      ctx.lineTo(100, 40)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(64, 74, 7, 0, Math.PI * 2)
      ctx.fill()
    } else if (kind === 'fullscreen') {
      const corner = 18
      const inset = 32
      for (const [x, y, dx, dy] of [
        [inset, inset, 1, 1],
        [128 - inset, inset, -1, 1],
        [inset, 128 - inset, 1, -1],
        [128 - inset, 128 - inset, -1, -1],
      ]) {
        ctx.beginPath()
        ctx.moveTo(x, y + corner * dy)
        ctx.lineTo(x, y)
        ctx.lineTo(x + corner * dx, y)
        ctx.stroke()
      }
    } else if (kind === 'back') {
      ctx.beginPath()
      ctx.moveTo(52, 64)
      ctx.lineTo(82, 64)
      ctx.moveTo(52, 64)
      ctx.lineTo(72, 44)
      ctx.moveTo(52, 64)
      ctx.lineTo(72, 84)
      ctx.stroke()
    } else if (kind === 'mic') {
      roundRect(ctx, 52, 26, 24, 47, 12)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(64, 64, 29, 0.15, Math.PI - 0.15)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(64, 93)
      ctx.lineTo(64, 104)
      ctx.stroke()
    } else {
      ctx.strokeRect(28, 42, 72, 48)
      ctx.beginPath()
      ctx.moveTo(28, 42)
      ctx.lineTo(64, 70)
      ctx.lineTo(100, 42)
      ctx.stroke()
    }
  })
  iconCache.set(key, texture)
  return texture
}

export function paginate(
  paragraphs: string[],
  options: {
    width: number
    height: number
    padding: number
    fontSize?: number
    lineHeight?: number
    font?: CanvasFont
  },
): string[] {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const ctx = canvas.getContext('2d')
  if (!ctx) return [paragraphs.join('\n\n')]

  const fontSize = options.fontSize ?? 32
  const lineHeight = fontSize * (options.lineHeight ?? 1.55)
  ctx.font = fontString(options.font ?? 'body', fontSize, 400)
  const contentWidth = options.width - options.padding * 2
  const contentHeight = options.height - options.padding * 2
  const maxLines = Math.max(3, Math.floor(contentHeight / lineHeight))
  const pages: string[] = []
  let current: string[] = []
  let usedLines = 0

  const pushPage = () => {
    if (current.length) pages.push(current.join('\n\n'))
    current = []
    usedLines = 0
  }

  for (const paragraph of paragraphs) {
    const lines = wrapText(ctx, paragraph, contentWidth)
    const paragraphLines = lines.length + (current.length ? 1 : 0)
    if (usedLines + paragraphLines > maxLines && current.length) pushPage()
    if (lines.length > maxLines) {
      for (let index = 0; index < lines.length; index += maxLines) {
        const chunk = lines.slice(index, index + maxLines)
        pages.push(chunk.join('\n'))
      }
      continue
    }
    current.push(paragraph)
    usedLines += paragraphLines
  }
  pushPage()
  return pages.length ? pages : ['']
}

export function artFromPage(art: ArtSpec): ArtSpec {
  return art
}

export const TEXT_COLORS = {
  paper: PAPER,
  ink: INK,
  gold: GOLD,
  inkSoft: INK_SOFT,
}

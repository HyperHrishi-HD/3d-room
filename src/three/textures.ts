import * as THREE from 'three'

function makeTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable')
  paint(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

export function createFloorTexture(): THREE.CanvasTexture {
  const texture = makeTexture(512, 512, (ctx) => {
    const random = seeded(47)
    const plankWidth = 512 / 12
    const tones = ['#4A3421', '#523B26', '#45301F', '#563E28', '#4C3622']

    for (let i = 0; i < 12; i += 1) {
      const x = i * plankWidth
      ctx.fillStyle = tones[i % tones.length]
      ctx.fillRect(x, 0, plankWidth + 1, 512)

      ctx.strokeStyle = 'rgba(24, 15, 9, 0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, 512)
      ctx.stroke()

      ctx.strokeStyle = 'rgba(255, 223, 170, 0.045)'
      ctx.lineWidth = 1
      for (let grain = 0; grain < 5; grain += 1) {
        const gx = x + 6 + random() * (plankWidth - 12)
        ctx.beginPath()
        ctx.moveTo(gx, 0)
        ctx.bezierCurveTo(gx + 4, 150, gx - 5, 340, gx + 2, 512)
        ctx.stroke()
      }

      const joint = (i % 3) * 132 + 48
      ctx.strokeStyle = 'rgba(22, 14, 8, 0.38)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x + 2, joint)
      ctx.lineTo(x + plankWidth - 2, joint)
      ctx.stroke()
    }

    ctx.fillStyle = 'rgba(14, 9, 5, 0.16)'
    ctx.fillRect(0, 0, 512, 512)
  })

  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 1)
  return texture
}

export function createAlbumCover(
  title: string,
  background: string,
  accent: string,
): THREE.CanvasTexture {
  return makeTexture(512, 384, (ctx) => {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, 512, 384)

    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.strokeRect(24, 24, 464, 336)
    ctx.strokeStyle = 'rgba(231, 200, 120, 0.35)'
    ctx.lineWidth = 1
    ctx.strokeRect(34, 34, 444, 316)

    ctx.strokeStyle = accent
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(256, 54)
    ctx.lineTo(256, 74)
    ctx.stroke()

    ctx.fillStyle = accent
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'italic 600 50px Georgia, "Times New Roman", serif'

    const words = title.split(' ')
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width > 360 && line) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    if (line) lines.push(line)

    const leading = 58
    const startY = 192 - ((lines.length - 1) * leading) / 2
    lines.forEach((text, index) => {
      ctx.fillText(text, 256, startY + index * leading)
    })

    ctx.strokeStyle = accent
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(196, 300)
    ctx.lineTo(316, 300)
    ctx.stroke()

    ctx.fillStyle = 'rgba(231, 200, 120, 0.7)'
    ctx.beginPath()
    ctx.arc(256, 318, 3, 0, Math.PI * 2)
    ctx.fill()
  })
}

export function createTVTexture(): THREE.CanvasTexture {
  return makeTexture(1024, 576, (ctx) => {
    ctx.fillStyle = '#0B0B10'
    ctx.fillRect(0, 0, 1024, 576)

    ctx.fillStyle = 'rgba(242, 169, 59, 0.11)'
    ctx.beginPath()
    ctx.arc(512, 286, 190, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#C9A24B'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(512, 286, 128, 0, Math.PI * 2)
    ctx.stroke()

    const petals = 12
    for (let i = 0; i < petals; i += 1) {
      const angle = (i / petals) * Math.PI * 2
      const cx = 512 + Math.cos(angle) * 62
      const cy = 286 + Math.sin(angle) * 62
      ctx.fillStyle = i % 2 === 0 ? '#F2A93B' : '#E8962E'
      ctx.beginPath()
      ctx.ellipse(cx, cy, 24, 12, angle, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#C9A24B'
    ctx.beginPath()
    ctx.arc(512, 286, 18, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#F5EFE2'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'italic 600 58px Georgia, "Times New Roman", serif'
    ctx.fillText('The Television', 512, 444)

    ctx.fillStyle = 'rgba(231, 200, 120, 0.72)'
    ctx.font = '24px Georgia, "Times New Roman", serif'
    ctx.fillText('the last room', 512, 492)

    ctx.strokeStyle = 'rgba(201, 162, 75, 0.35)'
    ctx.lineWidth = 1
    ctx.strokeRect(22, 22, 980, 532)
  })
}

export function createMonitorTexture(): THREE.CanvasTexture {
  return makeTexture(512, 320, (ctx) => {
    ctx.fillStyle = '#0D0C11'
    ctx.fillRect(0, 0, 512, 320)

    ctx.strokeStyle = 'rgba(201, 162, 75, 0.28)'
    ctx.lineWidth = 1
    ctx.strokeRect(16, 16, 480, 288)

    ctx.fillStyle = '#F2A93B'
    ctx.beginPath()
    ctx.arc(256, 108, 5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#E7C878'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'italic 600 40px Georgia, "Times New Roman", serif'
    ctx.fillText('Ask the room', 256, 174)

    ctx.fillStyle = 'rgba(245, 239, 226, 0.5)'
    ctx.font = '18px Georgia, "Times New Roman", serif'
    ctx.fillText('standby', 256, 220)
  })
}

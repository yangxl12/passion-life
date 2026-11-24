/** 不依赖第三方库，直接生成 PWA 所需的 PNG 图标。运行：node scripts/generate-icons.mjs */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const crcTable = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c
}

function crc32(buf) {
  let c = -1
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const name = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

const PATH = [
  [0.22, 0.72, 0.42, 0.72],
  [0.42, 0.72, 0.42, 0.52],
  [0.42, 0.52, 0.62, 0.52],
  [0.62, 0.52, 0.62, 0.32]
]

function draw(size, filename) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const radius = 0.22
  const lineWidth = 0.055
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    const v = y / (size - 1)
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1)
      const i = rowStart + 1 + x * 4
      // 圆角方形
      const cx = Math.max(radius, Math.min(1 - radius, u))
      const cy = Math.max(radius, Math.min(1 - radius, v))
      const outside = Math.hypot(u - cx, v - cy) > radius
      if (outside) {
        raw[i] = 0; raw[i + 1] = 0; raw[i + 2] = 0; raw[i + 3] = 0
        continue
      }
      let r = Math.round(201 + (169 - 201) * v)
      let g = Math.round(89 + (67 - 89) * v)
      let b = Math.round(59 + (41 - 59) * v)
      const stroke = PATH.some(([ax, ay, bx, by]) => distanceToSegment(u, v, ax, ay, bx, by) <= lineWidth)
      const endDot = Math.hypot(u - 0.62, v - 0.32) <= lineWidth * 1.5
      if (stroke || endDot) { r = 255; g = 249; b = 244 }
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
  writeFileSync(join(outDir, filename), png)
  console.log(`wrote ${filename} (${size}x${size})`)
}

draw(192, 'icon-192.png')
draw(512, 'icon-512.png')
draw(180, 'apple-touch-icon.png')

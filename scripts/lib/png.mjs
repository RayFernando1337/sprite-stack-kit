// A minimal PNG writer and reader, so snapshots, figures and map tiles need no dependencies.

import { deflateSync, inflateSync } from 'node:zlib'

const CRC = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC[n] = c >>> 0
}
function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

/** rgba: width × height × 4 bytes. `scale` repeats every pixel, so a small frame is easy to look at. */
export function encodePng(rgba, width, height, scale = 1) {
  const w = width * scale
  const h = height * scale
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1)
    const from = ((y / scale) | 0) * width * 4
    for (let x = 0; x < w; x++) {
      const s = from + ((x / scale) | 0) * 4
      const d = row + 1 + x * 4
      raw[d] = rgba[s]
      raw[d + 1] = rgba[s + 1]
      raw[d + 2] = rgba[s + 2]
      raw[d + 3] = 255
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(w, 0)
  header.writeUInt32BE(h, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Reads an 8-bit RGB or RGBA PNG. Returns { width, height, channels, data }. */
export function decodePng(file) {
  let at = 8
  let width = 0
  let height = 0
  let channels = 0
  const parts = []
  while (at < file.length) {
    const size = file.readUInt32BE(at)
    const type = file.toString('latin1', at + 4, at + 8)
    const body = file.subarray(at + 8, at + 8 + size)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      if (body[8] !== 8 || (body[9] !== 2 && body[9] !== 6)) throw new Error(`cannot read this kind of PNG (colour type ${body[9]}, ${body[8]} bits)`)
      channels = body[9] === 2 ? 3 : 4
    }
    if (type === 'IDAT') parts.push(body)
    at += 12 + size
  }
  const raw = inflateSync(Buffer.concat(parts))
  const stride = width * channels
  const data = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? data[y * stride + i - channels] : 0
      const up = y ? data[(y - 1) * stride + i] : 0
      const corner = i >= channels && y ? data[(y - 1) * stride + i - channels] : 0
      let guess = 0
      if (filter === 1) guess = left
      else if (filter === 2) guess = up
      else if (filter === 3) guess = (left + up) >> 1
      else if (filter === 4) {
        const p = left + up - corner
        const a = Math.abs(p - left)
        const b = Math.abs(p - up)
        const c = Math.abs(p - corner)
        guess = a <= b && a <= c ? left : b <= c ? up : corner
      }
      data[y * stride + i] = (raw[y * (stride + 1) + 1 + i] + guess) & 255
    }
  }
  return { width, height, channels, data }
}

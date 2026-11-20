#!/usr/bin/env bun
// Turns real map data into small packed text that a game can rebuild a map from.
//
//   bun run maps --game examples/worldfight
//
// It reads the list of places in `<game>/maps.js`, downloads open elevation tiles and border
// lines for each (kept in .cache/maps, so a second run needs no network), shrinks each place
// to a small grid, and writes `<game>/src/map-<name>.js`. The game ships only those files:
// it never uses the network or a data file when it runs.
//
// A place is { name, zoom, lon, lat, tiles, size, top, lines, lineSize }:
//   zoom, lon, lat, tiles   a square of the Web Mercator map: `tiles` tiles wide at `zoom`,
//                           centred on lon, lat
//   size                    the grid is size × size cells
//   top                     the height, in metres, that gets the tallest of the 15 steps
//   lines, lineSize         Natural Earth line sets to draw as borders, and that grid's size
//
// What is stored
//   land    one number per cell: 0 for water, or 1..15 for how high the land is. Steps are
//           closer together near sea level, where most land is. Packed as one byte per run:
//           the step in the high four bits, the run length − 1 in the low four.
//   lines   which cells of a second grid a border crosses, as the gaps between them.
//
// Data: Mapzen terrain tiles, hosted by AWS Open Data, and Natural Earth (public domain).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { decodePng } from './lib/png.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const at = process.argv.indexOf('--game')
if (at < 0) {
  console.error('Say which game: bun run maps --game examples/<name>')
  process.exit(1)
}
const gameDir = resolve(root, process.argv[at + 1])
const cache = join(root, '.cache/maps')
mkdirSync(cache, { recursive: true })

const TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'
const LINES = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
const TILE = 256

async function cached(name, address) {
  const file = join(cache, name)
  if (!existsSync(file)) {
    const answer = await fetch(address)
    if (!answer.ok) throw new Error(`${address}: ${answer.status}`)
    writeFileSync(file, new Uint8Array(await answer.arrayBuffer()))
  }
  return readFileSync(file)
}

/** Metres above sea level for every pixel of one tile. */
async function tile(zoom, x, y) {
  const count = 1 << zoom
  const png = decodePng(await cached(`${zoom}-${x}-${y}.png`, `${TILES}/${zoom}/${((x % count) + count) % count}/${y}.png`))
  const metres = new Float32Array(TILE * TILE)
  for (let i = 0; i < TILE * TILE; i++) {
    const o = i * png.channels
    metres[i] = png.data[o] * 256 + png.data[o + 1] + png.data[o + 2] / 256 - 32768
  }
  return metres
}

// Web Mercator, with the whole world as a square from 0 to 1
const mercX = (lon) => (lon + 180) / 360
const mercY = (lat) => (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2

async function land(place, x0, y0, span) {
  const { zoom, size, top } = place
  const count = 1 << zoom
  const px = Math.round(span * count * TILE) // the square's width in tile pixels
  const sum = new Float32Array(size * size)
  const dry = new Uint32Array(size * size)
  const all = new Uint32Array(size * size)
  const tiles = new Map()
  for (let j = 0; j < px; j++) {
    const gy = y0 * count * TILE + j
    const ty = Math.floor(gy / TILE)
    if (ty < 0 || ty >= count) continue // off the top or bottom of the world
    for (let i = 0; i < px; i++) {
      const gx = x0 * count * TILE + i
      const tx = Math.floor(gx / TILE)
      const key = `${tx},${ty}`
      if (!tiles.has(key)) tiles.set(key, await tile(zoom, tx, ty))
      const metres = tiles.get(key)[(Math.floor(gy) - ty * TILE) * TILE + (Math.floor(gx) - tx * TILE)]
      const cell = Math.min(size - 1, Math.floor((j / px) * size)) * size + Math.min(size - 1, Math.floor((i / px) * size))
      all[cell]++
      if (metres > 0) {
        dry[cell]++
        sum[cell] += metres
      }
    }
  }
  const steps = new Uint8Array(size * size)
  for (let i = 0; i < steps.length; i++) {
    // land where at least half the cell is above the sea; its height is the mean of that part
    if (dry[i] * 2 < all[i] || !all[i]) continue
    steps[i] = Math.min(15, 1 + Math.floor(Math.sqrt(sum[i] / dry[i] / top) * 15))
  }
  return steps
}

async function borders(place, x0, y0, span) {
  const n = place.lineSize
  const hit = new Uint8Array(n * n)
  for (const set of place.lines) {
    const shapes = JSON.parse((await cached(`${set}.geojson`, `${LINES}/${set}.geojson`)).toString('utf8'))
    for (const feature of shapes.features) {
      const kind = feature.geometry?.type
      const paths = kind === 'LineString' ? [feature.geometry.coordinates] : kind === 'MultiLineString' ? feature.geometry.coordinates : []
      for (const path of paths) {
        for (let p = 1; p < path.length; p++) {
          if (Math.abs(path[p][0] - path[p - 1][0]) > 180) continue // a line that crosses the date line
          const ax = ((mercX(path[p - 1][0]) - x0) / span) * n
          const ay = ((mercY(Math.max(-85, Math.min(85, path[p - 1][1]))) - y0) / span) * n
          const bx = ((mercX(path[p][0]) - x0) / span) * n
          const by = ((mercY(Math.max(-85, Math.min(85, path[p][1]))) - y0) / span) * n
          const count = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))) || 1
          if (count > n * 2) continue
          for (let s = 0; s <= count; s++) {
            const x = Math.floor(ax + ((bx - ax) * s) / count)
            const y = Math.floor(ay + ((by - ay) * s) / count)
            if (x >= 0 && y >= 0 && x < n && y < n) hit[y * n + x] = 1
          }
        }
      }
    }
  }
  return hit
}

const base64 = (bytes) => Buffer.from(bytes).toString('base64')

function packLand(steps) {
  const bytes = []
  for (let i = 0; i < steps.length; ) {
    let run = 1
    while (run < 16 && i + run < steps.length && steps[i + run] === steps[i]) run++
    bytes.push((steps[i] << 4) | (run - 1))
    i += run
  }
  return base64(bytes)
}

function packLines(hit) {
  // the gap to the next marked cell: one byte, or 255 followed by two bytes for a long gap
  const bytes = []
  let last = -1
  for (let i = 0; i < hit.length; i++) {
    if (!hit[i]) continue
    const gap = i - last
    if (gap < 255) bytes.push(gap)
    else bytes.push(255, gap >> 16, (gap >> 8) & 255, gap & 255)
    last = i
  }
  return base64(bytes)
}

const { maps } = await import(pathToFileURL(join(gameDir, 'maps.js')).href)
let total = 0
for (const place of maps) {
  const span = place.tiles / (1 << place.zoom)
  const x0 = mercX(place.lon) - span / 2
  const y0 = mercY(place.lat) - span / 2
  const steps = await land(place, x0, y0, span)
  const hit = place.lines ? await borders(place, x0, y0, span) : null
  let dry = 0
  for (const step of steps) if (step) dry++
  const lines = [
    '// Made by `bun run maps` from open map data. Do not edit by hand: change maps.js and run it again.',
    'export default {',
    `  name: '${place.name}',`,
    `  x0: ${x0}, // the left and top edges, and the width, as shares of the Web Mercator world`,
    `  y0: ${y0},`,
    `  span: ${span},`,
    `  size: ${place.size},`,
    `  top: ${place.top}, // metres at the tallest of the 15 steps`,
    `  land: '${packLand(steps)}',`,
  ]
  if (hit) lines.push(`  lineSize: ${place.lineSize},`, `  lines: '${packLines(hit)}',`)
  lines.push('}', '')
  const text = lines.join('\n')
  writeFileSync(join(gameDir, 'src', `map-${place.name}.js`), text)
  total += text.length
  console.log(`${place.name}: ${place.size} × ${place.size} cells, ${((dry / steps.length) * 100).toFixed(1)}% land, ${(text.length / 1024).toFixed(1)} KB`)
}
console.log(`${(total / 1024).toFixed(1)} KB in all`)

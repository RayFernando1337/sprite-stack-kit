// Reads the packed maps that `bun run maps` writes, and turns places on the Earth into
// places on a map. A map is a square cut from the Web Mercator world: `x0`, `y0` and `span`
// say which square, as shares of the whole world.

import { WORLD_SIZE } from './world.js'

/** One number per cell: 0 for water, 1..15 for how high the land is. */
export function unpackLand(map) {
  const text = atob(map.land)
  const cells = new Uint8Array(map.size * map.size)
  let o = 0
  for (let i = 0; i < text.length; i++) {
    const byte = text.charCodeAt(i)
    const run = (byte & 15) + 1
    cells.fill(byte >> 4, o, o + run)
    o += run
  }
  return cells
}

/** 1 in every cell of the line grid that a border crosses. */
export function unpackLines(map) {
  const cells = new Uint8Array(map.lineSize * map.lineSize)
  const text = atob(map.lines)
  let at = -1
  for (let i = 0; i < text.length; i++) {
    let gap = text.charCodeAt(i)
    if (gap === 255) {
      gap = (text.charCodeAt(i + 1) << 16) | (text.charCodeAt(i + 2) << 8) | text.charCodeAt(i + 3)
      i += 3
    }
    at += gap
    cells[at] = 1
  }
  return cells
}

const mercX = (lon) => (lon + 180) / 360
const mercY = (lat) => (1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2

/** Where a longitude and latitude are on a map, in world pixels. */
export const placeX = (map, lon) => ((mercX(lon) - map.x0) / map.span) * WORLD_SIZE
export const placeY = (map, lat) => ((mercY(lat) - map.y0) / map.span) * WORLD_SIZE

/** … and back again, in degrees. */
export const lonAt = (map, x) => (map.x0 + (x / WORLD_SIZE) * map.span) * 360 - 180
export const latAt = (map, y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * (map.y0 + (y / WORLD_SIZE) * map.span)))) * 180) / Math.PI

/** Moves a point from one map to another: the same spot on the Earth. */
export const acrossX = (from, to, x) => ((from.x0 + (x / WORLD_SIZE) * from.span - to.x0) / to.span) * WORLD_SIZE
export const acrossY = (from, to, y) => ((from.y0 + (y / WORLD_SIZE) * from.span - to.y0) / to.span) * WORLD_SIZE

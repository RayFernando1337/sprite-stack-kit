// A sprite stack is a pile of flat pixel pictures ("slices"), one per layer of height. Drawn
// one pixel apart and turned together, the pile reads as a solid 3D object.
//
// A model is a grid of palette indices, width × length × height, where 0 is empty:
//   i runs across, left to right        (width)
//   k runs along, front to back         (length)
//   z runs up, bottom slice to top      (height)
// and the cell (i, k, z) is at index (z × length + k) × width + i.
//
// The ship below is built in code from a few simple shapes, so there is no image file to
// load. A model drawn by hand, or cut from top/side/front pictures, works the same way: fill
// a grid, then hand it to buildModel().

import { rgb } from './framebuffer.js'

export const CRAFT_W = 21 // across: fin tip to fin tip (odd, so there is a centre line)
export const CRAFT_L = 38 // along: nose (row 0) to engine
export const CRAFT_H = 13 // layers: bottom fin (0) to top fin
const CRAFT_SIZE = { width: CRAFT_W, length: CRAFT_L, height: CRAFT_H }

// Palette: three tones for each kind of surface, dark → light, then the engine glow.
const HULL = 1
const TRIM = 4
const GLASS = 7
const METAL = 10
const GLOW = 13
const SHIP_PALETTE = [
  null,
  [148, 156, 176], [208, 214, 224], [250, 250, 246],
  [150, 30, 44], [212, 52, 50], [248, 96, 70],
  [22, 78, 112], [48, 140, 176], [124, 210, 230],
  [38, 40, 50], [66, 68, 80], [98, 102, 114],
  [255, 198, 98],
]
// The computer pilots fly the same ship in other colours.
const RIVAL_PALETTE = [
  null,
  [52, 58, 74], [84, 92, 112], [124, 134, 156],
  [128, 92, 16], [206, 158, 30], [250, 214, 72],
  [96, 22, 30], [176, 44, 44], [240, 100, 80],
  [30, 30, 38], [52, 54, 64], [80, 84, 96],
  [140, 255, 170],
]
const FLAME = [[255, 250, 222], [255, 216, 112], [255, 152, 48], [234, 86, 28], [152, 46, 38]]

/** Fills the ship's grid with the first (darkest) tone of each surface. Edit this to change the ship. */
function sculpt() {
  const grid = new Uint8Array(CRAFT_W * CRAFT_L * CRAFT_H)
  const mid = (CRAFT_W - 1) / 2
  const core = 6 // the layer the body is centred on
  const put = (a, k, z, kind) => {
    // `a` is measured from the centre line, so every shape is mirrored for free
    if (k < 0 || k >= CRAFT_L || z < 0 || z >= CRAFT_H || Math.abs(a) > mid) return
    grid[(z * CRAFT_L + k) * CRAFT_W + mid + a] = kind
    grid[(z * CRAFT_L + k) * CRAFT_W + mid - a] = kind
  }

  // body: a round tube with a pointed nose, a painted nose cone and one painted band
  for (let k = 0; k < 34; k++) {
    const radius = (k < 11 ? 3.7 * Math.pow(Math.sin(((k + 0.6) / 11.6) * Math.PI * 0.5), 0.8) : 3.7) - Math.max(0, k - 29) * 0.16
    const kind = k < 7 || k === 19 || k === 20 ? TRIM : HULL
    for (let z = 0; z < CRAFT_H; z++) {
      for (let a = 0; a <= mid; a++) {
        if (a * a + (z - core) * (z - core) <= radius * radius) put(a, k, z, kind)
      }
    }
  }

  // a round window on top
  for (let k = 9; k <= 14; k++) {
    for (let a = 0; a <= 2; a++) {
      if ((a / 2.2) ** 2 + ((k - 11.5) / 2.8) ** 2 <= 1) {
        put(a, k, core + 3, GLASS)
        if (a <= 1) put(a, k, core + 4, GLASS)
      }
    }
  }

  // four swept fins: one each side, one above and one below
  for (let k = 22; k <= 35; k++) {
    const out = Math.min(6.4, (k - 22) * 0.62) - Math.max(0, k - 33) * 1.6
    for (let a = 3; a <= 3.4 + out; a++) {
      put(a, k, core, TRIM)
      if (a < 6) put(a, k, core - 1, TRIM)
    }
    const tall = Math.min(3, Math.floor((k - 23) * 0.5)) - Math.max(0, k - 33)
    for (let n = 0; n <= tall; n++) {
      put(0, k, core + 3 + n, TRIM)
      put(0, k, core - 3 - n, TRIM)
    }
  }

  // the engine: a dark bell with a glowing core
  for (let k = 33; k <= 37; k++) {
    for (let z = 0; z < CRAFT_H; z++) {
      for (let a = 0; a <= 4; a++) {
        const far = Math.sqrt(a * a + (z - core) * (z - core))
        if (far > 2.2 + (k - 33) * 0.28) continue
        put(a, k, z, k === 37 && far < 1.5 ? GLOW : METAL)
      }
    }
  }
  return grid
}
/**
 * Picks a tone for every visible cell from which way it faces: surfaces that face up and
 * towards the light get the light tone, surfaces that face away get the dark one. It expects
 * each surface to own three palette entries in a row (dark, mid, light) and the grid to hold
 * the dark one. Indices from `glowFrom` up are left alone. This is done once, so drawing the
 * model costs nothing extra.
 */
export function shadeGrid(grid, { width, length, height }, glowFrom = Infinity) {
  const at = (i, k, z) => (z * length + k) * width + i
  const filled = (i, k, z) => i >= 0 && k >= 0 && z >= 0 && i < width && k < length && z < height && grid[at(i, k, z)] !== 0
  const out = new Uint8Array(grid.length)
  for (let z = 0; z < height; z++) {
    for (let k = 0; k < length; k++) {
      for (let i = 0; i < width; i++) {
        const kind = grid[at(i, k, z)]
        if (!kind) continue
        if (kind >= glowFrom) {
          out[at(i, k, z)] = kind
          continue
        }
        // which way is open air? (right, towards the back, up)
        const nx = (filled(i + 1, k, z) ? 0 : 1) - (filled(i - 1, k, z) ? 0 : 1)
        const ny = (filled(i, k + 1, z) ? 0 : 1) - (filled(i, k - 1, z) ? 0 : 1)
        const nz = (filled(i, k, z + 1) ? 0 : 1) - (filled(i, k, z - 1) ? 0 : 1)
        const size = Math.sqrt(nx * nx + ny * ny + nz * nz)
        const facing = size ? (-0.42 * nx - 0.28 * ny + 0.86 * nz) / size : 0
        out[at(i, k, z)] = kind + (facing > 0.5 ? 2 : facing < -0.05 ? 0 : 1)
      }
    }
  }
  return out
}

/**
 * A grid as a short string: runs of (count, palette index) byte pairs, base64 encoded. A
 * stack is mostly empty space and flat colour, so this is far smaller than the grid or a PNG.
 * Use it to paste a finished model into a source file.
 */
export function encodeGrid(grid) {
  const bytes = []
  for (let i = 0; i < grid.length; ) {
    let run = 1
    while (run < 255 && i + run < grid.length && grid[i + run] === grid[i]) run++
    bytes.push(run, grid[i])
    i += run
  }
  let text = ''
  for (const b of bytes) text += String.fromCharCode(b)
  return btoa(text)
}

export function decodeGrid(encoded, size) {
  const text = atob(encoded)
  const grid = new Uint8Array(size)
  let o = 0
  for (let i = 0; i + 1 < text.length; i += 2) {
    const run = text.charCodeAt(i)
    grid.fill(text.charCodeAt(i + 1), o, o + run)
    o += run
  }
  return grid
}

/**
 * Turns a grid into what drawStack() draws from.
 *
 * spec: {
 *   width, length, height   the grid's size
 *   pivotK, pivotZ          the cell the model turns about: how far along, and which slice
 *   palette                 [null, [r, g, b], …]: entry n is the colour of palette index n
 *   outline                 [r, g, b] of the line drawn round the model (optional)
 *   nozzles, nozzleRadius   where flames come from (optional)
 *   wingtips                where trails come from (optional)
 * }
 * Nozzles and wingtips are { a, b, z }: cells right of the centre line, cells ahead of the
 * pivot, and slices above the pivot.
 */
export function buildModel(grid, spec) {
  const { width, length, height, pivotK, pivotZ } = spec
  const mid = (width - 1) / 2
  const layers = []
  const footprint = new Uint8Array(width * length) // the model from straight above, for its shadow
  let cells = 0
  for (let z = 0; z < height; z++) {
    const a = []
    const b = []
    const c = []
    for (let k = 0; k < length; k++) {
      for (let i = 0; i < width; i++) {
        const v = grid[(z * length + k) * width + i]
        if (!v) continue
        a.push(i - mid) // across: negative is the left side
        b.push(pivotK - k) // along: positive is towards the front
        c.push(v)
        footprint[k * width + i] = 1
      }
    }
    cells += c.length
    layers.push({ a: Float32Array.from(a), b: Float32Array.from(b), c: Uint8Array.from(c) })
  }
  const colors = new Uint32Array(spec.palette.length)
  for (let i = 1; i < spec.palette.length; i++) colors[i] = rgb(...spec.palette[i])
  return {
    width,
    length,
    height,
    pivotK,
    pivotZ,
    layers,
    footprint,
    cells,
    colors,
    outline: rgb(...(spec.outline ?? [20, 24, 40])),
    flame: FLAME.map((c) => rgb(...c)),
    nozzles: spec.nozzles ?? [],
    nozzleRadius: spec.nozzleRadius ?? 1.5,
    wingtips: spec.wingtips ?? [],
  }
}

export function sculptGrid() {
  return shadeGrid(sculpt(), CRAFT_SIZE, GLOW)
}

/** The ship. `rival` gives the colours the computer pilots fly in. */
export function buildCraft({ rival = false } = {}) {
  const pivotK = 19
  const pivotZ = 6
  return buildModel(sculptGrid(), {
    ...CRAFT_SIZE,
    pivotK,
    pivotZ,
    palette: rival ? RIVAL_PALETTE : SHIP_PALETTE,
    nozzles: [{ a: 0, b: pivotK - 37.6, z: 0 }],
    nozzleRadius: 2.4,
    wingtips: [{ a: -9, b: pivotK - 34, z: 0 }, { a: 9, b: pivotK - 34, z: 0 }],
  })
}

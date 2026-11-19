// A sprite stack is a pile of flat pixel pictures ("slices"), one per layer of height. Drawn
// one pixel apart and turned together, the pile reads as a solid 3D object.
//
// A model is a grid of palette indices, width × length × height, where 0 is empty:
//   i runs across, left to right        (width)
//   k runs along, front to back         (length)
//   z runs up, bottom slice to top      (height)
// and the cell (i, k, z) is at index (z × length + k) × width + i.
//
// The craft below is built in code from a few simple shapes, so there is no image file to
// load. A model drawn by hand, or cut from top/side/front pictures, works the same way: fill
// a grid, then hand it to buildModel().

import { rgb } from './framebuffer.js'

export const CRAFT_W = 31 // across: wingtip to wingtip (odd, so there is a centre line)
export const CRAFT_L = 42 // along: nose (row 0) to tail
export const CRAFT_H = 11 // layers: belly (0) to fin tips
const CRAFT_SIZE = { width: CRAFT_W, length: CRAFT_L, height: CRAFT_H }

// Palette: three tones for each kind of surface, dark → light, then the engine glow.
const HULL = 1
const TRIM = 4
const GLASS = 7
const METAL = 10
const GLOW = 13
const CRAFT_PALETTE = [
  null,
  [112, 120, 136], [176, 182, 186], [228, 230, 222],
  [118, 28, 42], [178, 42, 46], [228, 66, 56],
  [22, 78, 112], [48, 140, 176], [124, 210, 230],
  [38, 40, 50], [66, 68, 80], [98, 102, 114],
  [255, 198, 98],
]
const FLAME = [[255, 250, 222], [255, 216, 112], [255, 152, 48], [234, 86, 28], [152, 46, 38]]

/** Fills the craft's grid with the first (darkest) tone of each surface. Edit this to change the craft. */
function sculpt() {
  const grid = new Uint8Array(CRAFT_W * CRAFT_L * CRAFT_H)
  const mid = (CRAFT_W - 1) / 2
  const put = (a, k, z, kind) => {
    // `a` is measured from the centre line, so every shape is mirrored for free
    if (k < 0 || k >= CRAFT_L || z < 0 || z >= CRAFT_H || Math.abs(a) > mid) return
    grid[(z * CRAFT_L + k) * CRAFT_W + mid + a] = kind
    grid[(z * CRAFT_L + k) * CRAFT_W + mid - a] = kind
  }

  // body: a tube that swells from the nose, then flattens and widens over the engines
  for (let k = 0; k < 40; k++) {
    const nose = Math.sin(Math.min(1, k / 12) * Math.PI * 0.5)
    const rear = Math.min(1, Math.max(0, (k - 26) / 5))
    const wide = 0.7 + 2.3 * nose + 1.2 * rear
    const tall = 0.6 + 1.5 * nose - 0.4 * rear
    for (let z = 0; z < CRAFT_H; z++) {
      for (let a = 0; a <= mid; a++) {
        if ((a / wide) ** 2 + ((z - 4) / tall) ** 2 <= 1) put(a, k, z, HULL)
      }
    }
  }

  // delta wing: one layer thick, two near the root, with painted tips and trailing edge
  for (let k = 14; k <= 36; k++) {
    const span = k <= 31 ? 3 + (k - 14) * (11.5 / 17) : 14.5
    for (let a = 0; a <= span; a++) {
      const trailing = 36 - a * (2 / 14.5)
      if (k > trailing) continue
      const painted = a >= 12.5 || k > trailing - 1.5
      put(a, k, 3, painted ? TRIM : HULL)
      if (a <= span * 0.45) put(a, k, 4, HULL)
    }
  }

  // twin fins, swept back, with painted tops
  for (let k = 30; k <= 39; k++) {
    let top = 5 + Math.min(5, Math.floor((k - 30) * 0.9))
    if (k > 37) top -= (k - 37) * 2
    for (let z = 5; z <= top; z++) put(5, k, z, z >= 9 ? TRIM : HULL)
  }

  // canopy
  for (let k = 5; k <= 16; k++) {
    for (let z = 5; z <= 8; z++) {
      for (let a = 0; a <= 2; a++) {
        if ((a / 1.9) ** 2 + ((k - 10.5) / 4.8) ** 2 + ((z - 4.6) / 2.6) ** 2 <= 1) put(a, k, z, GLASS)
      }
    }
  }

  // engines: two dark nozzles with a glowing core
  for (let k = 38; k <= 41; k++) {
    for (let z = 2; z <= 6; z++) {
      for (let a = 0; a <= 4; a++) {
        const far = Math.sqrt((a - 2) ** 2 + (z - 4) ** 2)
        if (far > 1.8) continue
        put(a, k, z, k === 41 && far < 0.9 ? GLOW : METAL)
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

export function buildCraft() {
  const pivotK = 23
  const pivotZ = 4
  return buildModel(sculptGrid(), {
    ...CRAFT_SIZE,
    pivotK,
    pivotZ,
    palette: CRAFT_PALETTE,
    nozzles: [{ a: -2, b: pivotK - 41.6, z: 4 - pivotZ }, { a: 2, b: pivotK - 41.6, z: 4 - pivotZ }],
    nozzleRadius: 1.5,
    wingtips: [{ a: -14, b: pivotK - 33, z: 3 - pivotZ }, { a: 14, b: pivotK - 33, z: 3 - pivotZ }],
  })
}

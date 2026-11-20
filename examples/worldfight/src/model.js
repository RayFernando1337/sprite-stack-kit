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
 *   flame                   five colours for the engine flame, hot to cool (optional)
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
    flame: (spec.flame ?? FLAME).map((c) => rgb(...c)),
    guns: spec.guns ?? [],
    rails: spec.rails ?? [],
    nozzles: spec.nozzles ?? [],
    nozzleRadius: spec.nozzleRadius ?? 1.5,
    wingtips: spec.wingtips ?? [],
  }
}

export function sculptGrid() {
  return shadeGrid(sculpt(), CRAFT_SIZE, GLOW)
}

/** The rocket ship: what the player flies over the Earth and the country. */
export function buildCraft() {
  const pivotK = 19
  const pivotZ = 6
  return buildModel(sculptGrid(), {
    ...CRAFT_SIZE,
    pivotK,
    pivotZ,
    palette: SHIP_PALETTE,
    nozzles: [{ a: 0, b: pivotK - 37.6, z: 0 }],
    nozzleRadius: 2.4,
    wingtips: [{ a: -9, b: pivotK - 34, z: 0 }, { a: 9, b: pivotK - 34, z: 0 }],
  })
}

// ── the two fighter planes: the one the rocket turns into over the city, and the enemy's

const PLANE = { width: 27, length: 36, height: 10 }
const RIVAL = { width: 25, length: 32, height: 11 }
// The player's plane wears the rocket's colours, so it reads as the same ship in a new shape.
const PLANE_PALETTE = SHIP_PALETTE
const RIVAL_PALETTE = [
  null,
  [44, 50, 68], [74, 82, 104], [112, 122, 146],
  [150, 108, 14], [222, 172, 30], [255, 226, 84],
  [110, 20, 34], [190, 40, 48], [250, 104, 90],
  [26, 26, 34], [48, 50, 60], [76, 80, 92],
  [150, 255, 236],
]
const RIVAL_FLAME = [[236, 255, 250], [150, 255, 236], [70, 214, 226], [44, 136, 214], [48, 70, 160]]

/** An empty grid and a `put` that writes both sides of the centre line at once. */
function blank({ width, length, height }) {
  const grid = new Uint8Array(width * length * height)
  const mid = (width - 1) / 2
  const put = (a, k, z, kind) => {
    if (k < 0 || k >= length || z < 0 || z >= height || a < 0 || a > mid) return
    grid[(z * length + k) * width + mid + a] = kind
    grid[(z * length + k) * width + mid - a] = kind
  }
  return { grid, put }
}

/** The player's fighter: swept wings, two canted tail fins and two engines. */
function sculptPlane() {
  const { grid, put } = blank(PLANE)
  const core = 3
  // body: an oval tube that grows out of a pointed nose
  for (let k = 0; k < 34; k++) {
    const grow = Math.sin((Math.min(k + 1, 11) / 11) * Math.PI * 0.5)
    const wide = (0.5 + 2.3 * grow) - Math.max(0, k - 29) * 0.12
    const tall = 0.5 + 1.7 * grow
    for (let z = 0; z < PLANE.height; z++) {
      for (let a = 0; a <= 3; a++) {
        if ((a / wide) ** 2 + ((z - core) / tall) ** 2 <= 1) put(a, k, z, k < 4 ? TRIM : HULL)
      }
    }
  }
  // the canopy: a long glass bubble
  for (let k = 6; k <= 14; k++) {
    for (let a = 0; a <= 1; a++) {
      if ((a / 1.7) ** 2 + ((k - 10) / 4.2) ** 2 <= 1) put(a, k, core + 3, GLASS)
    }
    if (k >= 8 && k <= 12) put(0, k, core + 4, GLASS)
  }
  // air intakes on the shoulders
  for (let k = 11; k <= 18; k++) {
    put(3, k, core, METAL)
    put(3, k, core - 1, METAL)
  }
  // wings: swept back, two layers thick at the root, painted at the tips
  for (let a = 3; a <= 12; a++) {
    const lead = Math.ceil(13 + (a - 3) * 1.25)
    const trail = Math.floor(27 + (a - 3) * 0.25)
    for (let k = lead; k <= trail; k++) {
      put(a, k, core, a >= 11 ? TRIM : HULL)
      if (a <= 6 && k > lead) put(a, k, core - 1, HULL)
    }
  }
  // a missile rail on each wingtip
  for (let k = 22; k <= 31; k++) put(12, k, core, k < 24 ? METAL : TRIM)
  // tailplanes
  for (let a = 3; a <= 7; a++) {
    for (let k = Math.ceil(29 + (a - 3) * 0.9); k <= 34; k++) put(a, k, core, a === 7 ? TRIM : HULL)
  }
  // two tail fins that lean outwards
  for (let k = 26; k <= 33; k++) {
    const tall = Math.min(4, Math.floor((k - 25) * 0.75))
    for (let n = 0; n < tall; n++) put(n >= 2 ? 3 : 2, k, core + 3 + n, n === tall - 1 ? TRIM : HULL)
  }
  // two engines, side by side
  for (let k = 31; k <= 35; k++) {
    for (let z = core - 1; z <= core + 1; z++) {
      for (let a = 1; a <= 2; a++) put(a, k, z, k === 35 && z === core ? GLOW : METAL)
    }
  }
  return grid
}

/** The enemy's fighter: a dart with one big delta wing, small foreplanes and one tall fin. */
function sculptRival() {
  const { grid, put } = blank(RIVAL)
  const core = 3
  for (let k = 0; k < 30; k++) {
    const grow = Math.sin((Math.min(k + 1, 14) / 14) * Math.PI * 0.5)
    const wide = 0.4 + 1.9 * grow
    const tall = 0.4 + 1.7 * grow
    for (let z = 0; z < RIVAL.height; z++) {
      for (let a = 0; a <= 2; a++) {
        if ((a / wide) ** 2 + ((z - core) / tall) ** 2 <= 1) put(a, k, z, HULL)
      }
    }
  }
  for (let k = 9; k <= 14; k++) {
    put(0, k, core + 3, GLASS)
    if (k < 14) put(1, k, core + 2, GLASS)
  }
  // foreplanes
  for (let a = 2; a <= 5; a++) {
    for (let k = Math.ceil(5 + (a - 2) * 0.9); k <= 8; k++) put(a, k, core, TRIM)
  }
  // the delta: a straight trailing edge and a painted leading edge
  for (let a = 2; a <= 11; a++) {
    const lead = Math.ceil(10 + (a - 2) * 1.9)
    for (let k = lead; k <= 28; k++) {
      put(a, k, core, k <= lead + 1 || a === 11 ? TRIM : HULL)
      if (a <= 5 && k > lead + 2) put(a, k, core - 1, HULL)
    }
  }
  // a small upright fin on each wingtip
  for (let k = 25; k <= 28; k++) put(11, k, core + 1, TRIM)
  // one tall fin
  for (let k = 20; k <= 30; k++) {
    const tall = Math.min(5, Math.floor((k - 19) * 0.8)) - Math.max(0, k - 29) * 2
    for (let n = 0; n < tall; n++) put(0, k, core + 3 + n, n >= tall - 1 ? TRIM : HULL)
  }
  // one engine
  for (let k = 28; k <= 31; k++) {
    for (let z = core - 2; z <= core + 2; z++) {
      for (let a = 0; a <= 2; a++) {
        const far = Math.sqrt(a * a + (z - core) * (z - core))
        if (far <= 2.3) put(a, k, z, k === 31 && far < 1.5 ? GLOW : METAL)
      }
    }
  }
  return grid
}

/** The fighter the ship turns into over the city. */
export function buildPlane() {
  const pivotK = 19
  const pivotZ = 3
  return buildModel(shadeGrid(sculptPlane(), PLANE, GLOW), {
    ...PLANE,
    pivotK,
    pivotZ,
    palette: PLANE_PALETTE,
    nozzles: [{ a: -1.5, b: pivotK - 35.6, z: 0 }, { a: 1.5, b: pivotK - 35.6, z: 0 }],
    nozzleRadius: 1.5,
    wingtips: [{ a: -12, b: pivotK - 30, z: 0 }, { a: 12, b: pivotK - 30, z: 0 }],
    // where the guns and the missiles leave from
    guns: [{ a: -4, b: pivotK - 14, z: -1 }, { a: 4, b: pivotK - 14, z: -1 }],
    rails: [{ a: -12, b: pivotK - 24, z: -1 }, { a: 12, b: pivotK - 24, z: -1 }],
  })
}

/** The plane the computer pilots fly: another shape, in other colours, with a colder flame. */
export function buildRival() {
  const pivotK = 18
  const pivotZ = 3
  return buildModel(shadeGrid(sculptRival(), RIVAL, GLOW), {
    ...RIVAL,
    pivotK,
    pivotZ,
    palette: RIVAL_PALETTE,
    outline: [58, 14, 30],
    flame: RIVAL_FLAME,
    nozzles: [{ a: 0, b: pivotK - 31.6, z: 0 }],
    nozzleRadius: 2,
    wingtips: [{ a: -11, b: pivotK - 28, z: 0 }, { a: 11, b: pivotK - 28, z: 0 }],
  })
}

/** The same model in one flat colour: drawn for a moment when something is hit. */
export function flashOf(model, colour = [255, 255, 255]) {
  const colors = new Uint32Array(model.colors.length)
  for (let i = 1; i < colors.length; i++) colors[i] = rgb(...colour)
  return { ...model, colors }
}

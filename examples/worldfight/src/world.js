// The world is three maps of the real Earth, one for each level: the whole Earth, the
// United States, and San Francisco. Each is rebuilt from a small packed grid (see atlas.js
// and scripts/maps.mjs): the grid gives the coast and the height of the land, and seeded
// noise fills in the detail between its cells. A map is two wrapping layers, as in the kit:
//   · the ground: a height and a material for every pixel
//   · the clouds: a thickness for every pixel of a smaller map, floating at one altitude

import { makeRng, hash2, tileableNoise } from './rng.js'
import { rgb, tint } from './framebuffer.js'
import { unpackLand, unpackLines, placeX, placeY, lonAt, latAt } from './atlas.js'
import { buildCity } from './city.js'
import earth from './map-earth.js'
import usa from './map-usa.js'
import sf from './map-sf.js'

// Sizes are powers of two so a position wraps with a bit mask instead of a division.
export const WORLD_SHIFT = 10
export const WORLD_SIZE = 1 << WORLD_SHIFT
export const WORLD_MASK = WORLD_SIZE - 1
export const GROUND_MAX = 34 // the tallest ground, trees and towers included

export const CLOUD_SHIFT = 9
export const CLOUD_SIZE = 1 << CLOUD_SHIFT
export const CLOUD_MASK = CLOUD_SIZE - 1
export const CLOUD_BASE = 46 // the height the clouds float at
export const CLOUD_LAYERS = 6 // the thickest a cloud gets
export const TOP_Z = CLOUD_BASE + CLOUD_LAYERS // the tallest thing in the world

// The sun is in the north-west. A shadow lands this far east and south per pixel of height.
export const SUN_X = 0.55
export const SUN_Y = 0.4

export const MAT = {
  DEEP: 0, SEA: 1, SHALLOW: 2, SURF: 3, SAND: 4,
  GRASS: 5, GRASS_DARK: 6, GRASS_LIGHT: 7, TREE: 8, CROWN: 9,
  ROCK: 10, ROCK_DARK: 11, SNOW: 12,
  DUNE: 13, DUNE_DARK: 14, STEPPE: 15, BORDER: 16,
  STREET: 17, BLOCK: 18, BLOCK_WARM: 19, BLOCK_COOL: 20, TOWER: 21, TOWER_DARK: 22, STEEL: 23, FOG: 24,
}
export const WATER_BELOW = MAT.SAND // materials under this index are water
export const EDGE_FOG = 30 // how many pixels of fog lie along the edge of a country or a city

// [top colour, side colour] for each material. The side is what shows on the wall of a stack.
const MATERIALS = [
  [[30, 96, 170], [30, 96, 170]],
  [[40, 118, 192], [40, 118, 192]],
  [[64, 154, 210], [64, 154, 210]],
  [[116, 206, 218], [116, 206, 218]],
  [[236, 216, 160], [198, 172, 116]],
  [[104, 176, 62], [60, 120, 50]],
  [[78, 150, 54], [52, 106, 46]],
  [[142, 204, 86], [66, 130, 52]],
  [[46, 118, 58], [26, 76, 44]],
  [[72, 152, 68], [30, 84, 46]],
  [[152, 144, 136], [100, 94, 94]],
  [[122, 114, 110], [88, 84, 86]],
  [[244, 248, 255], [184, 200, 226]],
  [[232, 196, 124], [190, 146, 88]], // dune
  [[208, 164, 98], [168, 122, 76]],
  [[176, 180, 96], [124, 130, 70]], // steppe: dry grass
  [[70, 60, 78], [58, 50, 66]], // border line
  [[112, 116, 126], [84, 88, 100]], // street
  [[214, 208, 196], [150, 146, 150]], // low blocks
  [[226, 190, 160], [162, 124, 112]],
  [[190, 204, 214], [122, 140, 160]],
  [[150, 196, 224], [70, 110, 150]], // glass towers
  [[108, 150, 190], [52, 82, 122]],
  [[226, 84, 52], [168, 52, 44]], // bridge steel
  [[206, 228, 244], [206, 228, 244]], // the fog at the edge of a map
]

function buildPalette() {
  const count = MATERIALS.length
  const pal = {
    topLit: new Uint32Array(count),
    topShade: new Uint32Array(count),
    sideLit: new Uint32Array(count),
    sideShade: new Uint32Array(count),
    cloudTop: new Uint32Array(CLOUD_LAYERS + 1),
    cloudSide: new Uint32Array(CLOUD_LAYERS + 1),
    cloudUnder: rgb(134, 156, 198),
    haze: rgb(190, 224, 246),
    foam: rgb(240, 252, 255),
    glint: rgb(232, 248, 255),
    sky: new Uint32Array(8),
    trail: [rgb(255, 255, 255), rgb(216, 234, 250), rgb(174, 206, 240)],
  }
  for (let m = 0; m < count; m++) {
    pal.topLit[m] = rgb(...MATERIALS[m][0])
    pal.sideLit[m] = rgb(...MATERIALS[m][1])
    // shadows are cooler as well as darker, so they read as shade and not as dirt
    pal.topShade[m] = tint(pal.topLit[m], 0.6, 0.66, 0.84)
    pal.sideShade[m] = tint(pal.sideLit[m], 0.6, 0.66, 0.84)
  }
  for (let k = 0; k <= CLOUD_LAYERS; k++) {
    const up = k / CLOUD_LAYERS
    const crown = Math.min(1, k / 3)
    pal.cloudTop[k] = rgb(220 + 35 * crown, 232 + 23 * crown, 248 + 7 * crown)
    pal.cloudSide[k] = rgb(160 + 44 * up, 184 + 36 * up, 224 + 18 * up)
  }
  // the sky, from the horizon up
  const low = [200, 234, 250]
  const mid = [124, 192, 240]
  const high = [60, 140, 220]
  for (let i = 0; i < 8; i++) {
    const f = i / 7
    const a = f < 0.5 ? low : mid
    const b = f < 0.5 ? mid : high
    const g = f < 0.5 ? f * 2 : f * 2 - 1
    pal.sky[i] = rgb(a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g, a[2] + (b[2] - a[2]) * g)
  }
  return pal
}

/**
 * The levels, from the top down. `curve`, `steps` and `terrace` shape the height of the
 * land; `rough` is how far the noise moves the coast; `start` is where a game that begins
 * on this level puts the ship, as [longitude, latitude].
 */
export const LEVELS = [
  { name: 'EARTH', map: earth, wraps: true, curve: 1.25, steps: 13, terrace: 2, rough: 0.9, clouds: 0.5, woods: 1, start: [-150, 24] },
  { name: 'USA', label: 'USA', map: usa, curve: 1.2, steps: 13, terrace: 2, rough: 0.8, clouds: 0.45, woods: 1, start: [-121, 33] },
  { name: 'SAN FRANCISCO', label: 'SF', map: sf, city: true, curve: 1.3, steps: 12, terrace: 1, rough: 0.5, clouds: 0.2, woods: 0, start: [-122.56, 37.765] },
]

// The world's dry places, drawn by hand as ovals: [longitude, latitude, half-width, half-height] in degrees.
const DESERTS = [
  [10, 23, 28, 8.5], [47, 23, 10, 9], [60, 38, 13, 7], [95, 41, 18, 5.5], [71, 27, 4, 4],
  [132, -25, 15, 7.5], [20, -24, 7, 6], [-70, -23, 2.2, 8], [-68, -44, 3.5, 6.5],
  [-113.5, 33.5, 6, 4.8], [-116.5, 39.8, 3.6, 3.2], [-104.5, 28.5, 4.5, 4.5],
]
const PLAINS = [[-101, 41, 5, 9], [62, 49, 22, 5], [105, 46, 14, 4], [-64, -36, 5, 7], [25, 12.5, 30, 3]]

function inside(ovals, lon, lat, grow) {
  let best = 9
  for (let i = 0; i < ovals.length; i++) {
    const o = ovals[i]
    const d = ((lon - o[0]) / o[2]) ** 2 + ((lat - o[1]) / o[3]) ** 2
    if (d < best) best = d
  }
  return best < grow
}

/** Builds one level's map. The seed only moves the fine detail and the clouds. */
function buildLevel(index, seed) {
  const spec = LEVELS[index]
  const map = spec.map
  const n = map.size
  const SIZE = WORLD_SIZE
  const rng = makeRng((seed | 0) * 7919 + 17 + index * 101)
  const heights = new Uint8Array(SIZE * SIZE)
  const materials = new Uint8Array(SIZE * SIZE)
  const noise = tileableNoise(SIZE, [[64, 1], [32, 0.6], [16, 0.35], [8, 0.2]], rng)
  const steps = unpackLand(map)

  // How far each cell of water is from land, in cells, up to 9: two sweeps, there and back.
  const far = new Uint8Array(n * n)
  for (let i = 0; i < n * n; i++) far[i] = steps[i] ? 0 : 9
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const y = pass ? n - 1 - j : j
        const x = pass ? n - 1 - i : i
        const side = pass ? 1 : -1
        const xs = spec.wraps ? (x + side + n) % n : Math.min(n - 1, Math.max(0, x + side))
        const ys = Math.min(n - 1, Math.max(0, y + side))
        const near = Math.min(far[y * n + xs], far[ys * n + x]) + 1
        if (near < far[y * n + x]) far[y * n + x] = near
      }
    }
  }

  // A cell's value at any point between cells: the four cells round it, mixed by distance.
  const between = (grid, x, y) => {
    const u = ((x + 0.5) * n) / SIZE - 0.5
    const v = ((y + 0.5) * n) / SIZE - 0.5
    const i = Math.floor(u)
    const j = Math.floor(v)
    const fx = u - i
    const fy = v - j
    const i0 = spec.wraps ? (i + n) % n : Math.min(n - 1, Math.max(0, i))
    const i1 = spec.wraps ? (i + 1 + n) % n : Math.min(n - 1, Math.max(0, i + 1))
    const j0 = Math.min(n - 1, Math.max(0, j)) * n
    const j1 = Math.min(n - 1, Math.max(0, j + 1)) * n
    return (grid[j0 + i0] * (1 - fx) + grid[j0 + i1] * fx) * (1 - fy) + (grid[j1 + i0] * (1 - fx) + grid[j1 + i1] * fx) * fy
  }

  // First the shape: how high every pixel is, on the packed grid's scale of 0 to 15.
  const lift = new Float32Array(SIZE * SIZE)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const o = (y << WORLD_SHIFT) | x
      lift[o] = between(steps, x, y) + (noise[o] - 0.5) * spec.rough
    }
  }

  // Then what it is made of.
  for (let y = 0; y < SIZE; y++) {
    const lat = latAt(map, y)
    const cold = Math.abs(lat)
    const snowLine = 5600 - 65 * cold // metres: lower towards the poles
    for (let x = 0; x < SIZE; x++) {
      const o = (y << WORLD_SHIFT) | x
      const e = lift[o]
      const speck = hash2(x, y)
      if (e <= 0.5) {
        const out = between(far, x, y) + (noise[o] - 0.5) * 0.7
        materials[o] = out > 3.4 ? MAT.DEEP : out > 1.7 ? MAT.SEA : out > 0.85 ? MAT.SHALLOW : MAT.SURF
        continue
      }
      const rise = Math.min(1, (e - 0.5) / 14.5) // 0 at the shore … 1 at the map's `top`
      const metres = rise * rise * map.top
      heights[o] = Math.max(1, Math.round(Math.pow(rise, spec.curve) * spec.steps)) * spec.terrace
      // slopes that face the sun are lighter and slopes that face away are darker
      const slope = lift[(((y - 2) & WORLD_MASK) << WORLD_SHIFT) | ((x - 2) & WORLD_MASK)] - lift[(((y + 2) & WORLD_MASK) << WORLD_SHIFT) | ((x + 2) & WORLD_MASK)]
      const lit = slope < -0.25
      const dim = slope > 0.25
      if (spec.city) {
        // the city's own materials are laid over this in city.js
        materials[o] = e < 0.75 ? MAT.SAND : metres > 230 ? (dim ? MAT.ROCK_DARK : MAT.STEPPE) : lit ? MAT.GRASS_LIGHT : dim || speck < 20 ? MAT.GRASS_DARK : MAT.GRASS
        continue
      }
      const lon = lonAt(map, x)
      const edge = (noise[o] - 0.5) * 0.5 // a ragged edge to every region
      if (e < 0.62) materials[o] = MAT.SAND
      else if (cold > 68 + edge * 16 || metres > snowLine + edge * 900 || (lat > 60 && lon > -56 && lon < -18 && metres > 250)) materials[o] = MAT.SNOW
      else if (metres > snowLine * 0.8 + edge * 600) materials[o] = dim || speck < 28 ? MAT.ROCK_DARK : MAT.ROCK
      else if (inside(DESERTS, lon, lat, 1 + edge)) materials[o] = dim || speck < 36 ? MAT.DUNE_DARK : MAT.DUNE
      else if (inside(DESERTS, lon, lat, 1.5 + edge) || inside(PLAINS, lon, lat, 1 + edge) || cold > 57 + edge * 14) materials[o] = MAT.STEPPE
      else materials[o] = lit ? MAT.GRASS_LIGHT : dim || speck < 20 ? MAT.GRASS_DARK : MAT.GRASS
    }
  }

  // Woods: small mounds of leaves on the grass, thicker where a second noise is high.
  if (spec.woods) {
    const woods = tileableNoise(256, [[64, 1], [32, 0.5]], rng)
    for (let gy = 0; gy < SIZE; gy += 4) {
      for (let gx = 0; gx < SIZE; gx += 4) {
        const pick = hash2(gx + 71, gy + 13)
        const x = (gx + (pick & 3)) & WORLD_MASK
        const y = (gy + ((pick >> 2) & 3)) & WORLD_MASK
        const o = (y << WORLD_SHIFT) | x
        const here = materials[o]
        if (here < MAT.GRASS || here > MAT.GRASS_LIGHT || heights[o] > 12) continue
        const density = (woods[((y >> 2) << 8) | (x >> 2)] - 0.42) * 3.2
        if (density * 255 < hash2(x + 5, y + 99)) continue
        const radius = 1 + ((pick >> 4) & 1)
        const base = heights[o]
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const away = Math.sqrt(dx * dx + dy * dy)
            if (away > radius + 0.4) continue
            const at = (((y + dy) & WORLD_MASK) << WORLD_SHIFT) | ((x + dx) & WORLD_MASK)
            if (materials[at] < MAT.GRASS || materials[at] > MAT.CROWN) continue
            const tall = base + 1 + Math.round((1 - away / (radius + 0.6)) * (radius + 0.5))
            if (tall > heights[at]) {
              heights[at] = tall
              materials[at] = away < 1 ? MAT.CROWN : MAT.TREE
            }
          }
        }
      }
    }
  }

  // Borders: a dark line on the land wherever the packed line grid is marked.
  if (map.lines) {
    const m = map.lineSize
    const marks = unpackLines(map)
    const wide = SIZE / m
    for (let i = 0; i < marks.length; i++) {
      if (!marks[i]) continue
      const x0 = Math.floor((i % m) * wide)
      const y0 = Math.floor(((i / m) | 0) * wide)
      // one pixel wide, so a line reads as a line and not as a road
      const o = (y0 << WORLD_SHIFT) | x0
      if (materials[o] >= MAT.SAND) materials[o] = MAT.BORDER
      const next = (y0 << WORLD_SHIFT) | ((x0 + 1) & WORLD_MASK)
      if (wide > 1 && materials[next] >= MAT.SAND && (i % m) + 1 < m && !marks[i + 1] && hash2(x0, y0) > 127) materials[next] = MAT.BORDER
    }
  }

  if (spec.city) buildCity(map, heights, materials, lift, seed)

  // A country and a city end. Fog lies over the last pixels of the map, ragged on the inside,
  // so the far edge meets the near edge fog to fog and the ship leaves through it.
  if (!spec.wraps) {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const o = (y << WORLD_SHIFT) | x
        const edge = Math.min(x, y, SIZE - 1 - x, SIZE - 1 - y)
        if (edge > EDGE_FOG + 8) continue
        if (edge < EDGE_FOG + (noise[o] - 0.5) * 16) {
          heights[o] = 0
          materials[o] = MAT.FOG
        }
      }
    }
  }

  // Clouds: each one grows by a short random walk that stamps a dome at every step, so it
  // comes out lumpy instead of round. Each cell holds how many layers thick the cloud is there.
  const cloudMap = new Uint8Array(CLOUD_SIZE * CLOUD_SIZE)
  const count = Math.round(64 * spec.clouds)
  for (let i = 0; i < count; i++) {
    let x = rng() * CLOUD_SIZE
    let y = rng() * CLOUD_SIZE
    let radius = 5 + rng() * 10
    const stamps = 2 + ((rng() * 6) | 0)
    for (let s = 0; s < stamps; s++) {
      const thick = Math.min(CLOUD_LAYERS, Math.max(2, radius * 0.5))
      const reach = Math.ceil(radius)
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const d2 = (dx * dx + dy * dy) / (radius * radius)
          if (d2 > 1) continue
          const layers = Math.max(1, Math.round(Math.sqrt(1 - d2) * thick))
          const at = (((Math.round(y) + dy) & CLOUD_MASK) << CLOUD_SHIFT) | ((Math.round(x) + dx) & CLOUD_MASK)
          if (layers > cloudMap[at]) cloudMap[at] = layers
        }
      }
      // the next dome overlaps this one; clouds stretch further east–west than north–south
      const way = rng() * Math.PI * 2
      x += Math.cos(way) * radius * 0.95
      y += Math.sin(way) * radius * 0.55
      radius = Math.max(3, radius * (0.65 + rng() * 0.5))
    }
  }

  return {
    seed, level: index, name: spec.name, map, heights, materials, cloudMap,
    spawnX: placeX(map, spec.start[0]), spawnY: placeY(map, spec.start[1]),
    palette: buildPalette(),
  }
}

// Building three maps takes a moment, and the same seed always gives the same three, so
// they are built once and shared by every game that asks for that seed.
const built = new Map()

/**
 * The world for a seed: the map of one level, with all three in `levels`. `level` picks
 * which one comes back (0 is the Earth).
 */
export function buildWorld(seed = 7, { level = 0 } = {}) {
  if (!built.has(seed)) {
    const levels = LEVELS.map((spec, index) => buildLevel(index, seed))
    for (const each of levels) each.levels = levels
    built.set(seed, levels)
  }
  return built.get(seed)[Math.min(LEVELS.length - 1, Math.max(0, level | 0))]
}

export function groundAt(world, x, y) {
  return world.heights[(((y | 0) & WORLD_MASK) << WORLD_SHIFT) | ((x | 0) & WORLD_MASK)]
}

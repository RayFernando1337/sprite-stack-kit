// The world is two wrapping maps made from one seed:
//   · the ground: a height and a material for every pixel of the map
//   · the clouds: a thickness for every pixel of a smaller map, floating at one altitude
// Both are "stacks": terrain.js draws a ground pixel of height 6 as six layers.

import { makeRng, hash2, tileableNoise } from './rng.js'
import { rgb, tint } from './framebuffer.js'

// Sizes are powers of two so a position wraps with a bit mask instead of a division.
export const WORLD_SHIFT = 10
export const WORLD_SIZE = 1 << WORLD_SHIFT
export const WORLD_MASK = WORLD_SIZE - 1
export const GROUND_MAX = 34 // the tallest ground, trees included

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
}
export const WATER_BELOW = MAT.SAND // materials under this index are water

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
 * Builds the world for a seed. `land` is the share of the map that is above water (0..1) and
 * `clouds` is how much cloud there is (0..1).
 */
export function buildWorld(seed = 7, { land = 0.3, clouds = 0.5 } = {}) {
  const rng = makeRng((seed | 0) * 7919 + 17)
  const heights = new Uint8Array(WORLD_SIZE * WORLD_SIZE)
  const materials = new Uint8Array(WORLD_SIZE * WORLD_SIZE)
  const field = tileableNoise(WORLD_SIZE, [[256, 1], [128, 0.5], [64, 0.25], [32, 0.12], [16, 0.05]], rng)

  // Put the sea level where it leaves the wanted share of land: count how many cells sit at
  // each height, then walk up until enough of them are under water.
  const bins = new Uint32Array(1024)
  for (let i = 0; i < field.length; i++) bins[Math.min(1023, (field[i] * 1024) | 0)]++
  const wet = (1 - Math.min(0.9, Math.max(0.02, land))) * field.length
  let sea = 1
  for (let b = 0, count = 0; b < 1024; b++) {
    count += bins[b]
    if (count >= wet) {
      sea = (b + 1) / 1024
      break
    }
  }

  const BEACH = 0.012
  const span = Math.max(0.05, 1 - sea - BEACH)
  const steps = GROUND_MAX / 2 - 3 // terraces of two layers each; the rest is headroom for trees
  for (let y = 0; y < WORLD_SIZE; y++) {
    const row = y << WORLD_SHIFT
    const rowNW = ((y - 2) & WORLD_MASK) << WORLD_SHIFT
    const rowSE = ((y + 2) & WORLD_MASK) << WORLD_SHIFT
    for (let x = 0; x < WORLD_SIZE; x++) {
      const o = row | x
      const e = field[o] - sea
      const speck = hash2(x, y)
      if (e < 0) {
        const deep = -e + (speck - 128) * 0.00005 // a ragged edge between the bands of blue
        materials[o] = deep > 0.075 ? MAT.DEEP : deep > 0.032 ? MAT.SEA : deep > 0.009 ? MAT.SHALLOW : MAT.SURF
        continue
      }
      if (e < BEACH) {
        materials[o] = MAT.SAND
        continue
      }
      const rise = Math.min(1, (e - BEACH) / span) // 0 at the beach … 1 on the highest peak
      heights[o] = Math.max(1, Math.round(Math.pow(rise, 0.85) * steps)) * 2
      // slopes that face the sun are lighter and slopes that face away are darker
      const slope = field[rowNW | ((x - 2) & WORLD_MASK)] - field[rowSE | ((x + 2) & WORLD_MASK)]
      const lit = slope < -0.006
      const dim = slope > 0.006
      if (rise > 0.8) materials[o] = MAT.SNOW
      else if (rise > 0.48) materials[o] = dim || speck < 28 ? MAT.ROCK_DARK : MAT.ROCK
      else materials[o] = lit ? MAT.GRASS_LIGHT : dim || speck < 20 ? MAT.GRASS_DARK : MAT.GRASS
    }
  }

  // Woods: small mounds of leaves on the lower grass, thicker where a second noise is high.
  const woods = tileableNoise(256, [[64, 1], [32, 0.5]], rng)
  for (let gy = 0; gy < WORLD_SIZE; gy += 4) {
    for (let gx = 0; gx < WORLD_SIZE; gx += 4) {
      const pick = hash2(gx + 71, gy + 13)
      const x = (gx + (pick & 3)) & WORLD_MASK
      const y = (gy + ((pick >> 2) & 3)) & WORLD_MASK
      const o = (y << WORLD_SHIFT) | x
      const here = materials[o]
      if (here < MAT.GRASS || here > MAT.GRASS_LIGHT || heights[o] > 14) continue
      const density = (woods[((y >> 2) << 8) | (x >> 2)] - 0.5) * 3.2
      if (density * 255 < hash2(x + 5, y + 99)) continue
      const radius = 1 + ((pick >> 4) & 1)
      const base = heights[o]
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const far = Math.sqrt(dx * dx + dy * dy)
          if (far > radius + 0.4) continue
          const at = (((y + dy) & WORLD_MASK) << WORLD_SHIFT) | ((x + dx) & WORLD_MASK)
          if (materials[at] < MAT.SAND) continue
          const tall = base + 1 + Math.round((1 - far / (radius + 0.6)) * (radius + 1.5))
          if (tall > heights[at]) {
            heights[at] = tall
            materials[at] = far < 1 ? MAT.CROWN : MAT.TREE
          }
        }
      }
    }
  }

  // Start over open water, about a hundred pixels off the nearest shore: try some random
  // spots, measure how far each is from land along twelve rays, and keep the best.
  let spawnX = WORLD_SIZE / 2
  let spawnY = WORLD_SIZE / 2
  let bestMiss = Infinity
  for (let tries = 0; tries < 200; tries++) {
    const x = (rng() * WORLD_SIZE) | 0
    const y = (rng() * WORLD_SIZE) | 0
    if (materials[(y << WORLD_SHIFT) | x] > MAT.SEA) continue
    let shore = 400
    for (let ray = 0; ray < 12; ray++) {
      const dx = Math.cos(ray * (Math.PI / 6))
      const dy = Math.sin(ray * (Math.PI / 6))
      for (let far = 10; far < shore; far += 10) {
        const at = (((y + dy * far) & WORLD_MASK) << WORLD_SHIFT) | ((x + dx * far) & WORLD_MASK)
        if (materials[at] >= MAT.SAND) {
          shore = far
          break
        }
      }
    }
    const miss = Math.abs(shore - 100)
    if (miss < bestMiss) {
      bestMiss = miss
      spawnX = x
      spawnY = y
    }
  }

  // Clouds: each one grows by a short random walk that stamps a dome at every step, so it
  // comes out lumpy instead of round. Each cell holds how many layers thick the cloud is there.
  const cloudMap = new Uint8Array(CLOUD_SIZE * CLOUD_SIZE)
  const count = Math.round(64 * Math.min(1, Math.max(0, clouds)))
  for (let i = 0; i < count; i++) {
    let x = rng() * CLOUD_SIZE
    let y = rng() * CLOUD_SIZE
    let radius = 5 + rng() * 10
    const stamps = 2 + ((rng() * 6) | 0)
    for (let n = 0; n < stamps; n++) {
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

  return { seed, heights, materials, cloudMap, spawnX, spawnY, palette: buildPalette() }
}

export function groundAt(world, x, y) {
  return world.heights[(((y | 0) & WORLD_MASK) << WORLD_SHIFT) | ((x | 0) & WORLD_MASK)]
}

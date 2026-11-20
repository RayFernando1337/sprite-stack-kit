// Smoke, sparks, debris and blasts: everything that is thrown out and fades away.
//
// Each kind lives in one flat array of a fixed size with a head that wraps, so the oldest is
// overwritten when the array is full and nothing is ever created while the game runs.

import { rgb, BAYER4 } from './framebuffer.js'
import { project, eyeDistance } from './camera.js'
import { groundAt } from './world.js'
import { hash2 } from './rng.js'

const PUFFS = 240
const PUFF_F = 10 // x, y, z, speed east, south and up, born, seconds it lasts, size, kind
const BITS = 72
const BIT_F = 8 // x, y, z, speed east, south and up, born, kind
const BIT_LIFE = 1.7
const BLASTS = 8
const BLAST_F = 6 // x, y, z, born, size, 1 on water

// Three tones for each kind of puff, young to old.
const TONES = [
  [rgb(206, 210, 220), rgb(164, 170, 184), rgb(126, 132, 148)], // 0 grey smoke
  [rgb(255, 255, 255), rgb(228, 238, 248), rgb(198, 216, 238)], // 1 white: a missile's trail, spray
  [rgb(82, 76, 82), rgb(58, 56, 64), rgb(42, 42, 52)], // 2 black smoke
  [rgb(255, 240, 160), rgb(255, 166, 62), rgb(206, 76, 40)], // 3 fire
  [rgb(214, 196, 160), rgb(186, 168, 136), rgb(158, 144, 122)], // 4 dust
  [rgb(255, 252, 214), rgb(255, 224, 120), rgb(255, 170, 60)], // 5 a spark: it does not grow
]
const BIT_TONES = [rgb(44, 48, 64), rgb(222, 226, 234), rgb(255, 176, 64)]
const FIRE = [rgb(255, 252, 232), rgb(255, 226, 120), rgb(255, 152, 48), rgb(226, 78, 34), rgb(86, 62, 66)]
const SPLASH = [rgb(255, 255, 255), rgb(226, 246, 255), rgb(170, 220, 244), rgb(112, 184, 228), rgb(78, 150, 210)]

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function createEffects(heard, feel) {
  const puffs = new Float32Array(PUFFS * PUFF_F)
  const bits = new Float32Array(BITS * BIT_F)
  const blasts = new Float32Array(BLASTS * BLAST_F)
  let puffHead = 0
  let bitHead = 0
  let blastHead = 0
  let time = 0
  let made = 0 // counts everything made, to give each its own "random" numbers

  const fx = {
    /** Forgets everything: the map under it has changed. */
    clear() {
      for (let o = 6; o < puffs.length; o += PUFF_F) puffs[o] = -1e9
      for (let o = 6; o < bits.length; o += BIT_F) bits[o] = -1e9
      for (let o = 3; o < blasts.length; o += BLAST_F) blasts[o] = -1e9
    },

    /** One puff. `kind` picks its colours (see TONES); `life` is in seconds. */
    smoke(x, y, z, east, south, up, size, life, kind) {
      const o = puffHead * PUFF_F
      puffHead = (puffHead + 1) % PUFFS
      puffs[o] = x
      puffs[o + 1] = y
      puffs[o + 2] = z
      puffs[o + 3] = east
      puffs[o + 4] = south
      puffs[o + 5] = up
      puffs[o + 6] = time
      puffs[o + 7] = life
      puffs[o + 8] = size
      puffs[o + 9] = kind
      made++
    },

    /** A few sparks thrown out from a hit. */
    sparks(x, y, z) {
      for (let n = 0; n < 4; n++) {
        const way = (hash2(made, n * 13) / 255) * Math.PI * 2
        const out = 30 + hash2(made, n * 7 + 3) * 0.3
        fx.smoke(x, y, z, Math.sin(way) * out, -Math.cos(way) * out, 20 + hash2(n, made) * 0.2, 0.8, 0.22, 5)
      }
    },

    /** `count` pieces thrown out from a point that is moving at (east, south). */
    debris(x, y, z, east, south, count, force) {
      for (let n = 0; n < count; n++) {
        const o = bitHead * BIT_F
        bitHead = (bitHead + 1) % BITS
        const way = (hash2(made + n * 53, 9) / 255) * Math.PI * 2
        const out = force * (0.4 + hash2(n * 29 + 5, made) / 255)
        bits[o] = x
        bits[o + 1] = y
        bits[o + 2] = z
        bits[o + 3] = east + Math.sin(way) * out
        bits[o + 4] = south - Math.cos(way) * out
        bits[o + 5] = 18 + hash2(n * 13, made + 1) * 0.25
        bits[o + 6] = time
        bits[o + 7] = hash2(n, made + 7) % 3
      }
      made += count
    },

    /** Something goes off: a ball of fire, smoke that rises from it, pieces thrown out. On water, spray. */
    blast(x, y, z, size, wet) {
      const o = blastHead * BLAST_F
      blastHead = (blastHead + 1) % BLASTS
      blasts[o] = x
      blasts[o + 1] = y
      blasts[o + 2] = z
      blasts[o + 3] = time
      blasts[o + 4] = size
      blasts[o + 5] = wet ? 1 : 0
      // the nearer it is to the player, the more it is felt
      const near = clamp(1 - Math.hypot(x - feel.x, y - feel.y) / 460, 0, 1)
      feel.shake = Math.max(feel.shake, 0.45 * size * near)
      feel.flash = Math.max(feel.flash, 0.22 * size * near)
      if (wet) heard.splash++
      else heard.blast++
      for (let n = 0; n < 6; n++) {
        const way = (n / 6) * Math.PI * 2 + hash2(made, n) * 0.02
        const out = (10 + hash2(n * 23 + 3, made) * 0.1) * size
        if (wet) fx.smoke(x, y, z + 1, Math.sin(way) * out * 2, -Math.cos(way) * out * 2, 26 * size, 2.2 * size, 0.9, 1)
        else fx.smoke(x, y, z + 2, Math.sin(way) * out, -Math.cos(way) * out, 9 + n * 2, 3 * size, 1.1 + n * 0.12, n & 1 ? 2 : 0)
      }
      fx.debris(x, y, z + 2, 0, 0, Math.round(6 * size), 60)
    },

    update(dt, world) {
      time += dt
      const drag = Math.exp(-dt * 2.2)
      for (let o = 0; o < puffs.length; o += PUFF_F) {
        if (time - puffs[o + 6] >= puffs[o + 7]) continue
        puffs[o] += puffs[o + 3] * dt
        puffs[o + 1] += puffs[o + 4] * dt
        puffs[o + 2] += puffs[o + 5] * dt
        puffs[o + 3] *= drag
        puffs[o + 4] *= drag
        puffs[o + 5] *= drag
      }
      for (let o = 0; o < bits.length; o += BIT_F) {
        if (time - bits[o + 6] >= BIT_LIFE) continue
        bits[o + 5] -= 120 * dt
        bits[o] += bits[o + 3] * dt
        bits[o + 1] += bits[o + 4] * dt
        bits[o + 2] += bits[o + 5] * dt
        if (bits[o + 2] <= groundAt(world, bits[o], bits[o + 1])) bits[o + 6] = -1e9
      }
    },

    /** Smoke and sparks: drawn before the planes, which fly out of it. */
    drawSmoke(to, cam) {
      const W = to.width
      const H = to.height
      const color = to.color
      const zbuf = to.depth
      for (let o = 0; o < puffs.length; o += PUFF_F) {
        const age = (time - puffs[o + 6]) / puffs[o + 7]
        if (age >= 1 || age < 0 || !project(cam, puffs[o], puffs[o + 1], puffs[o + 2]) || eyeDistance(cam) < 12) continue
        const kind = puffs[o + 9]
        const tones = TONES[kind]
        const radius = Math.min(26, puffs[o + 8] * (kind === 5 ? 1 : 0.7 + 1.1 * age) * cam.scale)
        const ink = (1 - age) * (kind === 1 ? 12 : 15) // an old puff is drawn with fewer pixels: it thins, it does not blend
        const tone = age < 0.3 ? 0 : age < 0.65 ? 1 : 2
        const cx = Math.round(cam.sx)
        const cy = Math.round(cam.sy)
        const near = cam.depth - 2
        const reach = Math.ceil(radius)
        for (let y = Math.max(0, cy - reach); y <= Math.min(H - 1, cy + reach); y++) {
          for (let x = Math.max(0, cx - reach); x <= Math.min(W - 1, cx + reach); x++) {
            const dx = x - cx
            const dy = y - cy
            if (dx * dx + dy * dy > radius * radius + 0.3) continue
            const at = y * W + x
            if (zbuf[at] < near || ink <= BAYER4[((y & 3) << 2) | (x & 3)]) continue
            // the underside of a puff is a tone darker, so it reads as round
            color[at] = tones[dy > radius * 0.35 && tone < 2 ? tone + 1 : tone]
          }
        }
      }
    },

    /** Blasts and flying pieces. */
    drawBlasts(to, cam) {
      const W = to.width
      const H = to.height
      const color = to.color
      const zbuf = to.depth
      for (let o = 0; o < blasts.length; o += BLAST_F) {
        const size = blasts[o + 4]
        const age = (time - blasts[o + 3]) / (0.5 * size + 0.1)
        if (age >= 1 || age < 0 || !project(cam, blasts[o], blasts[o + 1], blasts[o + 2]) || eyeDistance(cam) < 6) continue
        const tones = blasts[o + 5] === 1 ? SPLASH : FIRE
        const radius = Math.min(48, size * (4 + 15 * (1 - (1 - age) * (1 - age))) * cam.scale)
        const ink = (1 - age * age) * 18
        const cx = Math.round(cam.sx)
        const cy = Math.round(cam.sy)
        const near = cam.depth - 8
        const reach = Math.ceil(radius)
        for (let y = Math.max(0, cy - reach); y <= Math.min(H - 1, cy + reach); y++) {
          for (let x = Math.max(0, cx - reach); x <= Math.min(W - 1, cx + reach); x++) {
            const far = Math.hypot(x - cx, y - cy) / radius
            if (far > 1) continue
            const at = y * W + x
            const grain = BAYER4[((y & 3) << 2) | (x & 3)]
            if (zbuf[at] < near || ink <= grain) continue
            // white at the heart, cooling outwards and as it ages, and hollow at the end
            const heat = far * 2.4 + age * 3.4 + grain * 0.04
            if (heat < 5) color[at] = tones[heat | 0]
          }
        }
      }
      for (let o = 0; o < bits.length; o += BIT_F) {
        const age = (time - bits[o + 6]) / BIT_LIFE
        if (age >= 1 || age < 0 || !project(cam, bits[o], bits[o + 1], bits[o + 2]) || eyeDistance(cam) < 8) continue
        const size = cam.scale > 1.6 ? 2 : 1
        const x0 = Math.round(cam.sx)
        const y0 = Math.round(cam.sy)
        const near = cam.depth - 2
        // a piece tumbles: it shows its light side and its dark side in turn
        const kind = bits[o + 7]
        const tone = kind === 2 ? BIT_TONES[2] : BIT_TONES[((time * 12 + o) | 0) & 1]
        for (let y = y0; y < y0 + size; y++) {
          for (let x = x0; x < x0 + size; x++) {
            if (x < 0 || y < 0 || x >= W || y >= H) continue
            const at = y * W + x
            if (zbuf[at] >= near && (age < 0.7 || (1 - age) * 50 > BAYER4[((y & 3) << 2) | (x & 3)])) color[at] = tone
          }
        }
      }
    },
  }
  fx.clear()
  return fx
}

// What is written over the picture: the level's name, the marked place to go down at, and
// in the city the hull, the score and where the enemies are.

import { rgb, BAYER4 } from './framebuffer.js'
import { project } from './camera.js'
import { groundAt } from './world.js'
import { box, dot, text, number, textWidth } from './paint.js'
import { FIGHT } from './dogfight.js'

const INK = rgb(255, 244, 196)
const PLATE = rgb(24, 28, 48)
const BEAM = rgb(255, 222, 96)
const BEAM_HOT = rgb(255, 250, 220)
const HULL_INK = rgb(120, 236, 140)
const HULL_GONE = rgb(96, 44, 60)
const HURT = rgb(255, 92, 110)
const FOE = rgb(255, 92, 110)

/** A word on a dark plate, so it reads over any ground. */
function label(to, x, y, word, col) {
  box(to, x - 2, y - 2, textWidth(word.length) + 4, 9, PLATE)
  text(to, x, y, word, col)
}

export function drawHud(fb, cam, world, hud) {
  label(fb, 4, 4, hud.name, INK)
  if (hud.door) drawDoor(fb, cam, world, hud)
  if (hud.level === 2 && hud.fight.round > 0) drawFight(fb, cam, hud)
}

function drawDoor(fb, cam, world, hud) {
  // The marked place: a beam of light standing on the ground, with its name on top.
  const door = hud.door
  const base = groundAt(world, hud.doorX, hud.doorY)
  const wide = textWidth(door.label.length)
  let shown = false
  if (project(cam, hud.doorX, hud.doorY, base + 70)) {
    const topX = Math.round(cam.sx)
    const topY = Math.round(cam.sy)
    if (topX > wide && topX < fb.width - wide && topY > 14 && topY < fb.height - 4 && project(cam, hud.doorX, hud.doorY, base)) {
      const footY = Math.round(cam.sy)
      const pulse = (hud.time * 24) | 0
      for (let y = topY; y <= footY; y++) {
        // the beam climbs: brighter bands run up it
        const hot = ((y + pulse) & 7) < 2
        for (let x = topX - 1; x <= topX + 1; x++) {
          if (x === topX || BAYER4[((y & 3) << 2) | (x & 3)] < 8) dot(fb, x, y, hot ? BEAM_HOT : BEAM)
        }
      }
      label(fb, topX - (wide >> 1), topY - 9, door.label, BEAM)
      shown = true
    }
  }
  if (!shown) {
    // off the picture: its name at the edge, in the direction to fly
    const dx = hud.doorX - cam.x
    const dy = hud.doorY - cam.y
    const across = dx * cam.cos + dy * cam.sin
    const depth = dx * cam.sin - dy * cam.cos
    const far = Math.hypot(across, depth) || 1
    const rx = fb.width / 2 - wide / 2 - 8
    const ry = fb.height / 2 - 16
    const reach = Math.min(rx / (Math.abs(across / far) || 1e-6), ry / (Math.abs(depth / far) || 1e-6))
    const x = Math.round(fb.width / 2 + (across / far) * reach)
    const y = Math.round(fb.height / 2 - (depth / far) * reach)
    label(fb, x - (wide >> 1), y - 2, door.label, BEAM)
    // a small arrowhead on the side the place is on
    const ax = x + Math.round((across / far) * (wide / 2 + 5))
    const ay = y + Math.round((-depth / far) * 8)
    box(fb, ax - 1, ay - 1, 3, 3, BEAM_HOT)
  }
  if (hud.over && ((hud.time * 2) | 0) % 2 === 0) {
    const word = 'PRESS DOWN'
    label(fb, (fb.width - textWidth(word.length)) >> 1, 4, word, BEAM_HOT)
  }
}

/** The hull bar, the score, where the enemies are, and how the fight ended. */
function drawFight(fb, cam, hud) {
  const fight = hud.fight
  // hull: one pip for each hit the ship can still take
  box(fb, 2, 13, FIGHT.hull * 5 + 3, 7, fight.hurt < 0.25 ? HURT : PLATE)
  for (let n = 0; n < FIGHT.hull; n++) box(fb, 4 + n * 5, 15, 4, 3, n < fight.hull ? HULL_INK : HULL_GONE)
  label(fb, 4, 24, 'SCORE', INK)
  box(fb, 26, 22, 15, 9, PLATE)
  number(fb, 28, 24, fight.score, 3, BEAM_HOT)

  // a mark at the edge of the picture for every enemy that is off it
  for (const pilot of fight.pilots) {
    if (pilot.hull <= 0) continue
    if (project(cam, pilot.x, pilot.y, pilot.z) && cam.sx > 2 && cam.sy > 2 && cam.sx < fb.width - 2 && cam.sy < fb.height - 2) continue
    const dx = pilot.x - cam.x
    const dy = pilot.y - cam.y
    const across = dx * cam.cos + dy * cam.sin
    const depth = dx * cam.sin - dy * cam.cos
    const far = Math.hypot(across, depth) || 1
    const reach = Math.min((fb.width / 2 - 4) / (Math.abs(across / far) || 1e-6), (fb.height / 2 - 4) / (Math.abs(depth / far) || 1e-6))
    const x = Math.round(fb.width / 2 + (across / far) * reach)
    const y = Math.round(fb.height / 2 - (depth / far) * reach)
    box(fb, x - 2, y - 2, 5, 5, PLATE)
    box(fb, x - 1, y - 1, 3, 3, FOE)
  }

  if (fight.outcome !== 'playing') {
    const word = fight.outcome === 'won' ? 'YOU WIN' : 'SHOT DOWN'
    const size = fb.width >= 200 ? 2 : 1
    const wide = textWidth(word.length, size)
    const x = (fb.width - wide) >> 1
    const y = Math.round(fb.height * 0.3)
    box(fb, x - 3, y - 3, wide + 6, 5 * size + 6, PLATE)
    text(fb, x, y, word, fight.outcome === 'won' ? HULL_INK : FOE, size)
    const more = 'UP TO LEAVE'
    if (fb.width >= 120) label(fb, (fb.width - textWidth(more.length)) >> 1, y + 5 * size + 8, more, INK)
  }
}

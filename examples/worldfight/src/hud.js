// What is written over the picture: the level's name, the marked place to go down at, and
// over the city everything a dogfight needs: the hull, the score, the wave, the missiles on
// the rails, a gunsight, a box round the enemy that is being locked on to, a warning when a
// missile is on its way, and how the fight ended.

import { rgb, BAYER4 } from './framebuffer.js'
import { project } from './camera.js'
import { groundAt } from './world.js'
import { box, dot, line, text, number, textWidth } from './paint.js'
import { FIGHT } from './dogfight.js'

const INK = rgb(255, 244, 196)
const PLATE = rgb(24, 28, 48)
const BEAM = rgb(255, 222, 96)
const BEAM_HOT = rgb(255, 250, 220)
const HULL_INK = rgb(120, 236, 140)
const HULL_GONE = rgb(96, 44, 60)
const HURT = rgb(255, 92, 110)
const FOE = rgb(255, 92, 110)
const LOCKING = rgb(255, 188, 66)
const LOCKED = rgb(255, 64, 72)
const RAIL = rgb(255, 188, 66)
const RAIL_EMPTY = rgb(74, 62, 50)
/** the gunsight, in every view */
export const SIGHT = rgb(130, 255, 160)
/** an enemy on the cockpit's radar */
export const RADAR_FOE = rgb(255, 86, 96)

// what the game can say in the middle of the picture; the game picks one by number
const NOTES = ['', 'FIGHTER MODE', 'ROCKET MODE', 'WAVE', 'WAVE CLEAR', 'MISSILE DODGED', 'ENEMY DOWN', 'TURN BACK']
const NOTE_SECONDS = 1.5

/**
 * project(), and then the turn the picture was given: in the cockpit the world is drawn
 * banked, so a mark has to be turned the same way to land on the thing it marks.
 */
function place(cam, hud, x, y, z) {
  if (!project(cam, x, y, z)) return false
  if (hud.roll !== 0) {
    const dx = cam.sx - cam.cx
    const dy = cam.sy - cam.cy
    const cos = Math.cos(hud.roll)
    const sin = Math.sin(hud.roll)
    cam.sx = cam.cx + dx * cos + dy * sin
    cam.sy = cam.cy + dy * cos - dx * sin
  }
  return true
}

/** A word on a dark plate, so it reads over any ground. */
function label(to, x, y, word, col, size = 1) {
  box(to, x - 2 * size, y - 2 * size, textWidth(word.length, size) + 4 * size, 9 * size, PLATE)
  text(to, x, y, word, col, size)
}

/** A word on a plate, centred on `x`. */
function banner(to, x, y, word, col, size = 1) {
  label(to, x - (textWidth(word.length, size) >> 1), y, word, col, size)
}

/**
 * What lies over the world but under the cockpit: the dark bars of slow motion and the red
 * edges of a hit. Drawn before the cockpit, so the instruments are never covered.
 */
export function drawUnder(fb, cam, world, hud) {
  const W = fb.width
  const H = fb.height
  const fight = hud.fight
  if (hud.slow > 0.02) {
    // while time is slowed, two dark bars close in from the top and the bottom
    const tall = Math.round(hud.slow * fb.height * 0.07)
    for (let y = 0; y < tall; y++) {
      for (let x = 0; x < fb.width; x++) {
        if (BAYER4[((y & 3) << 2) | (x & 3)] < 13) {
          fb.color[y * fb.width + x] = PLATE
          fb.color[(fb.height - 1 - y) * fb.width + x] = PLATE
        }
      }
    }
  }
  // the beam over the marked place stands in the world, so the dashboard hides its foot
  if (hud.door) drawDoor(fb, cam, world, hud)
  if (!hud.city) return
  // hit: the edges of the picture go red for a moment
  if (fight.hurt < 0.35) {
    const ink = (1 - fight.hurt / 0.35) * 13
    const deep = Math.max(2, Math.round(Math.min(W, H) * 0.04))
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const edge = Math.min(x, y, W - 1 - x, H - 1 - y)
        if (edge >= deep) {
          if (y >= deep && y < H - deep) x = W - deep - 1 // skip the middle of the row
          continue
        }
        if (ink * (1 - edge / deep) > BAYER4[((y & 3) << 2) | (x & 3)]) fb.color[y * W + x] = HURT
      }
    }
  }
}

export function drawHud(fb, cam, world, hud) {
  label(fb, 4, 4, hud.name, INK)
  if (hud.door && hud.over && ((hud.time * 2) | 0) % 2 === 0) banner(fb, fb.width >> 1, 4, 'PRESS DOWN', BEAM_HOT)
  if (hud.city) drawFight(fb, cam, hud)
  if (hud.noteId > 0 && hud.noteAge < NOTE_SECONDS && fb.width >= 90) {
    // it blinks in, holds, and thins out
    const word = NOTES[hud.noteId]
    const size = fb.width >= 240 ? 2 : 1
    // low in the picture, clear of the fight; from the cockpit, on the glass above the dashboard
    const y = hud.seat >= 0.5 ? Math.round(fb.height * 0.2) : fb.height - 6 * size - 8
    if (hud.noteAge > 0.12 || ((hud.noteAge * 40) & 1) === 0) {
      if (hud.noteId === 3) {
        const wide = textWidth(word.length + 2, size)
        label(fb, (fb.width - wide) >> 1, y, word, BEAM_HOT, size)
        box(fb, ((fb.width - wide) >> 1) + textWidth(word.length, size), y - 2 * size, textWidth(2, size) + 2 * size, 9 * size, PLATE)
        number(fb, ((fb.width - wide) >> 1) + textWidth(word.length + 1, size) + size, y, hud.noteN, 1, BEAM_HOT, size)
      } else banner(fb, fb.width >> 1, y, word, hud.noteId === 5 || hud.noteId === 6 ? HULL_INK : BEAM_HOT, size)
    }
  }
}

function drawDoor(fb, cam, world, hud) {
  // The marked place: a beam of light standing on the ground, with its name on top.
  const door = hud.door
  const base = groundAt(world, hud.doorX, hud.doorY)
  const wide = textWidth(door.label.length)
  let shown = false
  if (place(cam, hud, hud.doorX, hud.doorY, base + 70)) {
    const topX = Math.round(cam.sx)
    const topY = Math.round(cam.sy)
    if (topX > wide && topX < fb.width - wide && topY > 14 && topY < fb.height - 4 && place(cam, hud, hud.doorX, hud.doorY, base)) {
      const footX = Math.round(cam.sx)
      const footY = Math.round(cam.sy)
      const pulse = (hud.time * 24) | 0
      const steps = Math.max(1, Math.abs(footY - topY), Math.abs(footX - topX))
      for (let n = 0; n <= steps; n++) {
        // the beam climbs: brighter bands run up it
        const cx = Math.round(topX + ((footX - topX) * n) / steps)
        const y = Math.round(topY + ((footY - topY) * n) / steps)
        const hot = ((n + pulse) & 7) < 2
        for (let x = cx - 1; x <= cx + 1; x++) {
          if (x === cx || BAYER4[((y & 3) << 2) | (x & 3)] < 8) dot(fb, x, y, hot ? BEAM_HOT : BEAM)
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
    // from the cockpit the label stays on the glass, clear of the dashboard
    const y = Math.min(Math.round(fb.height / 2 - (depth / far) * reach), hud.seat >= 0.5 ? Math.round(fb.height * 0.5) : fb.height)
    label(fb, x - (wide >> 1), y - 2, door.label, BEAM)
    // a small arrowhead on the side the place is on
    const ax = x + Math.round((across / far) * (wide / 2 + 5))
    const ay = y + Math.round((-depth / far) * 8)
    box(fb, ax - 1, ay - 1, 3, 3, BEAM_HOT)
  }
}

/** Four corners of a box round a point. */
function corners(fb, x, y, half, col) {
  const arm = Math.max(2, half >> 1)
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sy = -1; sy <= 1; sy += 2) {
      box(fb, sx < 0 ? x - half : x + half - arm + 1, y + sy * half, arm, 1, col)
      box(fb, x + sx * half, sy < 0 ? y - half : y + half - arm + 1, 1, arm, col)
    }
  }
}

function drawFight(fb, cam, hud) {
  const fight = hud.fight
  const W = fb.width
  const H = fb.height
  const playing = fight.outcome === 'playing'
  const blink = ((hud.time * 8) & 1) === 0

  // hull: one pip for each hit the plane can still take
  const low = fight.hull <= 2 && playing && blink
  box(fb, 2, 13, FIGHT.hull * 5 + 3, 7, fight.hurt < 0.25 || low ? HURT : PLATE)
  for (let n = 0; n < FIGHT.hull; n++) box(fb, 4 + n * 5, 15, 4, 3, n < fight.hull ? HULL_INK : HULL_GONE)
  label(fb, 4, 24, 'SCORE', INK)
  box(fb, 26, 22, 23, 9, PLATE)
  number(fb, 28, 24, fight.score, 5, BEAM_HOT)
  // the wave, and the missiles on the rails
  label(fb, 4, 34, 'WAVE', INK)
  box(fb, 22, 32, 7 + FIGHT.rails * 4 + 2, 9, PLATE)
  number(fb, 24, 34, fight.wave + 1, 1, BEAM_HOT)
  for (let n = 0; n < FIGHT.rails; n++) box(fb, 30 + n * 4, 34, 3, 5, n < fight.rails ? RAIL : RAIL_EMPTY)

  if (playing) {
    // the gunsight: a small cross where the guns point. In the cockpit it is a ring on the glass.
    if (hud.sightOn && hud.seat < 0.5 && place(cam, hud, hud.sightX, hud.sightY, hud.sightZ)) {
      const x = Math.round(cam.sx)
      const y = Math.round(cam.sy)
      line(fb, x - 4, y, x - 2, y, SIGHT)
      line(fb, x + 2, y, x + 4, y, SIGHT)
      line(fb, x, y - 4, x, y - 2, SIGHT)
      line(fb, x, y + 2, x, y + 4, SIGHT)
    }

    // a box that closes on the enemy in the sights, and turns red when the missile has it
    if (fight.lockOn >= 0) {
      const pilot = fight.pilots[fight.lockOn]
      if (place(cam, hud, pilot.x, pilot.y, pilot.z)) {
        const x = Math.round(cam.sx)
        const y = Math.round(cam.sy)
        const closing = 1 - Math.min(1, fight.lockFor / FIGHT.lockSeconds)
        const half = Math.round(Math.max(5, 9 * cam.scale) + closing * 9)
        corners(fb, x, y, half, fight.locked ? LOCKED : LOCKING)
        if (fight.locked && blink && W >= 120) text(fb, x - 7, y + half + 3, 'LOCK', LOCKED)
      }
    }

    // a mark at the edge of the picture for every enemy that is off it; the cockpit has its radar
    for (const pilot of fight.pilots) {
      if (pilot.state !== 1 || hud.seat >= 0.5) continue
      if (project(cam, pilot.x, pilot.y, pilot.z) && cam.sx > 2 && cam.sy > 2 && cam.sx < W - 2 && cam.sy < H - 2) continue
      const dx = pilot.x - cam.x
      const dy = pilot.y - cam.y
      const across = dx * cam.cos + dy * cam.sin
      const depth = dx * cam.sin - dy * cam.cos
      const far = Math.hypot(across, depth) || 1
      const reach = Math.min((W / 2 - 4) / (Math.abs(across / far) || 1e-6), (H / 2 - 4) / (Math.abs(depth / far) || 1e-6))
      const x = Math.round(W / 2 + (across / far) * reach)
      const y = Math.round(H / 2 - (depth / far) * reach)
      box(fb, x - 2, y - 2, 5, 5, PLATE)
      box(fb, x - 1, y - 1, 3, 3, pilot.attacking && blink ? BEAM_HOT : FOE)
    }

    // a missile is on its way: where from, and when to roll
    const callY = Math.round(H * (hud.seat >= 0.5 ? 0.42 : 0.8)) // clear of the plane, and of the dashboard
    if (fight.threatIn < 90) {
      const ring = Math.min(W, H) * 0.3
      const x = Math.round(W / 2 + Math.sin(hud.threatAngle) * ring)
      const y = Math.round(H / 2 - Math.cos(hud.threatAngle) * ring)
      const quick = ((hud.time * (fight.threatIn < 1 ? 16 : 8)) & 1) === 0
      box(fb, x - 3, y - 3, 7, 7, PLATE)
      box(fb, x - 2, y - 2, 5, 5, quick ? LOCKED : BEAM_HOT)
      if (W >= 120) {
        if (fight.threatIn < 0.55) banner(fb, W >> 1, callY, 'ROLL!', quick ? BEAM_HOT : LOCKED, W >= 240 ? 2 : 1)
        else if (quick) banner(fb, W >> 1, callY, 'MISSILE', LOCKED)
      }
    } else if (fight.counterFor > 0 && blink && W >= 120) {
      banner(fb, W >> 1, callY, 'COUNTER!', BEAM_HOT, W >= 240 ? 2 : 1)
    }
  } else {
    const won = fight.outcome === 'won'
    const word = won ? 'YOU WIN' : 'SHOT DOWN'
    const size = W >= 200 ? 2 : 1
    let y = Math.round(H * 0.3)
    banner(fb, W >> 1, y, word, won ? HULL_INK : FOE, size)
    y += 5 * size + 7
    if (W >= 120) {
      // the score, and the best so far
      const wide = textWidth(17)
      const x = (W - wide) >> 1
      box(fb, x - 2, y - 2, wide + 4, 9, PLATE)
      text(fb, x, y, 'PTS', INK)
      number(fb, x + 16, y, fight.score, 5, BEAM_HOT)
      text(fb, x + 40, y, 'TOP', INK)
      number(fb, x + 56, y, fight.best, 5, BEAM_HOT)
      y += 12
      if (hud.canRestart) {
        if (((hud.time * 2) | 0) % 2 === 0) banner(fb, W >> 1, y, 'CLICK TO FLY AGAIN', BEAM_HOT)
      }
      banner(fb, W >> 1, y + 11, 'UP TO LEAVE', INK)
    }
  }
}

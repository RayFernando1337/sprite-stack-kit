// The cockpit: the inside of the craft, laid over the world when the camera sits in the
// pilot's seat.
//
// It is drawn in two parts. The fixed parts (the canopy frame and the dashboard) are painted
// once for each frame size into two layers, where a pixel of 0 is see-through. Each frame
// the layers are copied over the world, and then the live parts are drawn from the craft's
// numbers: the head-up display on the glass, the map, the attitude ball, the compass tape,
// the needles and the lamps. Over the city the map is a radar that shows the enemies and
// their missiles, the numbers screen shows the hull, the score and the missiles left, and a
// gunsight ring sits on the glass. Nothing is loaded from an image file.

import { rgb, mix, BAYER4 } from './framebuffer.js'
import { WORLD_MASK, WORLD_SHIFT, WORLD_SIZE, MAT } from './world.js'
import { dot, box, line, disc, text, number } from './paint.js'
import { SIGHT, RADAR_FOE } from './hud.js'

const MARGIN = 4 // spare pixels round each layer, so it can sway without showing an edge
const MAP_REACH = 5 // world px per pixel of the map screen, when the screen is 72 px wide …
const RADAR_REACH = 10 // … and over the city, where it has to show a whole dogfight

const BLACK = rgb(0, 0, 0)
const WHITE = rgb(244, 248, 255)
// the canopy frame and the dashboard: one family of slate blues, dark → light
const DARK = rgb(17, 21, 33)
const LOW = rgb(40, 48, 68)
const MID = rgb(66, 78, 104)
const LIGHT = rgb(122, 138, 168)
const HOOD = rgb(36, 42, 58)
const HOOD_LOW = rgb(25, 29, 42)
const FACE = rgb(54, 62, 82)
const FACE_LOW = rgb(43, 50, 68)
const WELL = rgb(9, 13, 20) // behind every instrument
const MARK = rgb(150, 164, 190) // painted ticks
const AMBER = rgb(255, 188, 66)
const HUD = rgb(255, 170, 44)
// the two screens: one phosphor colour in seven strengths, and the same again for scan lines
const SCREEN = [rgb(5, 26, 34), rgb(8, 46, 58), rgb(14, 74, 84), rgb(26, 112, 108), rgb(56, 156, 130), rgb(118, 204, 160), rgb(210, 248, 220)]
const SCREEN_DIM = SCREEN.map((tone) => mix(tone, BLACK, 60))
// how bright each kind of ground is on the map: deep water darkest, the shoreline and the peaks brightest
const MAP_TONE = new Uint8Array(32)
MAP_TONE[MAT.DEEP] = 0
MAP_TONE[MAT.SEA] = 1
MAP_TONE[MAT.SHALLOW] = 2
MAP_TONE[MAT.SURF] = 2
MAP_TONE[MAT.SAND] = 5
MAP_TONE[MAT.GRASS] = 3
MAP_TONE[MAT.GRASS_DARK] = 3
MAP_TONE[MAT.GRASS_LIGHT] = 4
MAP_TONE[MAT.TREE] = 3
MAP_TONE[MAT.CROWN] = 4
MAP_TONE[MAT.ROCK] = 5
MAP_TONE[MAT.ROCK_DARK] = 4
MAP_TONE[MAT.SNOW] = 6
MAP_TONE[MAT.DUNE] = 5
MAP_TONE[MAT.DUNE_DARK] = 4
MAP_TONE[MAT.STEPPE] = 4
MAP_TONE[MAT.BORDER] = 6
MAP_TONE[MAT.STREET] = 2
MAP_TONE[MAT.BLOCK] = 4
MAP_TONE[MAT.BLOCK_WARM] = 4
MAP_TONE[MAT.BLOCK_COOL] = 4
MAP_TONE[MAT.TOWER] = 6
MAP_TONE[MAT.TOWER_DARK] = 5
MAP_TONE[MAT.STEEL] = 6
MAP_TONE[MAT.FOG] = 1
const BALL_SKY = rgb(86, 160, 230)
const BALL_SKY_LOW = rgb(150, 206, 246)
const BALL_GROUND = rgb(138, 88, 54)
const BALL_GROUND_HIGH = rgb(178, 126, 78)
const HULL_LOW = rgb(255, 96, 84)
// [lit, unlit] for each lamp: thrusters open, close to the ground (or a missile on its way), rolling, nobody steering
const LAMPS = [
  [rgb(255, 176, 56), rgb(74, 52, 26)],
  [rgb(255, 78, 64), rgb(78, 28, 30)],
  [rgb(96, 214, 255), rgb(24, 56, 74)],
  [rgb(110, 236, 120), rgb(26, 66, 36)],
]
const CARDINALS = ['N', 'E', 'S', 'W']

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
/** `a` or `b`, picked by a dither pattern so that a share `t` of the pixels get `b`. */
const dither = (a, b, t, x, y) => (t * 16 > BAYER4[((y & 3) << 2) | (x & 3)] ? b : a)

/**
 * Where everything goes for a frame size. The dashboard was laid out 86 pixels tall, and
 * every other size is that layout scaled. Positions are measured from the corner of the
 * dashboard layer, which is MARGIN wider than the frame on each side.
 */
function plan(width, height) {
  // the dashboard's height at the sides; never more than half of a very short frame
  const dash = Math.round(clamp(Math.min(height * 0.36, width * 0.24), Math.min(24, height * 0.45), 150))
  const unit = dash / 86
  const px = (n) => Math.max(1, Math.round(n * unit))
  const hood = px(10) // how much higher the dashboard is over the instruments in the middle
  const lip = Math.max(3, px(8)) // the thickness of its top edge
  const mid = MARGIN + (width >> 1)
  const letters = unit >= 1.4 ? 2 : 1
  const bezel = Math.max(2, px(3))
  const tape = { x: 0, y: lip + 2, w: px(70) | 1, h: 5 * letters + 4 }
  tape.x = mid - (tape.w >> 1)
  // the ball takes the room between the tape and a clear strip along the bottom
  const room = hood + dash - px(13) - (tape.y + tape.h + 2)
  const radius = Math.max(4, Math.min(px(29), (room >> 1) - bezel))
  const ball = { x: mid, y: tape.y + tape.h + 2 + bezel + radius, r: radius, bezel }
  const dialR = Math.max(3, px(11))
  const dialGap = radius + bezel + px(8) + dialR
  const dialY = ball.y - px(9)
  const screenW = px(72)
  const screenH = px(52)
  const screenGap = dialGap + dialR + px(9)
  const screenY = hood + lip + px(7)
  return {
    width,
    height,
    dash,
    hood,
    lip,
    px,
    letters,
    top: height - dash - hood, // the frame row of the dashboard layer's first row
    tape,
    ball,
    dials: [{ x: mid - dialGap, y: dialY, r: dialR }, { x: mid + dialGap, y: dialY, r: dialR }],
    map: { x: mid - screenGap - screenW, y: screenY, w: screenW, h: screenH },
    data: { x: mid + screenGap, y: screenY, w: screenW, h: screenH },
    lamp: { w: Math.max(3, px(6)), h: Math.max(2, px(3)), y: dialY + dialR + px(6) },
  }
}

const lampX = (p, n) => p.dials[n >> 1].x + (n & 1 ? 1 : -p.lamp.w - 1)

// ── the fixed parts, painted once per frame size

/** A rectangular recess with a raised rim: light on the rim's top and left, dark below and right. */
function well(layer, x, y, w, h) {
  box(layer, x - 3, y - 3, w + 6, h + 6, MID)
  box(layer, x - 3, y - 3, w + 6, 1, LIGHT)
  box(layer, x - 3, y - 3, 1, h + 6, LIGHT)
  box(layer, x - 3, y + h + 2, w + 6, 1, DARK)
  box(layer, x + w + 2, y - 3, 1, h + 6, DARK)
  box(layer, x - 1, y - 1, w + 2, h + 2, DARK)
  box(layer, x, y, w, h, WELL)
}

function roundWell(layer, x, y, radius, rim) {
  const turn = radius * 0.45
  disc(layer, x, y, radius + rim + 0.4, (dx, dy) => (dx + dy < -turn ? LIGHT : dx + dy > turn ? DARK : MID))
  disc(layer, x, y, radius + 1.4, DARK)
  disc(layer, x, y, radius + 0.4, WELL)
}

function paintDash(p) {
  const width = p.width + MARGIN * 2
  const height = p.hood + p.dash + MARGIN
  const layer = { width, height, color: new Uint32Array(width * height) }
  const half = p.width / 2
  for (let x = 0; x < width; x++) {
    // The top edge: raised over the instruments in the middle, level at the sides, with a
    // smooth shoulder between the two.
    const t = Math.abs(x - MARGIN - half) / half
    const raised = t < 0.36 ? 1 : t > 0.54 ? 0 : 0.5 + 0.5 * Math.cos(((t - 0.36) / 0.18) * Math.PI)
    const top = Math.round(p.hood * (1 - raised))
    for (let y = top; y < height; y++) {
      const depth = y - top
      let col
      if (depth === 0) col = LIGHT // the edge catches the light
      else if (depth < p.lip) col = dither(HOOD, HOOD_LOW, depth / p.lip, x, y)
      else if (depth === p.lip) col = DARK
      else col = dither(FACE, FACE_LOW, (y - p.lip) / height, x, y)
      layer.color[y * width + x] = col
    }
  }

  well(layer, p.map.x, p.map.y, p.map.w, p.map.h)
  well(layer, p.data.x, p.data.y, p.data.w, p.data.h)
  well(layer, p.tape.x, p.tape.y, p.tape.w, p.tape.h)
  roundWell(layer, p.ball.x, p.ball.y, p.ball.r, p.ball.bezel)
  for (const dial of p.dials) {
    roundWell(layer, dial.x, dial.y, dial.r, 1)
    // five ticks: straight up is zero, two each side
    for (let mark = -2; mark <= 2; mark++) {
      const angle = mark * 1.05
      dot(layer, Math.round(dial.x + Math.sin(angle) * (dial.r - 1)), Math.round(dial.y - Math.cos(angle) * (dial.r - 1)), mark === 0 ? WHITE : MARK)
    }
  }
  for (let n = 0; n < LAMPS.length; n++) box(layer, lampX(p, n) - 1, p.lamp.y - 1, p.lamp.w + 2, p.lamp.h + 2, DARK)

  // air vents fill the space outside the screens, where the frame is wide enough to have any
  const slats = p.map.x - 4 - p.px(9) - (MARGIN + p.px(7))
  if (slats >= 6) {
    for (let row = 0; row < 4; row++) {
      const y = p.map.y + p.px(4) + row * p.px(6)
      for (const x of [MARGIN + p.px(7), width - MARGIN - p.px(7) - slats]) {
        box(layer, x, y, slats, Math.max(1, p.px(2)), DARK)
        box(layer, x, y + Math.max(1, p.px(2)), slats, 1, MID)
      }
    }
  }
  // a rail along the bottom
  box(layer, 0, p.hood + p.dash - p.px(7), width, 1, DARK)
  box(layer, 0, p.hood + p.dash - p.px(7) + 1, width, 1, MID)
  return layer
}

/**
 * The canopy frame: an arch with square shoulders (a superellipse), a few pixels thick. Glass
 * is inside it and open sky outside it, so both are left see-through.
 */
function paintBow(p) {
  const width = p.width + MARGIN * 2
  const glass = Math.max(1, p.height - p.dash)
  const thick = Math.max(3, Math.round(Math.min(p.width, p.height) * 0.034))
  const power = 3.5 // 2 would be an ellipse; more squares the shoulders
  const a = p.width * 0.53 // half the arch's width: just outside the frame, so its feet are never seen
  const b = Math.max(1, glass - thick - 1.5)
  const layer = { width, height: glass, color: new Uint32Array(width * glass) }
  let used = 0
  for (let y = 0; y < glass; y++) {
    for (let x = 0; x < width; x++) {
      const nx = Math.abs(x - MARGIN - p.width / 2) / a
      const ny = (glass - y) / b
      const r = Math.pow(Math.pow(nx, power) + Math.pow(ny, power), 1 / power) // 1 on the arch, more outside it
      if (r < 1) continue
      // how far outside the arch this pixel is, in pixels: the excess over how fast r grows here
      const grow = Math.pow(r, 1 - power) * Math.hypot(Math.pow(nx, power - 1) / a, Math.pow(ny, power - 1) / b)
      const out = (r - 1) / grow
      const wide = thick * (1 + 0.5 * nx * nx) // thicker towards the sides, which are nearer the eye
      if (out >= wide) continue
      layer.color[y * width + x] = out < 1 || out >= wide - 1 ? DARK : out >= wide - 2.2 ? LIGHT : out < wide * 0.4 ? LOW : MID
      used = y + 1
    }
  }
  // bolts along the top, where the frame runs nearly level
  const spacing = Math.max(12, Math.round(p.width / 13))
  for (let x = MARGIN + (p.width >> 1) % spacing; x < width; x += spacing) {
    let y = 0
    while (y < glass && layer.color[y * width + x] === 0) y++
    if (y > glass * 0.12) continue
    y += thick >> 1
    box(layer, x, y, 2, 1, DARK)
    box(layer, x, y - 1, 2, 1, LIGHT)
  }
  layer.height = used
  return layer
}

/** Copies a layer over the frame with its corner at (left, top), skipping see-through pixels. */
function stamp(fb, layer, left, top) {
  const x0 = Math.max(0, left)
  const x1 = Math.min(fb.width, left + layer.width)
  const y0 = Math.max(0, top)
  const y1 = Math.min(fb.height, top + layer.height)
  for (let y = y0; y < y1; y++) {
    let from = (y - top) * layer.width + (x0 - left)
    let to = y * fb.width + x0
    for (let x = x0; x < x1; x++, from++, to++) {
      const col = layer.color[from]
      if (col !== 0) fb.color[to] = col
    }
  }
}

// ── the live parts, drawn every frame

/**
 * The head-up display: marks that seem to float on the glass. The horizon line and its rungs
 * are level with the world, so they tilt against the bank and slide with the pitch; the nose
 * marker and the numbers stay put.
 */
function drawHud(fb, cam, g, p) {
  const cx = cam.cx
  const cy = cam.cy
  const cos = Math.cos(g.roll)
  const sin = Math.sin(g.roll)
  const lens = cam.zoom / cam.persp // screen pixels per unit of slope
  const reach = Math.min(p.width, p.height * 1.2) * 0.3
  for (let rung = -3; rung <= 3; rung++) {
    // rung 0 is the horizon; the others are ten degrees apart above and below it
    const below = g.horizon - lens * Math.tan((rung * Math.PI) / 18)
    const near = reach * (rung === 0 ? 0.2 : 0.16)
    const far = reach * (rung === 0 ? 1 : 0.42)
    const tick = rung > 0 ? 3 : -3
    for (let side = -1; side <= 1; side += 2) {
      // A point `along` the line and `below` the middle of the view lands at
      // (along × cos + below × sin, below × cos − along × sin) once the picture is banked.
      const x0 = cx + side * near * cos + below * sin
      const y0 = cy + below * cos - side * near * sin
      const x1 = cx + side * far * cos + below * sin
      const y1 = cy + below * cos - side * far * sin
      line(fb, x0, y0, x1, y1, HUD)
      if (rung !== 0) line(fb, x1, y1, x1 + tick * sin, y1 + tick * cos, HUD) // an end tick that points at the horizon
    }
  }
  if (g.city) {
    // the gunsight: a ring round where the guns point
    const ring = Math.max(4, Math.round(reach * 0.14))
    for (let n = 0; n < 16; n++) {
      const a = (n / 16) * Math.PI * 2
      dot(fb, Math.round(cx + Math.sin(a) * ring), Math.round(cy - Math.cos(a) * ring), SIGHT)
    }
    dot(fb, cx, cy, SIGHT)
  }
  // where the nose points
  line(fb, cx - 10, cy, cx - 4, cy, HUD)
  line(fb, cx + 4, cy, cx + 10, cy, HUD)
  line(fb, cx, cy - 8, cx, cy - 4, HUD)
  dot(fb, cx, cy, HUD)
  // speed on the left, height on the right, heading above
  const size = p.letters
  const side = Math.round(reach * 1.12)
  number(fb, cx - side - 11 * size, cy - 2 * size, g.speed, 3, HUD, size)
  number(fb, cx + side, cy - 2 * size, g.altitude, 3, HUD, size)
  number(fb, cx - 5 * size, cy - Math.round(reach * 0.62), degrees(g.heading), 3, HUD, size)
}

const degrees = (heading) => (((heading * 180) / Math.PI) % 360 + 360) % 360

/** The map: the ground around the craft from straight above, turned so that ahead is up. */
function drawMap(fb, x0, y0, w, h, world, craft, g) {
  const reach = ((g.city ? RADAR_REACH : MAP_REACH) * 72) / w // the same patch of ground on a screen of any size
  const W = fb.width
  const H = fb.height
  const sin = Math.sin(craft.yaw)
  const cos = Math.cos(craft.yaw)
  const midX = w >> 1
  const midY = Math.round(h * 0.62) // the craft sits below the middle, so more of what is ahead shows
  for (let j = 0; j < h; j++) {
    const y = y0 + j
    if (y < 0 || y >= H) continue
    const tones = j & 1 ? SCREEN_DIM : SCREEN
    const back = (j - midY) * reach
    for (let i = 0; i < w; i++) {
      const x = x0 + i
      if (x < 0 || x >= W) continue
      const right = (i - midX) * reach
      const wx = craft.x + right * cos - back * sin
      const wy = craft.y + right * sin + back * cos
      const cell = ((Math.floor(wy) & WORLD_MASK) << WORLD_SHIFT) | (Math.floor(wx) & WORLD_MASK)
      fb.color[y * W + x] = tones[MAP_TONE[world.materials[cell]]]
    }
  }
  // the craft
  dot(fb, x0 + midX, y0 + midY - 2, WHITE)
  box(fb, x0 + midX - 1, y0 + midY - 1, 3, 1, WHITE)
  box(fb, x0 + midX - 2, y0 + midY, 5, 1, WHITE)
  // which way is north: a mark that rides round the edge of the screen. North is the
  // direction (−sin, −cos) from the craft, followed until it meets the nearest edge.
  const acrossRoom = (sin > 0 ? midX - 1 : w - 2 - midX) / Math.max(1e-6, Math.abs(sin))
  const downRoom = (cos > 0 ? midY - 1 : h - 2 - midY) / Math.max(1e-6, Math.abs(cos))
  const edge = Math.min(acrossRoom, downRoom)
  dot(fb, Math.round(x0 + midX - sin * edge), Math.round(y0 + midY - cos * edge), AMBER)
  // what the game has marked: enemies, their missiles, the place to go down at. One that is
  // off the screen sits on its edge, in the direction to fly. They are drawn last, so that an
  // enemy right on top of the craft still shows.
  const big = w >= 40
  for (let n = 0; n < g.blipCount; n++) {
    let dx = g.blips[n * 3] - craft.x
    const dy = g.blips[n * 3 + 1] - craft.y
    if (g.wraps) dx -= WORLD_SIZE * Math.round(dx / WORLD_SIZE)
    const kind = g.blips[n * 3 + 2]
    const px = clamp(midX + Math.round((dx * cos + dy * sin) / reach), 1, w - 2)
    const py = clamp(midY - Math.round((dx * sin - dy * cos) / reach), 1, h - 2)
    if (kind === 3) {
      // a missile: a spark that blinks
      if (((g.time * 10) & 1) === 0) dot(fb, x0 + px, y0 + py, WHITE)
    } else if (kind === 4) {
      dot(fb, x0 + px, y0 + py - 1, AMBER)
      dot(fb, x0 + px - 1, y0 + py, AMBER)
      dot(fb, x0 + px + 1, y0 + py, AMBER)
      dot(fb, x0 + px, y0 + py + 1, AMBER)
    } else {
      box(fb, x0 + px, y0 + py, big ? 2 : 1, big ? 2 : 1, RADAR_FOE)
      // one that is after the player wears a spark
      if (kind === 2 && ((g.time * 6) & 1) === 0) dot(fb, x0 + px, y0 + py - 1, WHITE)
    }
  }
}

/**
 * The attitude ball: sky above a line and ground below it. The line tilts with the bank and
 * slides with the pitch, so it always lies along the real horizon.
 */
function drawBall(fb, cx, cy, radius, roll, pitch) {
  const W = fb.width
  const H = fb.height
  const cos = Math.cos(roll)
  const sin = Math.sin(roll)
  const drop = clamp(pitch * radius * 2.2, -radius * 0.8, radius * 0.8) // nose up puts the line below the middle
  const rung = Math.max(3, radius * 0.3)
  const rim = (radius + 0.4) * (radius + 0.4)
  const shade = (radius - 1.3) * (radius - 1.3)
  for (let dy = -radius; dy <= radius; dy++) {
    const y = cy + dy
    if (y < 0 || y >= H) continue
    for (let dx = -radius; dx <= radius; dx++) {
      const far = dx * dx + dy * dy
      const x = cx + dx
      if (far > rim || x < 0 || x >= W) continue
      const below = dx * sin + dy * cos - drop // rows under the horizon line
      const along = dx * cos - dy * sin
      const step = Math.round(Math.abs(below) / rung)
      let col
      if (Math.abs(Math.abs(below) - step * rung) < 0.5 && Math.abs(along) < (step === 0 ? radius : step & 1 ? radius * 0.2 : radius * 0.36)) col = WHITE
      else if (below < 0) col = below > -rung ? BALL_SKY_LOW : BALL_SKY
      else col = below < rung ? BALL_GROUND_HIGH : BALL_GROUND
      fb.color[y * W + x] = far > shade ? mix(col, BLACK, 96) : col // darker at the rim, so it reads as round
    }
  }
  // the craft's own wings, fixed in the middle
  const wing = Math.max(2, Math.round(radius * 0.3))
  box(fb, cx - wing * 2, cy, wing, 1, AMBER)
  box(fb, cx + wing + 1, cy, wing, 1, AMBER)
  dot(fb, cx, cy, AMBER)
}

/** The compass tape: marks every 15° slide past a fixed pointer, with a letter at each quarter. */
function drawTape(fb, x, y, w, h, heading, size) {
  const mid = x + (w >> 1)
  const now = degrees(heading)
  const spacing = 0.62 * size // screen pixels per degree
  for (let mark = 0; mark < 24; mark++) {
    let off = mark * 15 - now // the short way round from the heading to this mark
    off -= 360 * Math.round(off / 360)
    const at = Math.round(mid + off * spacing)
    if (mark % 6 === 0) {
      const left = at - ((3 * size) >> 1)
      if (left > x && left + 3 * size < x + w) text(fb, left, y + 2, CARDINALS[mark / 6], SCREEN[6], size)
    } else if (at > x && at < x + w - 1) {
      const tall = (mark % 3 === 0 ? 3 : 2) * size
      box(fb, at, y + h - 1 - tall, 1, tall, SCREEN[4])
    }
  }
  dot(fb, mid, y, AMBER)
  dot(fb, mid, y + h - 1, AMBER)
}

/** A needle on a dial: straight up at 0, swinging to either side as `value` goes to −1 or 1. */
function drawNeedle(fb, x, y, radius, value) {
  const angle = clamp(value, -1, 1) * 2.1
  line(fb, x, y, x + Math.sin(angle) * (radius - 2), y - Math.cos(angle) * (radius - 2), AMBER)
  dot(fb, x, y, WHITE)
}

/** The numbers screen: speed, height and heading, and a bar for the thrusters. */
function drawReadout(fb, x, y, w, h, g) {
  const size = Math.max(1, Math.floor((w - 4) / 34))
  const row = 7 * size
  const left = x + 2 + size
  const top = y + ((h - 3 * row + 2 * size) >> 1)
  if (g.city) {
    // over the city: the hull as a bar, the score, and the missiles on the rails
    const barX = left + 10 * size
    const each = Math.max(1, Math.floor((x + w - 2 - barX) / g.hullMax))
    for (let n = 0; n < g.hullMax; n++) {
      box(fb, barX + n * each, top, Math.max(1, each - 1), 5 * size, n >= g.hull ? SCREEN[1] : g.hull <= g.hullMax * 0.4 ? HULL_LOW : SCREEN[5])
    }
    text(fb, left, top, 'HP', SCREEN[3], size)
    text(fb, left, top + row, 'PT', SCREEN[3], size)
    number(fb, barX, top + row, g.score, 5, SCREEN[6], size)
    text(fb, left, top + row * 2, 'MS', SCREEN[3], size)
    for (let n = 0; n < g.railsMax; n++) box(fb, barX + n * 4 * size, top + row * 2, 3 * size, 5 * size, n < g.rails ? AMBER : SCREEN[1])
    return
  }
  text(fb, left, top, 'SPD', SCREEN[3], size)
  number(fb, left + 16 * size, top, g.speed, 3, SCREEN[6], size)
  text(fb, left, top + row, 'ALT', SCREEN[3], size)
  number(fb, left + 16 * size, top + row, g.altitude, 3, SCREEN[6], size)
  text(fb, left, top + row * 2, 'HDG', SCREEN[3], size)
  number(fb, left + 16 * size, top + row * 2, degrees(g.heading), 3, SCREEN[6], size)
  // thrusters: six segments that fill from the bottom; two are lit when idling
  const barX = left + 29 * size
  const barW = x + w - 2 - barX
  const lit = Math.round(2 + g.boost * 4)
  for (let n = 0; n < 6; n++) {
    const tone = n >= lit ? SCREEN[1] : n >= 4 ? AMBER : SCREEN[5]
    box(fb, barX, top + 3 * row - 2 * size - (n + 1) * (row >> 1) + 1, barW, (row >> 1) - 1, tone)
  }
}

export function createCockpit() {
  let p = null
  let bow = null
  let dash = null
  return {
    /** Paints the fixed parts for a frame size. */
    resize(width, height) {
      p = plan(width, height)
      bow = paintBow(p)
      dash = paintDash(p)
    },
    /**
     * Draws the cockpit over the frame. `g` is the game's gauges (see game.js), and `arrival`
     * runs 0..1 as the camera comes into the seat: the frame comes down from above and the
     * dashboard comes up from below.
     */
    draw(fb, cam, world, craft, g, arrival) {
      if (!p) return
      const away = (1 - clamp(arrival, 0, 1)) ** 3 // quick to arrive, slow to settle
      // Both layers lean a little against a turn, the dashboard more because it is nearer
      // the eye, and the dashboard shakes with the thrusters open.
      const sway = -g.turn * 3
      const shake = g.boost > 0.5 && ((g.time * 30) & 1) === 1 ? 1 : 0
      stamp(fb, bow, Math.round(sway * 0.4) - MARGIN, -Math.round(away * bow.height))
      if (away < 0.002) drawHud(fb, cam, g, p)

      const left = Math.round(sway) - MARGIN
      const top = p.top + shake + Math.round(away * dash.height)
      stamp(fb, dash, left, top)
      drawMap(fb, left + p.map.x, top + p.map.y, p.map.w, p.map.h, world, craft, g)
      drawReadout(fb, left + p.data.x, top + p.data.y, p.data.w, p.data.h, g)
      drawTape(fb, left + p.tape.x, top + p.tape.y, p.tape.w, p.tape.h, g.heading, p.letters)
      drawBall(fb, left + p.ball.x, top + p.ball.y, p.ball.r, g.roll, g.pitch)
      drawNeedle(fb, left + p.dials[0].x, top + p.dials[0].y, p.dials[0].r, g.turn)
      drawNeedle(fb, left + p.dials[1].x, top + p.dials[1].y, p.dials[1].r, g.climb)
      for (let n = 0; n < LAMPS.length; n++) {
        const on = n === 0 ? g.boost > 0.3 : n === 1 ? (g.low || g.threat) && ((g.time * 6) & 1) === 0 : n === 2 ? g.rolling : g.idle
        box(fb, left + lampX(p, n), top + p.lamp.y, p.lamp.w, p.lamp.h, LAMPS[n][on ? 0 : 1])
      }
    },
  }
}

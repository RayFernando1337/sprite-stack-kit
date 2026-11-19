#!/usr/bin/env bun
// Draws the pictures the documents use, straight from the game's own code.
//
//   bun run figures                      # → docs/images/
//   bun run figures --out /tmp/figures   # somewhere else
//
// The game is repeatable, so this writes the same files every time until the drawing changes.
// Each figure is made with the same functions a game uses, so this file is also a set of
// worked examples: drawing a world with no craft in it, reading the depth array, rolling a
// picture.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng } from './lib/png.mjs'
import { createGame } from '../examples/starter/src/game.js'
import { createFramebuffer, rgb, EMPTY, FAR } from '../examples/starter/src/framebuffer.js'
import { createCamera } from '../examples/starter/src/camera.js'
import { drawStack } from '../examples/starter/src/stack.js'
import { drawWorld, drawSky } from '../examples/starter/src/terrain.js'
import { createSheet, sizeSheet, fitSheet, pasteRolled } from '../examples/starter/src/roll.js'
import { line } from '../examples/starter/src/paint.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outAt = process.argv.indexOf('--out')
const out = resolve(root, outAt < 0 ? 'docs/images' : process.argv[outAt + 1])
const SEED = 7
const PAPER = rgb(16, 22, 38) // behind and between the panels
const BLANK = rgb(34, 42, 64) // a pixel that nothing has drawn yet
const WHITE = rgb(255, 255, 255)

// A picture here is { width, height, color }, like the game's framebuffer.
const blank = (width, height, fill = PAPER) => ({ width, height, color: new Uint32Array(width * height).fill(fill) })
const copyOf = (frame) => ({ width: frame.width, height: frame.height, color: frame.color.slice(0, frame.width * frame.height) })

function paste(to, from, left, top) {
  for (let y = 0; y < from.height; y++) {
    to.color.set(from.color.subarray(y * from.width, (y + 1) * from.width), (top + y) * to.width + left)
  }
}

/** Lays panels out in rows of `columns`, with a gap between them. Short panels are centred. */
function grid(panels, columns = panels.length, gap = 4) {
  const cellW = Math.max(...panels.map((p) => p.width))
  const cellH = Math.max(...panels.map((p) => p.height))
  const rows = Math.ceil(panels.length / columns)
  const page = blank(columns * cellW + (columns - 1) * gap, rows * cellH + (rows - 1) * gap)
  panels.forEach((panel, n) => {
    const left = (n % columns) * (cellW + gap) + ((cellW - panel.width) >> 1)
    const top = ((n / columns) | 0) * (cellH + gap) + ((cellH - panel.height) >> 1)
    paste(page, panel, left, top)
  })
  return page
}

function save(name, picture, scale = 2) {
  const bytes = new Uint8ClampedArray(picture.color.buffer, picture.color.byteOffset, picture.width * picture.height * 4)
  const file = join(out, name)
  writeFileSync(file, encodePng(bytes, picture.width, picture.height, scale))
  console.log(`${file}  ${picture.width * scale} × ${picture.height * scale}`)
}

/** A game that has flown for `frames` sixtieths of a second. `each(game, i)` runs before every step. */
function fly(options, width, height, frames, each) {
  const game = createGame({ seed: SEED, ...options })
  game.resize(width, height)
  for (let i = 0; i < frames; i++) {
    if (each) each(game, i)
    game.update(1 / 60)
  }
  return game
}

/** The world alone, as the game's camera sees it right now: no sky, no craft. */
function worldOnly(game, to) {
  to.clear()
  drawWorld(to, game.camera, game.world, game.time, null)
  return to
}

mkdirSync(out, { recursive: true })

// ── the three views, one picture each and all three side by side
{
  const panels = []
  for (const view of ['top', 'chase', 'cockpit']) {
    save(`view-${view}.png`, copyOf(fly({ view }, 384, 240, 180).render()))
    panels.push(copyOf(fly({ view }, 256, 160, 180).render()))
  }
  save('views.png', grid(panels))
}

// ── the craft's slices, bottom slice first (the grid's empty layers are left out)
{
  const { model } = createGame({ seed: SEED })
  const mid = (model.width - 1) / 2
  const panels = model.layers.filter((layer) => layer.c.length > 0).map((layer) => {
    const tile = blank(model.width + 2, model.length + 2, BLANK)
    for (let n = 0; n < layer.c.length; n++) {
      // a is cells right of the centre line, b is cells ahead of the pivot
      tile.color[(1 + model.pivotK - layer.b[n]) * tile.width + 1 + mid + layer.a[n]] = model.colors[layer.c[n]]
    }
    return tile
  })
  save('slices.png', grid(panels, panels.length, 2), 4)
}

// ── the pile growing: the first two slices, then three, four, six, and all of them
{
  const { model } = createGame({ seed: SEED })
  const filled = model.layers.filter((layer) => layer.c.length > 0).length
  const empty = model.layers.length - filled // empty layers at the bottom of the grid
  const panels = [2, 3, 4, 6, filled].map((count) => {
    const panel = createFramebuffer()
    panel.resize(112, 140)
    panel.clear()
    panel.color.fill(BLANK)
    // the flat overhead camera, three screen pixels to a cell (see camera.js)
    const cam = Object.assign(createCamera(), { zoom: 3, cx: 64, cy: 84 })
    const pose = { x: 0, y: 0, z: 0, yaw: 0.6, roll: 0, pitch: 0, scale: 1, spread: 1, thrust: 0 }
    drawStack(panel, cam, { ...model, layers: model.layers.slice(0, empty + count), nozzles: [] }, pose, 0)
    return copyOf(panel)
  })
  save('pile.png', grid(panels), 3)
}
// ── one camera move: overhead → chase → cockpit, with no cut anywhere
{
  const panels = []
  const shots = [120, 134, 146, 164, 220, 234, 246, 310]
  fly({}, 192, 120, 311, (game, i) => {
    if (i === 120 || i === 220) game.nextView()
    if (shots.includes(i)) panels.push(copyOf(game.render()))
  })
  save('view-change.png', grid(panels, 4))
}

// ── the ground sweep: the same frame after more and more of the near-to-far sweep
{
  const game = fly({ view: 'chase' }, 256, 160, 180)
  const whole = copyOf(game.render())
  const ground = worldOnly(game, createFramebuffer())
  ground.resize(256, 160)
  worldOnly(game, ground)
  const reached = []
  for (let i = 0; i < ground.color.length; i++) if (ground.color[i] !== EMPTY) reached.push(ground.depth[i])
  reached.sort((a, b) => a - b)
  const panels = [0.2, 0.45, 0.72].map((share) => {
    const stop = reached[(reached.length * share) | 0] // the sweep has come this deep
    const panel = blank(256, 160, BLANK)
    for (let i = 0; i < panel.color.length; i++) if (ground.color[i] !== EMPTY && ground.depth[i] <= stop) panel.color[i] = ground.color[i]
    return panel
  })
  save('sweep.png', grid([...panels, whole], 4))

  // … and the depth array for that frame: near is light, far is dark, sky is empty
  const cam = game.camera
  const depth = blank(256, 160)
  const nearest = reached[0] + 1 / cam.persp
  const farthest = reached[reached.length - 1] + 1 / cam.persp
  for (let i = 0; i < depth.color.length; i++) {
    if (game.frame.depth[i] >= FAR) continue
    const away = game.frame.depth[i] + 1 / cam.persp // from the eye
    const t = Math.log(away / nearest) / Math.log(farthest / nearest)
    const grey = 236 - Math.round(Math.min(1, Math.max(0, t)) * 12) * 16 // twelve flat steps, like the game's haze
    depth.color[i] = rgb(grey, grey, grey)
  }
  save('depth.png', grid([whole, depth]))
}

// ── the cockpit view in three steps: the upright sheet, the sheet turned, the cockpit on top
{
  const W = 256
  const H = 160
  const game = fly({ view: 'cockpit' }, W, H, 150, (g) => g.setKeys(0.75, 0, false))
  const whole = copyOf(game.render())
  const cam = game.camera
  const roll = game.viewRoll
  const cx = cam.cx
  const cy = cam.cy

  const sheet = createSheet()
  sizeSheet(sheet, W, H)
  fitSheet(sheet, W, H, cx, cy, roll)
  cam.cx = sheet.cx
  cam.cy = sheet.cy
  worldOnly(game, sheet)
  drawSky(sheet, cam, game.world, H * 0.7)
  cam.cx = cx
  cam.cy = cy

  const turned = blank(W, H)
  pasteRolled(turned, sheet, cx, cy, roll)

  // mark the part of the sheet that ends up in the frame
  const upright = copyOf(sheet)
  const corner = (x, y) => [
    sheet.cx + (x - cx) * Math.cos(roll) - (y - cy) * Math.sin(roll),
    sheet.cy + (x - cx) * Math.sin(roll) + (y - cy) * Math.cos(roll),
  ]
  const corners = [corner(0, 0), corner(W - 1, 0), corner(W - 1, H - 1), corner(0, H - 1)]
  for (let n = 0; n < 4; n++) line(upright, ...corners[n], ...corners[(n + 1) % 4], WHITE)
  line(upright, sheet.cx - 4, sheet.cy, sheet.cx + 4, sheet.cy, WHITE)
  line(upright, sheet.cx, sheet.cy - 4, sheet.cx, sheet.cy + 4, WHITE)

  save('cockpit-steps.png', grid([upright, turned, whole]))
}

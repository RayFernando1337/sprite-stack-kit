// Proves scripts/views.mjs: draws four views of a small car into a PNG, cuts a model from it,
// and draws the model with the starter's own buildModel() and drawStack().

import { test, expect } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { encodePng } from '../scripts/lib/png.mjs'
import { viewsToModel } from '../scripts/views.mjs'
import { buildModel, decodeGrid } from '../examples/starter/src/model.js'
import { drawStack } from '../examples/starter/src/stack.js'
import { createCamera } from '../examples/starter/src/camera.js'
import { createFramebuffer, rgb } from '../examples/starter/src/framebuffer.js'

const W = 11
const L = 22
const H = 8
const BACKGROUND = [236, 232, 220]
const LINE = [12, 12, 20]
const BLUE = [40, 90, 200]
const GLASS = [50, 80, 120]
const WHITE = [240, 240, 240]
const TYRE = [30, 30, 36]
const LAMP = [250, 210, 60]
const TAIL = [220, 40, 40]

// The car in the model's own directions: i across, k from the nose back, z up from the ground.
const wheelAlong = (k) => (k >= 3 && k <= 6) || (k >= 15 && k <= 18)
const wheelAcross = (i) => i <= 2 || i >= 8
const sideShape = (k, z) => (z <= 1 ? wheelAlong(k) : z <= 4 ? true : k >= 9 && k <= 17)
const frontShape = (i, z) => (z <= 1 ? wheelAcross(i) : z <= 4 ? true : i >= 2 && i <= 8)
const inCar = (i, k, z) => sideShape(k, z) && frontShape(i, z)

function drawSheet({ sideNose = 'left', topNose = 'down' } = {}) {
  const width = 60
  const height = 44
  const rgba = new Uint8Array(width * height * 4)
  for (let p = 0; p < width * height; p++) rgba.set(BACKGROUND, p * 4)
  // one drawing: `colour(x, y)` gives a colour or null, and its edge pixels become a dark outline
  const draw = (x0, y0, w, h, colour) => {
    const has = (x, y) => x >= 0 && y >= 0 && x < w && y < h && colour(x, y) !== null
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!has(x, y)) continue
        const edge = !(has(x - 1, y) && has(x + 1, y) && has(x, y - 1) && has(x, y + 1))
        rgba.set(edge ? LINE : colour(x, y), ((y0 + y) * width + x0 + x) * 4)
      }
    }
  }
  // top (the tallest): the roof glass sits behind the middle, and a white stripe runs along cells i = 8
  draw(4, 4, W, L, (x, y) => {
    const i = topNose === 'down' ? W - 1 - x : x
    const k = topNose === 'down' ? L - 1 - y : y
    return i === 8 ? WHITE : k >= 9 && k <= 17 && i >= 2 && i <= 8 ? GLASS : BLUE
  })
  // side (the widest)
  draw(24, 6, L, H, (x, y) => {
    const k = sideNose === 'left' ? x : L - 1 - x
    const z = H - 1 - y
    return sideShape(k, z) ? (z <= 1 ? TYRE : z >= 5 ? GLASS : BLUE) : null
  })
  // front, then back: the lamps are on the car's right, cells i = 8 and 9
  draw(24, 26, W, H, (x, y) => {
    const i = W - 1 - x
    const z = H - 1 - y
    return frontShape(i, z) ? (z <= 1 ? TYRE : z === 3 && (i === 8 || i === 9) ? LAMP : z >= 5 ? GLASS : BLUE) : null
  })
  draw(42, 26, W, H, (x, y) => {
    const z = H - 1 - y
    return frontShape(x, z) ? (z <= 1 ? TYRE : z === 3 && (x === 8 || x === 9) ? TAIL : z >= 5 ? GLASS : BLUE) : null
  })
  return encodePng(rgba, width, height)
}

const sheet = drawSheet()
const made = viewsToModel(sheet)
const at = (i, k, z) => (z * L + k) * W + i
// the sheet colour of a cell: the light tone of its three palette entries
const colourOf = (result, i, k, z) => result.palette[result.grid[at(i, k, z)] - ((result.grid[at(i, k, z)] - 1) % 3) + 2]

test('the model is as wide and long as the top view and as tall as the side view', () => {
  expect(made.size).toEqual({ width: W, length: L, height: H })
  expect(made.grid.length).toBe(W * L * H)
})

test('a cell exists only where the views agree', () => {
  let wrong = 0
  let cells = 0
  for (let z = 0; z < H; z++) {
    for (let k = 0; k < L; k++) {
      for (let i = 0; i < W; i++) {
        if (made.grid[at(i, k, z)] !== 0) cells++
        if ((made.grid[at(i, k, z)] !== 0) !== inCar(i, k, z)) wrong++
      }
    }
  }
  expect(wrong).toBe(0)
  expect(cells).toBe(made.cells)
  expect(cells).toBeGreaterThan(500)
})

test('colours come from the view that faces each cell, and the outlines are gone', () => {
  expect(colourOf(made, 8, 1, 4)).toEqual(WHITE) // the stripe, on the car's right
  expect(colourOf(made, 2, 1, 4)).toEqual(BLUE)
  expect(colourOf(made, 5, 12, 7)).toEqual(GLASS) // the roof
  expect(colourOf(made, 9, 0, 3)).toEqual(LAMP) // front view, mirrored
  expect(colourOf(made, 1, 0, 3)).toEqual(BLUE)
  expect(colourOf(made, 9, L - 1, 3)).toEqual(TAIL) // back view, as drawn
  expect(colourOf(made, 0, 4, 0)).toEqual(TYRE) // side view
  expect(colourOf(made, 5, 4, 3)).toEqual(BLUE) // deep inside: carried down from above
  expect(made.palette.slice(1).some((c) => c.join() === LINE.join())).toBe(false)
  expect((made.palette.length - 1) % 3).toBe(0)
  for (const index of made.grid) expect(index).toBeLessThan(made.palette.length)
})

test('the side and top views can face the other way', () => {
  const turned = viewsToModel(drawSheet({ sideNose: 'right', topNose: 'up' }), { sideNose: 'right', topNose: 'up' })
  expect(turned.grid).toEqual(made.grid)
  expect(turned.palette).toEqual(made.palette)
})

test('--colours limits the palette and --flat keeps the sheet colours', () => {
  const few = viewsToModel(sheet, { colours: 3 })
  expect((few.palette.length - 1) / 3).toBeLessThanOrEqual(3)
  const flat = viewsToModel(sheet, { flat: true })
  for (const index of flat.grid) expect(index === 0 || index % 3 === 0).toBe(true)
  expect(flat.palette[flat.grid[at(5, 12, 7)]]).toEqual(GLASS)
})

// The kit's flat overhead view: nothing shrinks, and each slice sits one pixel above the last.
function drawFlat(model, pose, tilt = 1) {
  const fb = createFramebuffer()
  fb.resize(64, 64)
  fb.clear()
  const cam = createCamera()
  cam.cx = 32
  cam.cy = 32
  cam.tilt = tilt
  drawStack(fb, cam, model, { x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, scale: 1, spread: 1, thrust: 0, ...pose }, 0)
  return fb
}
function bounds(fb, skip) {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  for (let y = 0; y < fb.height; y++) {
    for (let x = 0; x < fb.width; x++) {
      const c = fb.color[y * fb.width + x]
      if (c === 0 || c === skip) continue
      box.x0 = Math.min(box.x0, x)
      box.x1 = Math.max(box.x1, x)
      box.y0 = Math.min(box.y0, y)
      box.y1 = Math.max(box.y1, y)
    }
  }
  return { wide: box.x1 - box.x0 + 1, tall: box.y1 - box.y0 + 1 }
}

const pivotK = L >> 1
const model = buildModel(made.grid, { ...made.size, pivotK, pivotZ: 0, palette: made.palette, outline: [255, 0, 255] })

test('straight down, the drawn stack matches pasting the slices by hand one pixel apart', () => {
  const fb = drawFlat(model, {})
  const pasted = new Uint32Array(64 * 64)
  for (let z = 0; z < H; z++) {
    for (let k = 0; k < L; k++) {
      for (let i = 0; i < W; i++) {
        const index = made.grid[at(i, k, z)]
        if (index) pasted[(32 + k - pivotK - z) * 64 + 32 + i - (W - 1) / 2] = rgb(...made.palette[index])
      }
    }
  }
  let wrong = 0
  let outlined = 0
  for (let y = 1; y < 63; y++) {
    for (let x = 1; x < 63; x++) {
      const o = y * 64 + x
      if (pasted[o]) {
        if (fb.color[o] !== pasted[o]) wrong++
        continue
      }
      // outside the paste there is only the one outline, round the finished stack
      const touches = pasted[o - 1] || pasted[o + 1] || pasted[o - 64] || pasted[o + 64]
      if (fb.color[o] !== (touches ? model.outline : 0)) wrong++
      if (touches) outlined++
    }
  }
  expect(wrong).toBe(0)
  expect(outlined).toBeGreaterThan(60)
})

test('the drawn size is what the settings say', () => {
  const straight = bounds(drawFlat(model, {}), model.outline)
  expect(straight.wide).toBe(W)
  expect(straight.tall).toBe(L + 2) // the full-length body is slices 2 to 4; the wheels and the roof are shorter
  expect(straight.tall).toBeLessThanOrEqual(L + H - 1)
  expect(bounds(drawFlat(model, { yaw: Math.PI / 2 }), model.outline).wide).toBe(L)
  expect(bounds(drawFlat(model, { spread: 2 }), model.outline).tall).toBeGreaterThan(straight.tall)
  expect(bounds(drawFlat(model, {}, 0.75), model.outline).tall).toBeLessThan(straight.tall) // a lower camera
})

test('the command writes the same model every time, and a picture of the slices', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'views-'))
  const file = join(folder, 'car.png')
  writeFileSync(file, sheet)
  const run = (...more) => Bun.spawnSync([process.execPath, resolve(import.meta.dir, '../scripts/views.mjs'), ...more])
  const first = run(file)
  expect(first.exitCode).toBe(0)
  const text = readFileSync(join(folder, 'car.js'), 'utf8')
  expect(text).toBe(made.text.replace('a sheet', 'car.png'))
  expect(run(file, '--out', join(folder, 'again.js')).exitCode).toBe(0)
  expect(readFileSync(join(folder, 'again.js'), 'utf8')).toBe(text)
  expect(readFileSync(join(folder, 'again.slices.png')).equals(readFileSync(join(folder, 'car.slices.png')))).toBe(true)
  const loaded = await import(pathToFileURL(join(folder, 'car.js')).href)
  expect(loaded.SIZE).toEqual(made.size)
  expect(loaded.PALETTE).toEqual(made.palette)
  expect(decodeGrid(loaded.GRID, W * L * H)).toEqual(made.grid)
})

test('a sheet it cannot use gets a plain message', () => {
  const blank = new Uint8Array(20 * 20 * 4).fill(200)
  expect(() => viewsToModel(encodePng(blank, 20, 20))).toThrow('found no drawings')
  const two = blank.slice()
  for (const x of [2, 12]) for (let y = 2; y < 8; y++) for (let dx = 0; dx < 5; dx++) two.set([10, 90, 10], (y * 20 + x + dx) * 4)
  expect(() => viewsToModel(encodePng(two, 20, 20))).toThrow('found 2 drawings, expected 4')
  expect(() => viewsToModel(Buffer.from('not a picture'))).toThrow('not a PNG')
  expect(() => viewsToModel(sheet, { colours: 0 })).toThrow('--colours')
  const missing = Bun.spawnSync([process.execPath, resolve(import.meta.dir, '../scripts/views.mjs'), '/tmp/no-such-sheet.png'])
  expect(missing.exitCode).toBe(1)
  expect(missing.stderr.toString()).toContain('views: cannot read /tmp/no-such-sheet.png')
})

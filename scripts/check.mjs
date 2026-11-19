#!/usr/bin/env node
// Checks a game with no browser: `npm test`, or `npm test -- --game examples/my-game` for a
// copy of the starter that keeps its file names.
// Each check is one promise the kit makes, so a change that breaks a promise fails here.

import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const gameAt = process.argv.indexOf('--game')
const gameDir = resolve(root, gameAt < 0 ? 'examples/starter' : process.argv[gameAt + 1])
const load = (file) => import(pathToFileURL(join(gameDir, 'src', file)).href)
const { createGame } = await load('game.js')
const { createCamera, project, horizonRow } = await load('camera.js')
const { EMPTY } = await load('framebuffer.js')
const { buildWorld, groundAt, GROUND_MAX, CLOUD_LAYERS, MAT } = await load('world.js')
const { sculptGrid, encodeGrid, decodeGrid, buildCraft, CRAFT_W, CRAFT_L, CRAFT_H } = await load('model.js')
let failed = 0
function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
function checksum(words) {
  let h = 2166136261
  for (let i = 0; i < words.length; i++) h = Math.imul(h ^ words[i], 16777619)
  return h >>> 0
}
function fly(game, frames, each) {
  for (let i = 0; i < frames; i++) {
    game.update(1 / 60)
    if (each) each(i)
  }
  return game.render()
}

// ── the model
const grid = sculptGrid()
const model = buildCraft()
check('model: the encoded form decodes back to the same grid', checksum(decodeGrid(encodeGrid(grid), grid.length)) === checksum(grid))
check('model: has a solid number of cells', model.cells > 800, `${model.cells} cells, ${encodeGrid(grid).length} characters encoded`)
let mirrored = true
for (let z = 0; z < CRAFT_H && mirrored; z++) {
  for (let k = 0; k < CRAFT_L && mirrored; k++) {
    for (let i = 0; i < CRAFT_W; i++) {
      const a = grid[(z * CRAFT_L + k) * CRAFT_W + i] !== 0
      const b = grid[(z * CRAFT_L + k) * CRAFT_W + (CRAFT_W - 1 - i)] !== 0
      if (a !== b) mirrored = false
    }
  }
}
check('model: left and right halves match', mirrored)

// ── the world
const world = buildWorld(7)
const again = buildWorld(7)
const other = buildWorld(8)
check('world: the same seed gives the same world', checksum(world.heights) === checksum(again.heights) && checksum(world.cloudMap) === checksum(again.cloudMap))
check('world: a different seed gives a different world', checksum(world.heights) !== checksum(other.heights))
let land = 0
let tallest = 0
let thickest = 0
for (let i = 0; i < world.heights.length; i++) {
  if (world.materials[i] >= MAT.SAND) land++
  if (world.heights[i] > tallest) tallest = world.heights[i]
}
for (let i = 0; i < world.cloudMap.length; i++) if (world.cloudMap[i] > thickest) thickest = world.cloudMap[i]
const share = land / world.heights.length
check('world: land covers the share that was asked for', Math.abs(share - 0.3) < 0.02, `${(share * 100).toFixed(1)}% land`)
check('world: nothing is taller than the renderer allows', tallest <= GROUND_MAX && thickest <= CLOUD_LAYERS, `ground ${tallest}/${GROUND_MAX}, cloud ${thickest}/${CLOUD_LAYERS}`)

// ── the camera
const cam = createCamera()
Object.assign(cam, { x: 100, y: 100, alt: 20, cx: 160, cy: 120 })
project(cam, 100, 100, 20)
check('camera: the focus lands on its screen anchor', cam.sx === 160 && cam.sy === 120)
project(cam, 100, 100, 30)
const upTen = cam.sy
project(cam, 100, 90, 20)
check('camera: in the flat view, one layer of height and one pixel of depth each move one pixel up', upTen === 110 && cam.sy === 110)
check('camera: the flat view has no horizon', horizonRow(cam) < -1e6)

// ── drawing
for (const [width, height] of [[384, 240], [200, 420], [640, 360]]) {
  for (const view of ['top', 'chase']) {
    const game = createGame({ seed: 7, view })
    game.resize(width, height)
    const frame = fly(game, 90)
    let empty = 0
    let outline = 0
    for (let i = 0; i < frame.color.length; i++) {
      if (frame.color[i] === EMPTY || frame.color[i] >>> 24 !== 255) empty++
      if (frame.color[i] === game.model.outline) outline++
    }
    check(`draw: ${view} view at ${width}×${height} fills every pixel and shows the craft`, empty === 0 && outline > 20, `${empty} empty, ${outline} outline pixels`)
  }
}

// ── the view change never shows a broken frame
{
  const game = createGame({ seed: 7 })
  game.resize(384, 240)
  fly(game, 30)
  game.toggleView()
  let worst = 0
  let backwards = 0
  let before = game.viewAmount
  for (let i = 0; i < 240; i++) {
    game.update(1 / 60)
    if (game.viewAmount < before - 1e-9) backwards++
    before = game.viewAmount
    const frame = game.render()
    let empty = 0
    for (let p = 0; p < frame.color.length; p++) if (frame.color[p] === EMPTY) empty++
    if (empty > worst) worst = empty
  }
  check('view change: the camera slides one way and arrives', backwards === 0 && game.viewAmount === 1, `${backwards} backward steps, ends at ${game.viewAmount}`)
  check('view change: every frame on the way is complete', worst === 0, `${worst} empty pixels at worst`)
}

// ── the same seed and input give the same picture
{
  const run = () => {
    const game = createGame({ seed: 11 })
    game.resize(320, 200)
    game.setKeys(1, 0, true)
    const frame = fly(game, 200, (i) => {
      if (i === 60) game.toggleView()
      if (i === 100) game.roll()
    })
    return checksum(frame.color)
  }
  const a = run()
  check('replay: the same seed and input draw the same frame', a === run(), `frame ${a.toString(16)}`)
}

// ── input
{
  const game = createGame({ seed: 7 })
  game.resize(384, 240)
  const start = game.craft.yaw
  game.setKeys(1, 0, false)
  fly(game, 60)
  check('input: holding right turns the craft clockwise', game.craft.yaw > start + 0.5, `turned ${(game.craft.yaw - start).toFixed(2)} rad in a second`)
  game.setKeys(0, 0, false)
  game.press()
  game.release()
  check('input: a click starts a roll', game.craft.spin === 0)
  game.press()
  fly(game, 45)
  check('input: a hold opens the thrusters', game.boost > 0.6, `boost ${game.boost.toFixed(2)}`)
  game.release()
  let lowest = Infinity
  game.setKeys(0, -1, false)
  for (let i = 0; i < 900; i++) {
    game.update(1 / 60)
    const clear = game.craft.z - groundAt(game.world, game.craft.x, game.craft.y)
    if (clear < lowest) lowest = clear
  }
  check('flight: holding a dive for 15 seconds never reaches the ground', lowest > 3, `closest ${lowest.toFixed(1)} px`)
}

// ── speed
for (const view of ['top', 'chase']) {
  const game = createGame({ seed: 7, view })
  game.resize(480, 270)
  fly(game, 30)
  const frames = 240
  const began = performance.now()
  for (let i = 0; i < frames; i++) {
    game.update(1 / 60)
    game.render()
  }
  const each = (performance.now() - began) / frames
  check(`speed: a ${view} frame at 480×270 fits in a 60 fps frame`, each < 16.6, `${each.toFixed(2)} ms per frame`)
}

// ── the starter stays self-contained
{
  const dir = gameDir
  const sources = ['index.html', ...readdirSync(join(dir, 'src')).map((f) => `src/${f}`)]
  let raw = 0
  let packed = 0
  const outside = []
  for (const file of sources) {
    const text = readFileSync(join(dir, file), 'utf8')
    raw += text.length
    packed += gzipSync(text).length
    if (/https?:\/\//.test(text)) outside.push(`${file}: a web address`)
    for (const m of text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) if (!m[1].startsWith('./')) outside.push(`${file}: imports ${m[1]}`)
    if (/getContext\(\s*['"](webgl2?|webgpu)|WebGLRenderingContext|navigator\.gpu/.test(text)) outside.push(`${file}: uses WebGL or WebGPU`)
  }
  check('starter: no libraries, no network, no 3D engine', outside.length === 0, outside.join('; ') || `${sources.length} files, ${(raw / 1024).toFixed(1)} KB, ${(packed / 1024).toFixed(1)} KB gzipped`)
}

// ── the tools
{
  // With no --port, the server once ignored its folder and served the starter instead.
  const run = spawnSync(process.execPath, [join(root, 'scripts/serve.mjs'), 'no/such/folder'], { encoding: 'utf8', timeout: 5000 })
  const refused = run.status === 1 && run.stderr.includes('Nothing to serve')
  check('tools: the server serves the folder it is given, and refuses a missing one', refused, run.status === null ? 'it started serving something else' : `exit ${run.status}`)
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)

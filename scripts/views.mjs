#!/usr/bin/env bun
// Cuts a sprite stack from four flat drawings of an object: from the top, the side, the front
// and the back. The idea is from SpriteCook's article "Sprite stacking for fake 3D pixel art
// cars and props" (https://www.spritecook.ai/blog/sprite-stacking-pixel-art).
//
//   bun run views car.png                       # → car.js and car.slices.png beside the sheet
//   bun run views car.png --out examples/boats/src/car-data.js
//   bun run views car.png --side-nose right     # the side drawing faces right
//   bun run views car.png --top-nose up         # the top drawing points up the sheet
//   bun run views car.png --colours 8           # at most 8 colours (default 16, most 84)
//   bun run views car.png --flat                # no shading: every cell keeps the sheet's colour
//   bun run views car.png --keep-outline        # the drawings have no dark outline to remove
//
// The sheet: four drawings with at least 3 empty pixels between them, on a transparent
// background or on one flat colour (the colour of the sheet's top-left pixel). The tallest
// drawing is taken as the top view and the widest of the rest as the side view. The other two
// are the front and then the back, in reading order. By default the top view points down the
// sheet and the side view faces left.
//
// The model: a cell is filled where the top view, the side view and the front or back view are
// all filled. Each row of the side view becomes one slice. The top cell of a column takes the
// top view's colour. A covered cell within 2 cells of a slice's edge takes the colour of the
// view on that side. A covered cell deeper in takes the colour of the cell above it.
//
// Colours: every colour of the sheet gets three palette entries in a row, dark, mid and light,
// which is what the starter's shadeGrid() expects. The light one is the sheet's own colour.
// The grid is written already shaded, so it goes straight to buildModel().

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng } from './lib/png.mjs'
import { encodeGrid, shadeGrid } from '../examples/starter/src/model.js'

const MOST_COLOURS = 84 // three entries each, and a palette index is one byte
const MID = 0.8
const DARK = 0.62
const OUTLINE_BELOW = 70 // an edge pixel darker than this (mean of r, g, b) is the drawing's outline
const EDGE = 2 // how many cells in from a slice's edge take the side, front or back view's colour
const PREVIEW_BACK = [58, 62, 76]
const PREVIEW_SCALE = 4

class ViewsError extends Error {}
const fail = (message) => {
  throw new ViewsError(message)
}

/** The sheet as { width, height, rgb, solid }: `solid` is 1 where a pixel belongs to a drawing. */
function readSheet(file) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (file.length < 8 || signature.some((byte, i) => file[i] !== byte)) fail('that file is not a PNG')
  let png
  try {
    png = decodePng(file)
  } catch (error) {
    fail(`could not read the PNG: ${error.message}. Save it as 8-bit RGB or RGBA`)
  }
  const { width, height, channels, data } = png
  if (!width || !height) fail('the PNG is empty')
  const count = width * height
  const rgb = new Uint8Array(count * 3)
  const solid = new Uint8Array(count)
  let clear = 0
  for (let p = 0; p < count; p++) {
    rgb[p * 3] = data[p * channels]
    rgb[p * 3 + 1] = data[p * channels + 1]
    rgb[p * 3 + 2] = data[p * channels + 2]
    solid[p] = channels === 4 && data[p * 4 + 3] < 128 ? 0 : 1
    if (!solid[p]) clear++
  }
  if (clear === 0) {
    // no transparency: the background is whatever colour the top-left pixel has
    for (let p = 0; p < count; p++) {
      const far = Math.abs(rgb[p * 3] - rgb[0]) + Math.abs(rgb[p * 3 + 1] - rgb[1]) + Math.abs(rgb[p * 3 + 2] - rgb[2])
      if (far <= 24) solid[p] = 0
    }
  }
  return { width, height, rgb, solid }
}

/** The four drawings as { w, h, rgb, solid }, in the order top, side, front, back. */
function findViews(sheet) {
  const { width, height, solid } = sheet
  // pixels up to 2 apart still belong to one drawing
  let grown = solid
  for (let pass = 0; pass < 2; pass++) {
    const next = grown.slice()
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!grown[y * width + x]) continue
        if (x > 0) next[y * width + x - 1] = 1
        if (x < width - 1) next[y * width + x + 1] = 1
        if (y > 0) next[(y - 1) * width + x] = 1
        if (y < height - 1) next[(y + 1) * width + x] = 1
      }
    }
    grown = next
  }
  const seen = new Uint8Array(width * height)
  const todo = new Int32Array(width * height)
  let boxes = []
  for (let start = 0; start < grown.length; start++) {
    if (!grown[start] || seen[start]) continue
    let end = 0
    todo[end++] = start
    seen[start] = 1
    const box = { x0: width, y0: height, x1: -1, y1: -1 }
    while (end > 0) {
      const p = todo[--end]
      const x = p % width
      const y = (p - x) / width
      if (solid[p]) {
        if (x < box.x0) box.x0 = x
        if (x > box.x1) box.x1 = x
        if (y < box.y0) box.y0 = y
        if (y > box.y1) box.y1 = y
      }
      if (x > 0 && grown[p - 1] && !seen[p - 1]) seen[(todo[end++] = p - 1)] = 1
      if (x < width - 1 && grown[p + 1] && !seen[p + 1]) seen[(todo[end++] = p + 1)] = 1
      if (y > 0 && grown[p - width] && !seen[p - width]) seen[(todo[end++] = p - width)] = 1
      if (y < height - 1 && grown[p + width] && !seen[p + width]) seen[(todo[end++] = p + width)] = 1
    }
    box.w = box.x1 - box.x0 + 1
    box.h = box.y1 - box.y0 + 1
    boxes.push(box)
  }
  if (boxes.length === 0) fail('found no drawings: the sheet is one flat colour')
  // labels and specks are much smaller than the drawings
  const biggest = Math.max(...boxes.map((box) => box.w * box.h))
  boxes = boxes.filter((box) => box.w * box.h >= 0.2 * biggest)
  if (boxes.length !== 4) {
    fail(`found ${boxes.length} drawing${boxes.length === 1 ? '' : 's'}, expected 4: top, side, front and back, with at least 3 empty pixels between them`)
  }
  // reading order: rows from the top, each from the left
  boxes.sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1) || a.x0 - b.x0)
  const rows = []
  for (const box of boxes) {
    const row = rows[rows.length - 1]
    if (row && (box.y0 + box.y1) / 2 <= row.bottom) {
      row.boxes.push(box)
      row.bottom = Math.max(row.bottom, box.y1)
    } else rows.push({ bottom: box.y1, boxes: [box] })
  }
  const views = rows.flatMap((row) => row.boxes.sort((a, b) => a.x0 - b.x0)).map((box) => {
    const view = { w: box.w, h: box.h, rgb: new Uint8Array(box.w * box.h * 3), solid: new Uint8Array(box.w * box.h) }
    for (let y = 0; y < box.h; y++) {
      for (let x = 0; x < box.w; x++) {
        const from = (box.y0 + y) * width + box.x0 + x
        const to = y * box.w + x
        view.solid[to] = solid[from]
        view.rgb.set(sheet.rgb.subarray(from * 3, from * 3 + 3), to * 3)
      }
    }
    return view
  })
  let top = views[0]
  for (const view of views) if (view.h / view.w > top.h / top.w) top = view
  const rest = views.filter((view) => view !== top)
  let side = rest[0]
  for (const view of rest) if (view.w / view.h > side.w / side.h) side = view
  const [front, back] = rest.filter((view) => view !== side)
  return { top, side, front, back }
}

/**
 * A dark pixel on the edge of a drawing is its outline. drawStack() outlines the finished stack
 * itself, and an outline left in the slices shows as dark specks inside the body, so each such
 * pixel takes the colour of the darkest pixel beside it that is not outline. Darkest, so the
 * edge of a tyre stays tyre and does not turn into the body above it.
 */
function stripOutline(view) {
  const { w, h, rgb, solid } = view
  const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && solid[y * w + x] === 1
  const line = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (!solid[p]) continue
      const onEdge = !(filled(x - 1, y) && filled(x + 1, y) && filled(x, y - 1) && filled(x, y + 1))
      if (onEdge && (rgb[p * 3] + rgb[p * 3 + 1] + rgb[p * 3 + 2]) / 3 < OUTLINE_BELOW) line[p] = 1
    }
  }
  const out = rgb.slice()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!line[y * w + x]) continue
      let best = -1
      let bestSum = Infinity
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const q = (y + dy) * w + x + dx
          if (!filled(x + dx, y + dy) || line[q]) continue
          const sum = rgb[q * 3] + rgb[q * 3 + 1] + rgb[q * 3 + 2]
          if (sum < bestSum) {
            bestSum = sum
            best = q
          }
        }
      }
      if (best >= 0) out.set(rgb.subarray(best * 3, best * 3 + 3), (y * w + x) * 3)
    }
  }
  return { ...view, rgb: out }
}

/** Puts all the views on one list of at most `most` colours. Each view gets `ink`: a colour number per pixel. */
function sharePalette(views, most) {
  const counts = new Map()
  for (const view of views) {
    for (let p = 0; p < view.solid.length; p++) {
      if (!view.solid[p]) continue
      const key = (view.rgb[p * 3] << 16) | (view.rgb[p * 3 + 1] << 8) | view.rgb[p * 3 + 2]
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const all = [...counts.keys()].sort((a, b) => a - b).map((key) => ({ c: [key >> 16, (key >> 8) & 255, key & 255], n: counts.get(key) }))
  let colours
  if (all.length <= most) colours = all.map((entry) => entry.c)
  else {
    // median cut: split the group with the widest spread of colour at its middle pixel, until there are enough
    const spread = (group) => {
      let wide = -1
      let channel = 0
      for (let ch = 0; ch < 3; ch++) {
        let low = 255
        let high = 0
        for (const entry of group) {
          if (entry.c[ch] < low) low = entry.c[ch]
          if (entry.c[ch] > high) high = entry.c[ch]
        }
        if (high - low > wide) {
          wide = high - low
          channel = ch
        }
      }
      return { wide, channel }
    }
    const groups = [all]
    while (groups.length < most) {
      let pick = -1
      let widest = 0
      let channel = 0
      groups.forEach((group, i) => {
        const s = spread(group)
        if (group.length > 1 && s.wide > widest) {
          widest = s.wide
          channel = s.channel
          pick = i
        }
      })
      if (pick < 0) break
      const group = groups[pick].slice().sort((a, b) => a.c[channel] - b.c[channel] || a.c[0] - b.c[0] || a.c[1] - b.c[1] || a.c[2] - b.c[2])
      const total = group.reduce((sum, entry) => sum + entry.n, 0)
      let cut = 0
      for (let sum = 0; cut < group.length - 1; cut++) {
        sum += group[cut].n
        if (sum * 2 >= total) break
      }
      cut = Math.min(group.length - 1, cut + 1)
      groups.splice(pick, 1, group.slice(0, cut), group.slice(cut))
    }
    colours = groups.map((group) => {
      const total = group.reduce((sum, entry) => sum + entry.n, 0)
      return [0, 1, 2].map((ch) => Math.round(group.reduce((sum, entry) => sum + entry.c[ch] * entry.n, 0) / total))
    })
  }
  const nearest = new Map()
  for (const entry of all) {
    let best = 0
    let bestFar = Infinity
    colours.forEach((c, i) => {
      const far = (c[0] - entry.c[0]) ** 2 + (c[1] - entry.c[1]) ** 2 + (c[2] - entry.c[2]) ** 2
      if (far < bestFar) {
        bestFar = far
        best = i
      }
    })
    nearest.set((entry.c[0] << 16) | (entry.c[1] << 8) | entry.c[2], best)
  }
  for (const view of views) {
    view.ink = new Int16Array(view.solid.length).fill(-1)
    for (let p = 0; p < view.solid.length; p++) {
      if (view.solid[p]) view.ink[p] = nearest.get((view.rgb[p * 3] << 16) | (view.rgb[p * 3 + 1] << 8) | view.rgb[p * 3 + 2])
    }
  }
  return colours
}

/**
 * A view as `cols` × `rows` colour numbers (−1 is empty) in the model's own directions. `at`
 * gives the drawing's pixel for a cell: (column, row) → [x, y] as shares 0..1 of the drawing.
 */
function lay(view, cols, rows, at) {
  const out = new Int16Array(cols * rows)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const [u, v] = at((col + 0.5) / cols, (row + 0.5) / rows)
      out[row * cols + col] = view.ink[Math.min(view.h - 1, Math.floor(v * view.h)) * view.w + Math.min(view.w - 1, Math.floor(u * view.w))]
    }
  }
  return out
}

/** The colour at `index` of a row of a view, or of the nearest filled pixel in that row. −1 when the row is empty. */
function rowColour(view, cols, row, index) {
  for (let far = 0; far < cols; far++) {
    if (index - far >= 0 && view[row * cols + index - far] >= 0) return view[row * cols + index - far]
    if (index + far < cols && view[row * cols + index + far] >= 0) return view[row * cols + index + far]
  }
  return -1
}

/**
 * sheetPng: the bytes of a PNG file. Returns { size, palette, grid, text, preview }: the
 * model's size, its palette, its grid (ready for buildModel), the JS module as text and the
 * picture of its slices as PNG bytes. Throws an Error with a plain message when the sheet
 * cannot be used.
 */
export function viewsToModel(sheetPng, options = {}) {
  const sideNose = options.sideNose ?? 'left'
  const topNose = options.topNose ?? 'down'
  const most = options.colours ?? 16
  if (sideNose !== 'left' && sideNose !== 'right') fail('--side-nose is left or right')
  if (topNose !== 'down' && topNose !== 'up') fail('--top-nose is down or up')
  if (!Number.isInteger(most) || most < 1 || most > MOST_COLOURS) fail(`--colours is a whole number from 1 to ${MOST_COLOURS}`)

  let views = findViews(readSheet(sheetPng))
  if (!options.keepOutline) views = Object.fromEntries(Object.entries(views).map(([name, view]) => [name, stripOutline(view)]))
  const colours = sharePalette(Object.values(views), most)

  const width = views.top.w
  const length = views.top.h
  // the side view's height at the top view's scale
  const height = Math.max(1, Math.round((views.side.h * length) / views.side.w))
  if (height > 255) fail(`the model would be ${height} slices tall. Is the side view the widest drawing?`)

  // Everything in the model's directions: i left to right, k front to back, z from the ground up.
  // Seen from above with its nose down the sheet, or from the front, an object's right side is on the left.
  const top = lay(views.top, width, length, topNose === 'down' ? (u, v) => [1 - u, 1 - v] : (u, v) => [u, v])
  const side = lay(views.side, length, height, sideNose === 'left' ? (u, v) => [u, 1 - v] : (u, v) => [1 - u, 1 - v])
  const front = lay(views.front, width, height, (u, v) => [1 - u, 1 - v])
  const back = lay(views.back, width, height, (u, v) => [u, 1 - v])

  const at = (i, k, z) => (z * length + k) * width + i
  const kind = new Int16Array(width * length * height).fill(-1) // the colour number of each cell
  const filled = (i, k, z) => i >= 0 && k >= 0 && i < width && k < length && kind[at(i, k, z)] !== -1
  for (let z = 0; z < height; z++) {
    for (let k = 0; k < length; k++) {
      if (side[z * length + k] < 0) continue
      for (let i = 0; i < width; i++) {
        if (top[k * width + i] >= 0 && (front[z * width + i] >= 0 || back[z * width + i] >= 0)) kind[at(i, k, z)] = -2
      }
    }
  }
  for (let z = height - 1; z >= 0; z--) {
    for (let k = 0; k < length; k++) {
      for (let i = 0; i < width; i++) {
        if (kind[at(i, k, z)] === -1) continue
        let colour = top[k * width + i]
        if (z < height - 1 && kind[at(i, k, z + 1)] !== -1) {
          // covered: which edge of the slice is nearest, and how far in is this cell?
          let face = 0
          let deep = Infinity
          for (let way = 0; way < 4; way++) {
            const di = way === 0 ? -1 : way === 1 ? 1 : 0
            const dk = way === 2 ? -1 : way === 3 ? 1 : 0
            let steps = 1
            while (filled(i + di * steps, k + dk * steps, z)) steps++
            if (steps < deep) {
              deep = steps
              face = way
            }
          }
          if (deep > EDGE) colour = kind[at(i, k, z + 1)]
          else {
            let seen = -1
            if (face < 2) seen = rowColour(side, length, z, k)
            else if (face === 2) seen = rowColour(front, width, z, i)
            else seen = rowColour(back, width, z, i)
            if (seen < 0) seen = rowColour(face === 2 ? back : front, width, z, i)
            if (seen >= 0) colour = seen
          }
        }
        kind[at(i, k, z)] = colour
      }
    }
  }

  // Only the colours the model uses, in the order they are met, three palette entries each.
  const number = new Map()
  const palette = [null]
  const tone = (c, by) => c.map((value) => Math.round(value * by))
  let grid = new Uint8Array(kind.length)
  let cells = 0
  for (let p = 0; p < kind.length; p++) {
    if (kind[p] < 0) continue
    if (!number.has(kind[p])) {
      number.set(kind[p], number.size)
      palette.push(tone(colours[kind[p]], DARK), tone(colours[kind[p]], MID), colours[kind[p]])
    }
    grid[p] = 1 + 3 * number.get(kind[p])
    cells++
  }
  if (cells === 0) fail('the views do not overlap anywhere, so the model is empty. Check --side-nose and --top-nose')
  const size = { width, length, height }
  if (options.flat) grid = grid.map((index) => (index ? index + 2 : 0))
  else grid = shadeGrid(grid, size)

  return { size, palette, grid, cells, text: moduleText(size, palette, grid, options.name ?? 'a sheet'), preview: previewPng(size, palette, grid) }
}

function moduleText(size, palette, grid, name) {
  const lines = [
    `// Made by \`bun run views\` from ${name}: a sprite stack cut from four flat views.`,
    '// Do not edit by hand. Change the drawing and run the tool again.',
    '//',
    "//   import { buildModel, decodeGrid } from './model.js'",
    '//   const grid = decodeGrid(GRID, SIZE.width * SIZE.length * SIZE.height)',
    '//   const model = buildModel(grid, { ...SIZE, pivotK: SIZE.length >> 1, pivotZ: 0, palette: PALETTE })',
    '//',
    '// The palette holds three tones for each colour: dark, mid, light. The grid is already shaded.',
    '',
    `export const SIZE = { width: ${size.width}, length: ${size.length}, height: ${size.height} }`,
    'export const PALETTE = [',
    '  null,',
  ]
  for (let n = 1; n < palette.length; n += 3) lines.push(`  ${[0, 1, 2].map((t) => `[${palette[n + t].join(', ')}]`).join(', ')},`)
  lines.push(']', `export const GRID = '${encodeGrid(grid)}'`, '')
  return lines.join('\n')
}

/** The slices side by side, the ground slice on the left, each with its front at the top. */
function previewPng(size, palette, grid) {
  const { width, length, height } = size
  const w = height * (width + 1) + 1
  const h = length + 2
  const rgba = new Uint8Array(w * h * 4)
  for (let p = 0; p < w * h; p++) rgba.set(PREVIEW_BACK, p * 4)
  for (let z = 0; z < height; z++) {
    for (let k = 0; k < length; k++) {
      for (let i = 0; i < width; i++) {
        const index = grid[(z * length + k) * width + i]
        if (index) rgba.set(palette[index], ((k + 1) * w + 1 + z * (width + 1) + i) * 4)
      }
    }
  }
  return encodePng(rgba, w, h, PREVIEW_SCALE)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const takesValue = ['--out', '--side-nose', '--top-nose', '--colours']
  const alone = ['--flat', '--keep-outline']
  const given = {}
  const files = []
  try {
    for (let n = 0; n < args.length; n++) {
      if (takesValue.includes(args[n])) {
        if (args[n + 1] === undefined) fail(`${args[n]} needs a value`)
        given[args[n]] = args[++n]
      } else if (alone.includes(args[n])) given[args[n]] = true
      else if (args[n].startsWith('--')) fail(`there is no ${args[n]}. The flags are ${[...takesValue, ...alone].join(', ')}`)
      else files.push(args[n])
    }
    if (files.length !== 1) fail('give one sheet: bun run views <sheet.png> [--out file] [--side-nose left|right] [--top-nose down|up] [--colours n] [--flat] [--keep-outline]')
    const sheet = resolve(files[0])
    let bytes
    try {
      bytes = readFileSync(sheet)
    } catch {
      fail(`cannot read ${files[0]}`)
    }
    const out = resolve(given['--out'] ?? join(dirname(sheet), `${basename(sheet).replace(/\.png$/i, '')}.js`))
    if (out === sheet) fail('--out would replace the sheet')
    const result = viewsToModel(bytes, {
      sideNose: given['--side-nose'],
      topNose: given['--top-nose'],
      colours: given['--colours'] === undefined ? undefined : Number(given['--colours']),
      flat: given['--flat'],
      keepOutline: given['--keep-outline'],
      name: basename(sheet),
    })
    const picture = `${out.replace(/\.[cm]?js$/i, '')}.slices.png`
    writeFileSync(out, result.text)
    writeFileSync(picture, result.preview)
    const { width, length, height } = result.size
    console.log(`${height} slices of ${width} x ${length}, ${result.cells} cells, ${(result.palette.length - 1) / 3} colours`)
    console.log(out)
    console.log(picture)
    if (width % 2 === 0) console.log(`note: the model is ${width} cells wide. An odd width has a centre column and turns more evenly`)
  } catch (error) {
    if (!(error instanceof ViewsError)) throw error
    console.error(`views: ${error.message}`)
    process.exit(1)
  }
}

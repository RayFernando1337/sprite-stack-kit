---
name: sprite-stack-models
description: "How to make, change, encode and draw sprite-stacked models in sprite-stack-kit: the grid of palette indices, sculpting shapes in code, three-tone shading, run-length base64 encoding, buildModel and drawStack. Use when changing the craft's shape or colours, adding another object (enemy, boat, building, pickup), converting pixel art or slices into a model, fixing holes or wrong draw order in a stack, or adding flames, trails or an outline to a model."
---

# Stacked models

Files: `examples/starter/src/model.js` (data) and `stack.js` (drawing).

## A model is a grid

A model is a `Uint8Array` of palette indices, `width × length × height`. 0 is empty.

- `i` runs across, left to right.
- `k` runs along, front (0) to back.
- `z` runs up, bottom slice (0) to top.
- Cell `(i, k, z)` is at index `(z * length + k) * width + i`.

Keep `width` odd so there is a centre column. The starter's craft is 31 × 42 × 11.

Sizes that work: 8 to 16 slices, 20 to 50 cells a side. More slices cost more to draw and add little.

## Changing the craft

Edit `sculpt()` in `model.js`. It fills the grid with simple shapes through `put(a, k, z, kind)`, where `a` is the distance from the centre line. `put` writes both sides, so the model is always symmetrical.

Each part is a loop with a shape test:

```js
// a round body
if ((a / wide) ** 2 + ((z - 4) / tall) ** 2 <= 1) put(a, k, z, HULL)
```

Use ellipses for bodies, a span that grows with `k` for wings, and a short loop for fins. Later parts overwrite earlier ones.

After a change, run `npm run snapshot -- --view top,chase,apart` and look. The `apart` view pulls the slices apart so you can see each one.

## Colours

`CRAFT_PALETTE` gives every surface three entries in a row: dark, mid, light. `sculpt()` writes the dark one. `shadeGrid()` then looks at which way each cell faces and moves it to mid or light. Shading is done once, when the model is built.

To recolour, change the three rows for that surface. To add a surface, add three rows and a constant for the first of them.

## Building and drawing

```js
const model = buildModel(grid, {
  width, length, height,
  pivotK, pivotZ,          // the cell the model turns about
  palette,                 // [null, [r, g, b], …]
  nozzles: [],             // optional: where flames come from
  wingtips: [],            // optional: where trails come from
})
```

Draw it after the world and the sky:

```js
drawStack(fb, cam, model, pose, time)
// pose = { x, y, z, yaw, roll, pitch, scale, spread, thrust }
```

- `yaw` 0 points north and grows clockwise. Positive `roll` dips the right side. Positive `pitch` lifts the front.
- `spread` is 1 for a solid stack. `thrust` is 0 for no flames.
- Make each pose object once and update its fields. Do not create one per frame.

## Adding another object

1. Make a new file, for example `boat.js`. Fill a grid, call `shadeGrid(grid, size)`, then `buildModel`.
2. In `game.js`, build the model once in `createGame` and keep one pose object for each copy.
3. In `render()`, call `drawStack` for each one after `drawSky`.
4. If objects can overlap, draw the farther one first. `project(cam, x, y, z)` sets `cam.depth`, which you can sort by.

A model that sits on the ground gets `z` from `groundAt(world, x, y)`. A model on the sea uses `z = 0` plus a little.

`drawWorld` takes one shadow caster. To give more objects shadows, extend the caster test in `terrain.js` to loop over a short list.

## Storing a finished model

`encodeGrid(grid)` returns a short string: runs of (count, index) byte pairs, base64 encoded. `decodeGrid(text, size)` reverses it. A stack is mostly empty space and flat colour, so this is small. The starter's craft is about 2,100 characters.

Use this when a model comes from somewhere other than code: paste the string into a source file and decode it at start-up. No image file is needed.

## Models from pixel art

A stack can be drawn by hand: one small image per slice, in any pixel editor. A stack can also be cut from top, side and front drawings of the object: a cell is filled when all three drawings are filled there.

To bring art in, write a one-off Node script that reads the images, fills a grid, and prints `encodeGrid(grid)`. Keep the script out of the game. `scripts/lib/png.mjs` writes PNG files; it does not read them, so the script needs its own reader.

## How drawing works

- Every cell is a small flat tile. `drawStack` projects its centre and fills every pixel inside the tile's outline. Neighbouring tiles overlap by a sliver, so a turned slice has no holes.
- Slices are drawn from the one farthest from eye level to the nearest.
- A cell is skipped where `fb.depth` says the world is nearer.
- At the end, every empty pixel that touches the model is painted with `model.outline`.

## Mistakes to avoid

- **Indices out of range.** A palette index with no palette row draws as black or transparent. Keep the palette and the constants in step.
- **A hollow that shows.** Bodies should be filled, not shells. Wings one layer thick are fine.
- **Wrong pivot.** `pivotK` and `pivotZ` should be near the model's centre of mass, or it will swing when it turns.
- **Looking exactly side-on.** Slices are flat, so a stack seen from eye level thins out. Keep cameras above about 10 degrees, or use more slices.
- **Changing `REACH` in `stack.js`.** Lower values open seams between tiles.

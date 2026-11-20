---
name: sprite-stack-models
description: "How to make, change, encode and draw sprite-stacked models in sprite-stack-kit: the grid of palette indices, sculpting shapes in code, three-tone shading, run-length base64 encoding, buildModel and drawStack, and cutting a model from four flat drawings with bun run views. Use when changing the craft's shape or colours, adding another object (enemy, boat, building, pickup), converting pixel art, a four-view sheet or slices into a model, fixing holes or wrong draw order in a stack, or adding flames, trails or an outline to a model."
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

After a change, run `bun run snapshot --view top,chase,apart` and look. The `apart` view pulls the slices apart so you can see each one. `docs/images/slices.png` shows the starter's slices side by side; `scripts/figures.mjs` draws it and is a short example of reading a model's layers.

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
drawStack(to, cam, model, pose, time)
// pose = { x, y, z, yaw, roll, pitch, scale, spread, thrust, solid }
```

- `yaw` 0 points north and grows clockwise. Positive `roll` dips the right side. Positive `pitch` lifts the front.
- `spread` is 1 for a solid stack. `thrust` is 0 for no flames.
- `solid` is 1 to draw every pixel. Lower values leave pixels out in the dither pattern, so the stack dissolves. Leave it out and it is 1.
- `to` is the picture `render()` is drawing the world on. It is the frame, or the sheet when the view is banked.
- Make each pose object once and update its fields. Do not create one per frame.

## Adding another object

1. Make a new file, for example `boat.js`. Fill a grid, call `shadeGrid(grid, size)`, then `buildModel`.
2. In `game.js`, build the model once in `createGame` and keep one pose object for each copy.
3. In `render()`, call `drawStack(to, …)` for each one after `drawSky` and before `pasteRolled`.
4. If objects can overlap, draw the farther one first. `project(cam, x, y, z)` sets `cam.depth`, which you can sort by. Use the point where each object touches the ground, and sort whole stacks. Never mix the slices of two stacks.

A model that sits on the ground gets `z` from `groundAt(world, x, y)`. A model on the sea uses `z = 0` plus a little.

`drawWorld` takes one shadow caster. For other craft, first try a blob: after the world is drawn, darken a small ellipse of ground under each one, as `drawShadow` in `examples/worldfight/src/game.js` does. For shadows with the model's own outline, extend the caster test in `terrain.js` to loop over a short list.

**More than one model in a game.** The checks read `CRAFT_W`, `CRAFT_L`, `CRAFT_H` and `sculptGrid` together with `buildCraft`, so keep all five describing the same model. Every other model gets its own sizes and its own build function. `game.model` may be a getter, for a craft that changes shape. The starter's `buildModel` has one flame for every model and no gun mounts. `examples/worldfight/src/model.js` adds `flame` and `guns` to its spec.

## Storing a finished model

`encodeGrid(grid)` returns a short string: runs of (count, index) byte pairs, base64 encoded. `decodeGrid(text, size)` reverses it. A stack is mostly empty space and flat colour, so this is small. The starter's craft is about 2,100 characters.

Use this when a model comes from somewhere other than code: paste the string into a source file and decode it at start-up. No image file is needed.

## Models from pixel art

- **Four flat views.** `bun run views <sheet.png>` cuts a model from one PNG with top, side, front and back drawings, and writes a module with `SIZE`, `PALETTE` and `GRID`, plus a picture of the slices. Read `four-views.md`, beside this file, before you use it.
- **Slices drawn by hand.** One small image per slice. Write a one-off Bun script that reads them with `decodePng` from `scripts/lib/png.mjs`, fills a grid and prints `encodeGrid(grid)`. Keep the script out of the game.

Art for either route: flat fills, few colours, no soft edges, and no outline in the slices. `drawStack` outlines the finished stack once. An outline in every slice shows as dark specks inside the body when it turns.

These points, and the checks below, are from SpriteCook's article [Sprite stacking for fake 3D pixel art cars and props](https://www.spritecook.ai/blog/sprite-stacking-pixel-art).

## Camera height, and a stack that never turns

The article lowers the camera by squashing every slice to, say, 75% of its height before lifting it. Here that number is `cam.tilt`: on screen a point is at `height + tilt × depth`, so ground distances are scaled by `tilt` and each slice still rises one pixel. `tilt` 1 is the article's squash 1, and 0.75 is its squash 0.75. Do not squash the model itself.

Every stack costs one pass over all its cells each frame. A stack that never turns, under a camera whose `heading`, `tilt` and `zoom` never change and whose `persp` is 0, always looks the same. Draw it once at start-up with `drawStack` into its own `createFramebuffer()`, then copy the pixels that are not `EMPTY` each frame. A copy like this skips the depth test, so hills and clouds will not hide it. In any view that turns or has perspective, call `drawStack` every frame.

## Check the size

With `persp` 0, `tilt` 1, `zoom` 1 and a pose of `yaw` 0, `scale` 1, `spread` 1:

- The stack is `width` pixels wide and at most `length + height − 1` tall, plus the outline. It is less when the top or bottom slices are shorter than the rest.
- Every pixel equals the slices pasted by hand, slice `z` drawn `z` pixels higher.
- With `yaw` at 90° it is `length` wide. With `tilt` 0.75 it is shorter. With `spread` 2 it is taller.

`tests/views.test.js` does these for a model cut from four views. Copy its `drawFlat` when a new model draws at the wrong size.
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
- **A stack right in front of the eye.** In the cockpit view another object can come very close. Fade it with `solid` by its `eyeDistance`, as `settle()` in `game.js` does for the craft.
- **A small stack that turns.** A turning stack changes in whole-pixel jumps, and on a small one every jump shows. Draw it larger with `pose.scale` or `cam.zoom`.
- **Changing `REACH` in `stack.js`.** Lower values open seams between tiles.

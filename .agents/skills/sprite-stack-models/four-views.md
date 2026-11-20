# A model from four flat views

`bun run views` cuts a stack from one PNG that holds four drawings of an object: from the top, the side, the front and the back. It suits simple, boxy things: cars, boats, crates, houses. The method is from SpriteCook's article [Sprite stacking for fake 3D pixel art cars and props](https://www.spritecook.ai/blog/sprite-stacking-pixel-art). The tool, `scripts/views.mjs`, is this kit's own code.

## The sheet

- An 8-bit RGB or RGBA PNG. The background is transparent, or one flat colour: the colour of the top-left pixel.
- Four drawings with at least 3 empty pixels between them, all at the same scale.
- The tallest drawing is taken as the top view. The widest of the other three is the side view. The last two are the front, then the back, in reading order. A 2 × 2 sheet with top, side, front, back works. An object that is not clearly longer than it is wide can be misread, so check the picture the tool writes.
- The top view points down the sheet and the side view faces left. Otherwise pass `--top-nose up` or `--side-nose right`.
- Flat fills, a few colours, stripes at least 2 pixels wide. Soft edges and in-between shades smear when the slices turn.
- A dark 1-pixel outline round each drawing is fine and helps the tool find it. The tool removes it, because `drawStack` outlines the finished stack. If the art has no outline, pass `--keep-outline`, or dark parts on the edge of a drawing that are 1 or 2 pixels thin take the colour beside them.

## Run it

```sh
bun run views art/car.png --out examples/<name>/src/car-data.js
```

| Flag | Meaning |
| --- | --- |
| `--out file` | Where the module goes. Without it: beside the sheet, with the sheet's name |
| `--side-nose left\|right` | Which way the side view faces. `left` unless given |
| `--top-nose down\|up` | Which way the top view points. `down` unless given |
| `--colours n` | The most colours to keep, 1 to 84. 16 unless given |
| `--flat` | No shading: every cell keeps the sheet's colour |
| `--keep-outline` | Do not remove dark edge pixels |

It writes the module and, next to it, `<name>.slices.png`: every slice side by side, ground slice on the left, front at the top. Look at that picture. The same sheet and flags always give the same files.

## Use the model

The module exports `SIZE` (`{ width, length, height }`), `PALETTE` and `GRID`.

```js
import { buildModel, decodeGrid } from './model.js'
import { SIZE, PALETTE, GRID } from './car-data.js'

const grid = decodeGrid(GRID, SIZE.width * SIZE.length * SIZE.height)
const car = buildModel(grid, { ...SIZE, pivotK: SIZE.length >> 1, pivotZ: 0, palette: PALETTE })
```

`pivotZ: 0` puts `pose.z` at the bottom slice, which is right for a thing that stands on the ground.

## How it decides

- **Size.** The model is as wide and as long as the top view. Its height is the side view's height at the top view's scale: `side height × top length ÷ side width`, rounded. The side, front and back views are stretched to fit, without blending.
- **Cells.** Each row of the side view is one slice. A cell is filled where the top view, the side view, and the front or the back view are all filled.
- **Colours.** The top cell of each column takes the top view's colour. A covered cell within 2 cells of its slice's edge takes the colour of the view on that side, from the same row. A covered cell deeper in takes the colour of the cell above it.
- **Palette.** Each colour kept from the sheet gets three entries in a row: dark (62%), mid (80%) and light (the sheet's own colour). The tool runs `shadeGrid` on the grid, so the module is ready to draw. With `--flat` every cell holds the light entry. The colour group of an index `n` is `(n - 1) / 3`, rounded down.

## What it cannot make

Flat views cannot describe a hole or an overhang. A truck bed, an arch or a spoiler above the boot comes out solid. Clear those cells after decoding:

```js
// empty a truck bed: cells 2 to 8 across, 14 to 20 along, from slice 3 up
for (let z = 3; z < SIZE.height; z++)
  for (let k = 14; k <= 20; k++)
    for (let i = 2; i <= 8; i++) grid[(z * SIZE.length + k) * SIZE.width + i] = 0
```

The tool warns when the width is even. Add or remove a column in the art so the model has a centre column.

## It is tested

`tests/views.test.js` draws a small car's four views, runs the tool, and draws the result with `buildModel` and `drawStack`. It checks the size, that cells exist only where the views agree, and that the flat overhead picture equals the slices pasted by hand one pixel apart.

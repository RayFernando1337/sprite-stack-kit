---
name: sprite-stack-game
description: "Build or extend a pixel-art game that looks 3D with no 3D engine, using sprite stacking on a hand-written software renderer. Use when the user asks for a game like the pixel fighter jet demo, mentions sprite stacking, 'no polygons' or 'no 3D engine', wants to fork or reskin the starter in examples/starter, or wants a new game in this style (flight, boats, racing, a top-down adventure). Read this first: it gives the rules, the file map, the working loop, and which other skill covers each kind of change."
---

# Building a game with sprite-stack-kit

## The idea

The whole game is drawn by plain JavaScript into one small picture, about 400 × 240 pixels, which the page shows scaled up with hard edges. Objects are **sprite stacks**: piles of flat pixel slices, one per layer of height. The ground is a height map drawn as stacked columns from near to far. One short camera formula gives both a flat overhead view and a view from behind.

`docs/how-it-works.md` explains all of it in plain language. Read it once before your first change.

## Rules that do not bend

1. **One low-resolution picture.** Every game object is written into `fb.color` pixel by pixel. No canvas path drawing and no DOM elements for game objects. Text and buttons are DOM elements over the canvas.
2. **No 3D engine, no WebGL, no libraries, no network.** `npm test` fails if a game breaks this.
3. **No image or sound files** unless the user asks for them. Shapes are built in code or stored as encoded grids in the source.
4. **Repeatable.** The same seed and input draw the same frames. No `Math.random()` and no clock in game code. Use `makeRng` and `hash2` from `rng.js`.
5. **Nothing is created in the frame loop.** Make typed arrays and objects once and reuse them.
6. **Fades use dithering, not blending.** Fog comes in steps.

## Where things are

All paths are in `examples/starter/src`.

| File | Holds | Skill |
| --- | --- | --- |
| `framebuffer.js` | The picture, the depth array, colour helpers, the dither pattern | `software-framebuffer` |
| `model.js` | The craft as a grid of slices; `buildModel`, `encodeGrid` | `sprite-stack-models` |
| `stack.js` | `drawStack`: draws any stacked model through the camera | `sprite-stack-models` |
| `world.js` | Height map, materials, clouds, palette, from a seed | `stacked-terrain` |
| `terrain.js` | `drawWorld` and `drawSky` | `stacked-terrain` |
| `camera.js` | The camera formula, `project`, `aimCamera` | `one-camera-views` |
| `game.js` | Flight, camera motion, draw order, `TUNING` | `game-feel` |
| `main.js` | Canvas size, input events, the frame loop | `software-framebuffer` |
| `rng.js` | Seeded random numbers, tileable noise | |

## The working loop

1. Pick the smallest change that will be visible.
2. Make it.
3. Run `npm test`.
4. Run `npm run snapshot` and look at the PNG files in `snapshots/`. Do not skip this when you change drawing. A frame can pass every check and still look wrong.
5. If you changed input, run `npm start` and try it in a browser.

The `check-your-work` skill has the details.

## Three kinds of request

**Reskin: "make it a dragon over a desert".** Change the shape in `sculpt()` and the colours in `CRAFT_PALETTE` (`model.js`). Change `MATERIALS` and the land rules in `buildWorld()` (`world.js`). Adjust `TUNING` (`game.js`). Nothing else needs to change.

**New feature: "add enemies", "add a cockpit view", "add sound".** Read the matching skill. Put the feature in its own file and call it from `game.js`. If Dash's game has the feature, the `study-the-reference` skill tells you where to read how he did it.

**New game: "make a boat game in this style".** Copy the starter and work in the copy:

```sh
cp -r examples/starter examples/boats
node scripts/serve.mjs examples/boats
npm test -- --game examples/boats
node scripts/snapshot.mjs --game examples/boats
```

The checks and the snapshot tool work on a copy as long as it keeps the starter's file names and the functions they export.

## What fits this approach

It suits anything seen from above or from behind over a landscape: flying, sailing, hovering, racing across terrain, a top-down adventure, a city flyover.

It has two limits. Say so early if a request runs into one.

- **The ground has one height per pixel.** There are no caves, bridges, tunnels or overhangs.
- **A stack is made of flat slices.** It looks solid from above or at an angle. Seen exactly from the side it thins to lines. An object that tumbles through every angle needs each cell drawn as a small cube instead. Dash's `voxel-sprite.ts` does this for the pilot.

## Before you finish

Run `npm test`. Look at a fresh snapshot. Update the README or the skill if behaviour changed. If you used someone's idea, add them to `CREDITS.md`.

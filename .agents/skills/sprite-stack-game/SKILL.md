---
name: sprite-stack-game
description: "Build or extend a pixel-art game that looks 3D with no 3D engine, using sprite stacking on a hand-written software renderer. Use when the user asks for a game like the pixel fighter jet demo, mentions sprite stacking, 'no polygons' or 'no 3D engine', wants to fork or reskin the starter in examples/starter, or wants a new game in this style (flight, boats, racing, a top-down adventure). Read this first: it gives the rules, the file map, the working loop, and which other skill covers each kind of change."
---

# Building a game with sprite-stack-kit

If the user wants a whole game made, follow `START.md` at the top of the repository. It has the questions to ask and the order to build in.

## The idea

The whole game is drawn by plain JavaScript into one small picture, about 400 × 240 pixels, which the page shows scaled up with hard edges. Objects are **sprite stacks**: piles of flat pixel slices, one per layer of height. The ground is a height map drawn as stacked columns from near to far. One short camera formula gives a flat overhead view, a view from behind and a view from the cockpit.

`docs/how-it-works.md` explains all of it in plain language, with pictures. Read it once before your first change. `docs/deep-dive.md` has the reasoning behind each formula, and `docs/glossary.md` has the terms.

## Rules that do not bend

1. **One low-resolution picture.** Every game object is written into `fb.color` pixel by pixel. No canvas path drawing and no DOM elements for game objects. Hints and buttons are DOM elements over the canvas.
2. **No 3D engine, no WebGL, no libraries, no network.** `bun run check` fails if a game breaks this.
3. **No image or sound files** unless the user asks for them. Shapes are built in code or stored as encoded grids in the source.
4. **Repeatable.** The same seed and input draw the same frames. No `Math.random()` and no clock in game code. Use `makeRng` and `hash2` from `rng.js`.
5. **Nothing is created in the frame loop.** Make typed arrays and objects once and reuse them.
6. **Fades use dithering, not blending.** Fog comes in steps.
7. **Bun runs everything.** Use `bun` for every command. Do not use npm, and do not add dependencies.

## Where things are

All paths are in `examples/starter/src`.

| File | Holds | Skill |
| --- | --- | --- |
| `framebuffer.js` | The picture, the depth array, colour helpers, the dither pattern | `software-framebuffer` |
| `model.js` | The craft as a grid of slices; `buildModel`, `encodeGrid` | `sprite-stack-models` |
| `stack.js` | `drawStack`: draws any stacked model through the camera | `sprite-stack-models` |
| `world.js` | Height map, materials, clouds, palette, from a seed | `stacked-terrain` |
| `terrain.js` | `drawWorld` and `drawSky` | `stacked-terrain` |
| `camera.js` | The camera formula, `project`, and the three poses in `aimCamera` | `one-camera-views` |
| `roll.js` | Turns the picture of the world, so the cockpit view can bank | `one-camera-views` |
| `cockpit.js` | The cockpit: painted layers, live instruments, head-up display | `cockpit-and-hud` |
| `paint.js` | Dots, boxes, lines, discs and a 3 × 5 pixel font | `cockpit-and-hud` |
| `game.js` | Flight, camera motion, draw order, `TUNING` | `game-feel`, `one-camera-views` |
| `main.js` | Canvas size, input events, the frame loop | `software-framebuffer` |
| `rng.js` | Seeded random numbers, tileable noise | |

## The working loop

1. Pick the smallest change that will be visible.
2. Make it.
3. Run `bun run check`. For anything with states or modes, add it to the game's `states.js` first and run `bun run states` (`verify-states` skill).
4. Run `bun run snapshot` and look at the PNG files in `snapshots/`. Do not skip this when you change drawing. A frame can pass every check and still look wrong.
5. If you changed input, run `bun start` and try it in a browser.

The `check-your-work` skill has the details.

## Three kinds of request

**Reskin: "make it a dragon over a desert".** Change the shape in `sculpt()` and the colours in `CRAFT_PALETTE` (`model.js`). Change `MATERIALS` and the land rules in `buildWorld()` (`world.js`). Adjust `TUNING` (`game.js`). If the new world has no sea, or the new craft has no wings, see "What the tools need from a game" below.

**New feature: "add enemies", "add a radar to the cockpit", "add sound".** Read the matching skill. Put the feature in its own file and call it from `game.js`. If Dash's game has the feature, the `study-the-reference` skill tells you where to read how he did it.

**New game: "make a boat game in this style".** Copy the starter and work in the copy:

```sh
cp -r examples/starter examples/boats
bun scripts/serve.mjs examples/boats
bun run check --game examples/boats
bun run snapshot --game examples/boats
```

The checks and the snapshot tool work on a copy as long as it keeps the starter's file names and the names in the next section.

## What the tools need from a game

`bun run check`, `bun run states` and `bun run snapshot` drive a copy through the starter's names. Keep these, with whatever meaning suits the game. A balloon's hold can light a burner; its click can be a slow twirl.

| File | Keep |
| --- | --- |
| `game.js` | `createGame`, `VIEWS`, `TUNING`. On the game: `update`, `render`, `resize`, `setKeys`, `pointerMove`, `press`, `release`, `roll`, `nextView`, `view`, `chaseAmount`, `boost`, `world`, `model`, `camera`, and `craft` with `x`, `y`, `z`, `yaw`, `spin` |
| `world.js` | `buildWorld`, `groundAt`, `GROUND_MAX`, `CLOUD_LAYERS`, `MAT` |
| `model.js` | `sculptGrid`, `encodeGrid`, `decodeGrid`, `buildCraft`, `CRAFT_W`, `CRAFT_L`, `CRAFT_H`. The model is the same left and right, and has an `outline` colour |
| `camera.js`, `framebuffer.js` | As they are |

The checks also expect this behaviour: the right key turns the craft clockwise, pointing up climbs, a click sets `craft.spin` to 0, a hold lifts `boost` above 0.6, and a held dive never reaches the ground. How fast any of it happens is the game's own tuning.

What a game may delete:

- **No cockpit.** Take `'cockpit'` out of `VIEWS`. Then `cockpit.js`, `roll.js`, `cockpitAmount`, `viewRoll` and the code that uses them can go. So can the rules in `states.js` that name the cockpit.
- **No sea.** Take `LAND_SHARE` out of `world.js`, and the check on it is skipped. `terrain.js` and the spawn code in `world.js` use `MAT.SEA`, `MAT.SHALLOW`, `MAT.SURF` and `WATER_BELOW` by name, so change those lines too.
- **No trails or flames.** Leave `wingtips` or `nozzles` out of the model.
- **No pulling the stack apart.** Delete `toggleSpread`, its key, and its step in `states.js`.
## What fits this approach

It suits anything seen from above, from behind or from a driver's seat over a landscape: flying, sailing, hovering, racing across terrain, a top-down adventure, a city flyover.

It has two limits. Say so early if a request runs into one.

- **The ground has one height per pixel.** There are no caves, bridges, tunnels or overhangs.
- **A stack is made of flat slices.** It looks solid from above or at an angle. Seen exactly from the side it thins to lines. An object that tumbles through every angle needs each cell drawn as a small cube instead. Dash's `voxel-sprite.ts` does this for the pilot.

## Before you finish

Run `bun run check`. Look at a fresh snapshot. If you changed what the starter draws, run `bun run figures` so the documents' pictures match. Update the README, the skill and the documents if behaviour changed. If you used someone's idea, add them to `CREDITS.md`.

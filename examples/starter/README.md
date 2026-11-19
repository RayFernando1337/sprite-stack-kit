# The starter game

A small flight demo that shows every technique in the kit. Fork it, or copy this folder to `examples/<your-game>` and change it.

Run it from the repository root with `npm start`.

## The files, in the order to read them

| File | What it does | Lines to change first |
| --- | --- | --- |
| `src/framebuffer.js` | The low-resolution picture: one number per pixel, a depth per pixel, colour helpers, the dither pattern | |
| `src/camera.js` | The one formula that turns a world point into a screen pixel | |
| `src/model.js` | The craft as a grid of slices, built from simple shapes | `sculpt()` for the shape, `CRAFT_PALETTE` for the colours |
| `src/stack.js` | Draws a stack at any heading, bank and pitch, with its outline and flames | |
| `src/world.js` | Islands and clouds from a seed, and the world's colours | `MATERIALS` for the colours, `buildWorld()` for the land |
| `src/terrain.js` | Draws the world as stacked columns from near to far, with shadows, fog and sky | |
| `src/game.js` | How the craft flies, where the camera sits, the order things are drawn in | `TUNING` at the top |
| `src/main.js` | The page: canvas size, input, the frame loop | The key bindings |
| `src/rng.js` | Seeded random numbers and noise that tiles | |

## Three quick experiments

1. In `src/game.js`, change `chaseAngle` from `15` to `30`. The chase camera now looks down more steeply.
2. In `src/model.js`, change the `TRIM` rows of `CRAFT_PALETTE` (entries 4 to 6) to three blues. The wingtips change colour.
3. Open `http://localhost:5173/?seed=42`. A different world appears, and it is the same every time for that seed.

## What it promises

`npm test` checks these, so you will know if a change breaks one:

- The same seed gives the same world, and the same seed and input give the same frame.
- Both views fill every pixel at landscape, portrait and wide sizes.
- Every frame of a view change is complete.
- The craft cannot be flown into the ground.
- A frame takes far less than a sixtieth of a second.
- There are no libraries, no network requests and no WebGL.

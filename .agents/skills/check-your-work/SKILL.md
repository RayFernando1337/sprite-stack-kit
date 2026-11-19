---
name: check-your-work
description: "How to verify a change in sprite-stack-kit: the headless checks (npm test), saving and looking at frames (npm run snapshot), trying the game in a browser, measuring frame time, and adding a check for a new feature. Use before saying any change to a game is done, when a frame looks wrong, when something is slow, or when adding a feature that needs its own check."
---

# Checking a change

A game can run without errors and still be wrong: a blank band of sky, a craft drawn behind a hill, steering that works in one view only. Check with the tools below before you report a change as done.

## 1. Run the checks

```sh
npm test
npm test -- --game examples/my-game   # for a copy of the starter
```

It runs the game in Node with no browser and takes a few seconds. It checks that:

- the encoded model decodes to the same grid, and the model is symmetrical
- the same seed gives the same world, and land covers the share asked for
- nothing in the world is taller than the renderer allows
- the camera formula puts known points on known pixels
- both views fill every pixel at three frame shapes, and the craft is on screen
- every frame of a view change is complete
- the same seed and input draw the same frame
- a turn, a click and a hold each do what they should
- a held dive never reaches the ground
- a frame fits easily in a sixtieth of a second
- the game uses no libraries, no network and no WebGL

If a check fails, fix the cause. Do not loosen the check unless the promise itself has changed, and say so if it has.

## 2. Look at frames

```sh
npm run snapshot
```

This writes PNG files to `snapshots/`. Open them and look. If you can read images, read them yourself.

| Option | Effect |
| --- | --- |
| `--view top,chase,between,apart` | Which frames to save. `between` is half-way through a view change. `apart` pulls the slices apart |
| `--seed 3` | A different world |
| `--seconds 6` | How long to fly before the frame is taken |
| `--turn 1` | Hold a turn (−1 to 1) |
| `--boost` | Hold the thrusters |
| `--width 480 --height 270` | Frame size |
| `--scale 3` | How much to enlarge the saved image |
| `--game examples/my-game` | Use a copy of the starter |
| `--out some/folder` | Where to save |

What to look for:

- **Empty or single-colour bands.** The sweep stopped early or started late.
- **The craft missing or sliced.** A depth test is wrong, or the draw order changed.
- **Holes in the craft.** Seams between cells.
- **Stripes or shimmer in the distance.** The depth step is too coarse.
- **Colours that are off.** A palette index points at the wrong row.
- **The `between` frame.** It should look like a normal picture from an odd angle.

Take frames at more than one seed and with a turn held. One good frame proves little.

## 3. Try it in a browser

Do this when you changed input, the page, or anything that depends on timing.

```sh
npm start
```

Open the address it prints and try: steering with the pointer in both views, a click, a hold, the keys, Space, resizing the window, and a narrow phone-shaped window. Open the browser's console and confirm there are no errors.

If you drive a browser from a tool, keep the tab visible. A hidden tab slows its animation to a crawl, and the game will seem stuck.

## 4. Measure speed when you touch drawing

`npm test` prints milliseconds per frame for both views. Compare before and after your change. A frame has 16.6 milliseconds at 60 frames per second, and slow phones need a wide margin. If your change doubles the time, find out why before going on.

Common causes: allocating inside the loop, a per-pixel function call that could be a table, or a larger picture.

## 5. Add a check for a new promise

When you add a feature that must keep working, add a check to `scripts/check.mjs`:

```js
{
  const game = createGame({ seed: 7 })
  game.resize(384, 240)
  fly(game, 60)
  check('enemies: three are in the air after a second', game.enemies.length === 3, `${game.enemies.length} enemies`)
}
```

`fly(game, frames, each)` advances the game at 60 steps a second and returns the last frame. `check(name, ok, detail)` records the result. Write the name as a plain statement of what should be true.

## Before you report

- `npm test` passes, and you ran it after your last edit.
- You looked at fresh snapshots.
- You tried it in a browser if input or the page changed.
- The README and the matching skill still describe what the code does.
- You say plainly what you checked and what you did not.

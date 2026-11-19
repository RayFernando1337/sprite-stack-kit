---
name: check-your-work
description: "How to verify a change in sprite-stack-kit: the headless checks (bun run check, bun test), saving and looking at frames (bun run snapshot), trying the game in a browser, measuring frame time, redrawing the documents' figures, and adding a check for a new feature. Use before saying any change to a game is done, when a frame looks wrong, when something is slow, or when adding a feature that needs its own check."
---

# Checking a change

A game can run without errors and still be wrong: a blank band of sky, a craft drawn behind a hill, steering that works in one view only. Check with the tools below before you report a change as done.

## 1. Run the checks

```sh
bun run check
bun run check --game examples/my-game   # for a copy of the starter
bun test                                # the same checks, through Bun's test runner
```

They run the game with no browser and take a few seconds. They check that:

- the encoded model decodes to the same grid, and the model is symmetrical
- the same seed gives the same world, and land covers the share asked for
- nothing in the world is taller than the renderer allows
- the camera formula puts known points on known pixels
- every view fills every pixel at three frame shapes, with the craft on screen from above and behind and out of sight from the cockpit
- the craft is solid in the chase view, however the chase camera is tuned
- every view still draws in a frame that is tiny, very tall or very wide
- the camera slides one way through all three views, and every frame on the way is complete
- in the cockpit the eye stays in the craft, the picture banks with it, and a barrel roll turns the picture once and leaves it level
- a turned sheet covers the whole frame at every angle, and a right bank lifts the right end of the horizon
- the same seed and input draw the same frame
- a turn, a click and a hold each do what they should, and pointing steers from behind and from the cockpit
- a held dive never reaches the ground
- a frame fits easily in a sixtieth of a second, in every view
- the game uses no libraries, no network, no WebGL and no `Math.random()`
- the game keeps the rules in its state map in every state it can reach
- the local server serves the folder it is given

If a check fails, fix the cause. Do not loosen the check unless the promise itself has changed, and say so if it has.

## 2. Walk every state

```sh
bun run states
```

This tries every order of the player's steps on the real game and checks the rules in the game's `states.js`. Run it after any change to views, modes, input or anything else with states. `bun run check` runs it too, as one line. The `verify-states` skill explains the map and how to add to it.

## 3. Look at frames

```sh
bun run snapshot
```

This writes PNG files to `snapshots/`. Open them and look. If you can read images, read them yourself.

| Option | Effect |
| --- | --- |
| `--view top,chase,cockpit,between,entering,apart` | Which frames to save. `between` is half-way from overhead to chase. `entering` is half-way from chase into the cockpit. `apart` pulls the slices apart |
| `--seed 3` | A different world |
| `--seconds 6` | How long to fly before the frame is taken |
| `--turn 1` | Hold a turn (−1 to 1) |
| `--climb 1` | Hold a climb or a dive (−1 to 1) |
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
- **The `between` and `entering` frames.** Each should look like a normal picture from an odd angle.
- **The cockpit with `--turn 1`.** The horizon, the head-up display and the attitude ball should all tilt the same way, and no corner of the view should be blank.
- **The cockpit at a phone shape**, `--width 200 --height 420`. Nothing on the dashboard should overlap or fall off the edge.

Take frames at more than one seed and with a turn held. One good frame proves little.

## 4. Try it in a browser

Do this when you changed input, the page, or anything that depends on timing.

```sh
bun start
```

Open the address it prints and try: steering with the pointer in all three views, a click, a hold, the keys, Space three times, resizing the window, and a narrow phone-shaped window. Open the browser's console and confirm there are no errors.

If you drive a browser from a tool, keep the tab visible. A hidden tab slows its animation to a crawl, and the game will seem stuck.

## 5. Measure speed when you touch drawing

`bun run check` prints milliseconds per frame for each view. Compare before and after your change. A frame has 16.6 milliseconds at 60 frames per second, and slow phones need a wide margin. If your change doubles the time, find out why before going on.

Common causes: allocating inside the loop, a per-pixel function call that could be a table, repainting something every frame that could be painted once, or a larger picture.

## 6. Add a check for a new promise

When you add a feature that must keep working, add a check inside `runChecks()` in `scripts/check.mjs`:

```js
{
  const game = createGame({ seed: 7 })
  game.resize(384, 240)
  fly(game, 60)
  check('enemies: three are in the air after a second', game.enemies.length === 3, `${game.enemies.length} enemies`)
}
```

`fly(game, frames, each)` advances the game at 60 steps a second and returns the last frame. `check(name, ok, detail)` records the result. Write the name as a plain statement of what should be true.

Then make sure the check can fail. Break the feature on purpose, see the check fail, and put the feature back. A check that cannot fail protects nothing.

## 7. Redraw the figures when drawing changes

The pictures in `docs/` are drawn by the game's own code. If you changed what the starter draws, run:

```sh
bun run figures
```

Look at the files it writes in `docs/images/`, and commit them with your change.

## Before you report

- `bun run check` passes, and you ran it after your last edit.
- You looked at fresh snapshots.
- You tried it in a browser if input or the page changed.
- The README, the matching skill and the documents still describe what the code does.
- You say plainly what you checked and what you did not.

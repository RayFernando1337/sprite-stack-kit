---
name: game-feel
description: "How motion and controls are done in sprite-stack-kit: frame-rate independent smoothing, banking and pitching, click versus hold on one button, ground following, idle autopilot, wingtip trails, flickering flames, and the fixed pool that every particle uses. Use when tuning how the craft handles, adding controls (keys, touch, gamepad), or adding a trail or a simple particle. For weapons, enemies, explosions, smoke, screen shake, slow motion and sound, use the combat-and-juice skill."
---

# Motion and controls

File: `examples/starter/src/game.js`. Input events are in `main.js`.

## One smoothing rule

Almost nothing in the game jumps to a new value. It moves a share of the way there each frame:

```js
const ease = (dt, rate) => 1 - Math.exp(-dt * rate)
value += (goal - value) * ease(dt, rate)
```

A higher `rate` is snappier. This form gives the same motion at any frame rate. `update` also clamps `dt` to 0.05 seconds, so a paused tab does not cause a leap.

Use it for turn rate, bank, pitch, boost, camera position, anything. Typical rates: 2 to 3 for heavy things, 5 to 7 for quick ones, 20 for a hard correction.

For a move that should also **start** gently, such as a view change, use the spring in `glide()`. It carries speed, never overshoots, and can be given a new goal half-way.

## How the craft flies

- Steering sets a wanted turn rate. `yawRate` eases toward it, and `yaw` adds `yawRate × dt`.
- **Bank follows turn rate.** `roll` eases toward `yawRate ÷ turnRate × bank`. This is most of what makes it feel like flying.
- **Pitch follows climb rate.**
- **Boost** eases in faster (5) than it eases out (2.5).
- **A roll** is a separate angle that runs from 0 to a full turn with an ease-in-out curve. It is added to the bank when drawing.
- **The ground cannot be hit.** `groundAhead()` finds the tallest ground on the path ahead. The floor rises quickly and falls slowly. To allow crashes, remove the floor only when the player clearly means it, for example a held dive.
- **With nobody steering, the craft wanders** on two slow sine waves. A scene that never stops moving looks alive.

Change the numbers in `TUNING` first. They cover speed, turn rate, bank, altitude limits and the camera.

## Controls

- **Click or hold on one button.** `press()` starts a timer. `release()` before `holdSeconds` is a click (roll). Past it, the button is a hold (thrusters).
- **Keys** go through `setKeys(turn, climb, boostHeld)` with values from −1 to 1. Keys take over from the pointer until the pointer moves again.
- **Touch** arrives as pointer events, so drag, tap and hold already work. Add on-screen buttons as DOM elements, as the VIEW button is.
- **A gamepad** is read by polling `navigator.getGamepads()` once per frame in `main.js` and passing the stick to `setKeys`. Apply a dead zone of about 0.15.

Keep the game free of page code. `main.js` turns events into calls on the game. That is also what lets `bun run check` drive the game with no browser.

The pointer steers differently in each view: toward the pointer from above, and left, right, up and down from behind and from the cockpit. The `one-camera-views` skill has the rules.

## Trails

Each wingtip drops a point every few pixels flown into a ring of `TRAIL_POINTS`. A ring is an array with a `head` index that wraps, so nothing is ever moved or freed. `drawTrails` joins the points with short lines, tests depth, and thins the line with `BAYER4` as it ages.

## Flames

`drawFlames` in `stack.js` draws a row of shrinking discs behind each nozzle, white at the nozzle and red at the tip. The shape comes from `hash2(i, frame)` with `frame = time × 24`, so it flickers at 24 steps a second like hand-drawn fire and is the same on every run.

## Particles

Use one flat typed array per kind, with a fixed size and a wrapping head.

```js
const MAX = 200
const F = 5 // x, y, z, born, size
const puffs = new Float32Array(MAX * F).fill(-1e9) // born long ago: every slot starts dead
let head = 0

function addPuff(x, y, z, size) {
  const o = head * F
  puffs[o] = x; puffs[o + 1] = y; puffs[o + 2] = z; puffs[o + 3] = time; puffs[o + 4] = size
  head = (head + 1) % MAX
}

function drawPuffs() {
  for (let o = 0; o < MAX * F; o += F) {
    const age = (time - puffs[o + 3]) / LIFE
    if (age >= 1 || !project(cam, puffs[o], puffs[o + 1], puffs[o + 2])) continue
    // draw a small disc at cam.sx, cam.sy; test fb.depth against cam.depth; thin it with BAYER4 by 1 − age
  }
}
```

The oldest particle is overwritten when the pool is full. Nothing is allocated after start-up. Smoke, spray, sparks, spent cases, debris and rounds all fit this pattern. The `combat-and-juice` skill says what goes in each pool and how each is drawn.

## Things that move, fight, flash and make noise

Another craft or a boat is another pose plus a few numbers of state, drawn with `drawStack`. Keep them in arrays made once, and steer each with the same easing as the player.

Everything past that is in the `combat-and-juice` skill, at `.agents/skills/combat-and-juice/SKILL.md`. Read it before you add any of these:

| You are adding | Its file there |
| --- | --- |
| A gun, rounds, missiles, lock-on, hit tests | `weapons.md` |
| Enemies, their attacks, a dodge, slow motion, a hull | `enemies.md` |
| Explosions, smoke, sparks, screen shake, flash, glow, a wake, clouds that part | `feedback.md` |
| Sound. The starter is silent, and sound is made in code with no files | `sound.md` |
| A way to tell whether it is fun with nobody playing | `playtest.md` |

## Mistakes to avoid

- **Snapping.** Setting a value directly when it should ease.
- **Frame-count timing.** `value += 0.1` per frame runs twice as fast at 120 frames per second. Multiply by `dt`.
- **`Math.random()` in effects.** It breaks repeatable frames, and the checks will fail.
- **Arrays that grow.** `push` and `splice` in the frame loop cause pauses. Use pools.
- **Page code inside the game.** The game must run with no browser for the checks.

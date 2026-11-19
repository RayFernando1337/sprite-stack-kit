---
name: one-camera-views
description: "How the single camera works in sprite-stack-kit: the projection formula with zoom, persp and tilt, the overhead and chase poses, sliding between views without a cut, keeping the camera clear of hills and clouds, and turning pointer positions into world directions. Use when changing how the camera follows or frames the craft, adding a view (cockpit, isometric, side, map), fixing a jump or spin during a view change, or fixing steering that goes the wrong way in one view."
---

# The camera

Files: `examples/starter/src/camera.js` (the formula) and `game.js` (how it moves).

## The formula

```
scale = zoom / (1 + persp × depth)
x     = cx + scale × across
y     = cy − scale × (height + tilt × depth)
```

`project(cam, x, y, z)` applies it to a world point and stores the result in `cam.sx`, `cam.sy`, `cam.scale` and `cam.depth`. It returns `false` when the point is behind the eye.

| Field | Meaning | Overhead | Chase |
| --- | --- | --- | --- |
| `x`, `y`, `alt` | The focus: the world point that sits at `cx`, `cy` | Ahead of the craft | The craft |
| `heading` | The compass direction that points up the screen | Part of the craft's heading | The craft's heading |
| `persp` | 1 ÷ distance from the eye to the focus | 0 | 1 ÷ `chaseDistance` |
| `tilt` | tan of how steeply the eye looks down | 1 (45°) | tan of `chaseAngle` |
| `zoom` | Screen pixels per world pixel at the focus | 1 | Set by `chaseWidth` |
| `cx`, `cy` | Where the focus sits on screen | Centre | A little below centre |

World axes: x east, y south, z up. Heading 0 is north and grows clockwise. Forward for heading `a` is `(sin a, −cos a)`.

With `persp = 0` there is no eye point and no horizon. `eyeHeight()` returns `Infinity` and `horizonRow()` returns a row far above the frame. Code that divides by `persp` must handle zero.

## A view is a set of numbers

`aimCamera(cam, view, …)` sets the camera for a `view` between 0 (overhead) and 1 (chase):

- `persp` slides in a straight line.
- `zoom` slides through logarithms (`Math.exp(view * Math.log(chaseZoom))`), so the craft grows at an even rate.
- `tilt` comes from an angle that slides from 45° to `chaseAngle`.
- `heading` is `overheadHeading + headingGap × view`.

In `game.js`, `view` chases `viewGoal` on a spring. A change starts gently, ends gently, and can be reversed half-way.

**Never cut.** A new view is a new set of target numbers. Slide to them.

## Headings and turns

The overhead heading follows part of the craft's turn, slowly. The chase heading follows all of it, quickly. Over time they drift apart by whole turns. `headingGap` keeps only the short way between them, and it is updated without jumps while the camera is between views. If you add a heading, treat it the same way, or the camera will spin during a change.

`craft.yaw` is never wrapped to a range. That keeps everything that follows it turning the short way.

## Keeping clear of hills and clouds

In the chase view the eye is a real point behind the craft. `update()` in `game.js` looks up the ground under that point and raises the eye above it. It also keeps the eye out of the cloud layer: below it while the craft is low, above it otherwise. The correction is smoothed into `eyeLift` and added to `tilt`.

## Pointer to world

The overhead view steers toward the pointer. The pointer's offset from the craft on screen, `(px, py)`, becomes a map direction with the camera's heading:

```js
const wx = px * cam.cos - py * cam.sin
const wy = px * cam.sin + py * cam.cos
const wantYaw = Math.atan2(wx, -wy)
```

In the chase view the pointer is read differently: left or right of centre turns, and above or below the craft climbs or dives. Each view needs its own rule, chosen by `view > 0.5`.

## Adding a view

**A fixed view (isometric, top-down map).** Keep `persp = 0`. Top-down is `tilt = 1` with `heading = 0`. Isometric is a fixed `heading` of 45° with `tilt` between 0.5 and 1. Add a third target to `aimCamera`.

**A cockpit view.** This is the next view in Dash's game, and it needs four things:

1. A pose. Put the focus a fixed distance ahead of the nose, set `persp` to 1 ÷ that distance, and bring `tilt` close to 0 so the eye looks level.
2. Weights in place of the single `view` number. Use one weight for chase and one for cockpit; overhead is what is left. Blend `persp` directly and `zoom` through logarithms, as now.
3. Fade the craft out as the camera moves into it.
4. Roll. The horizon should tilt when the craft banks. Draw the world onto a larger square picture, then rotate that picture into the frame. Draw only the part of the square that will be visible.

Then draw the cockpit itself over the result. Read `updateView`, `render` and `turnSheet` in Dash's `scene.ts` with the `study-the-reference` skill before you start.

## Mistakes to avoid

- **Cutting.** Setting the camera's numbers directly on a key press. Set the goal and let it slide.
- **Sliding `zoom` in a straight line.** The craft balloons at the end of the move.
- **Wrapping a heading the camera follows.** The camera spins the long way round.
- **A camera inside a hill.** Any new eye position needs the same ground check as the chase view.
- **One steering rule for every view.** What "point up" means depends on the view.
- **Testing only the two ends.** `npm test` draws every frame of a view change. Keep that check passing.

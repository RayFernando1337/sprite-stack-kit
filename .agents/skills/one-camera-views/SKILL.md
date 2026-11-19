---
name: one-camera-views
description: "How the single camera works in sprite-stack-kit: the projection formula with zoom, persp and tilt, the overhead, chase and cockpit poses, mixing poses by shares so a view change never cuts, putting the eye inside the craft, banking the picture by turning a larger sheet, keeping the camera clear of hills and clouds, and turning pointer positions into steering. Use when changing how the camera follows or frames the craft, adding a view (isometric, side, map, orbit), fixing a jump or spin during a view change, changing how the cockpit view looks out or banks, or fixing steering that goes the wrong way in one view."
---

# The camera

Files, all in `examples/starter/src`: `camera.js` (the formula and the poses), `game.js` (how the camera moves: `frameCamera`, `settle`, `render`) and `roll.js` (banking the picture).

`docs/deep-dive.md` sections 1, 5 and 6 derive everything on this page.

## The formula

```
scale = zoom / (1 + persp × depth)
x     = cx + scale × across
y     = cy − scale × (height + tilt × depth)
```

`project(cam, x, y, z)` applies it to a world point and stores the result in `cam.sx`, `cam.sy`, `cam.scale` and `cam.depth`. It returns `false` when the point is behind the eye. `eyeDistance(cam)` then gives how far in front of the eye the point is.

| Field | Meaning |
| --- | --- |
| `x`, `y`, `alt` | The focus: the world point that sits at `cx`, `cy` |
| `heading` | The compass direction that points up the screen |
| `persp` | 1 ÷ the distance from the eye to the focus. 0 is the flat view |
| `tilt` | tan of how steeply the eye looks down. 1 is 45°, 0 is level, negative looks up |
| `zoom` | Screen pixels per world pixel at the focus |
| `cx`, `cy` | Where the focus sits on screen |

World axes: x east, y south, z up. Heading 0 is north and grows clockwise. Forward for heading `a` is `(sin a, −cos a)`.

Facts worth keeping in mind:

- The eye is `1 / persp` behind the focus and `tilt / persp` above it.
- The horizon is the row `cy − zoom × tilt / persp`. `horizonRow()` returns it.
- With `persp = 0` there is no eye and no horizon. `eyeHeight()` and `eyeDistance()` return `Infinity`. Code that divides by `persp` must handle zero.
- The camera never rotates up, down or sideways. `tilt` slides points up the screen instead. So an upright thing is always upright on screen, which the ground sweep depends on.

## Three poses

| | Overhead | Chase | Cockpit |
| --- | --- | --- | --- |
| Focus | A little ahead of the craft | The craft | `cockpitLook` ahead of the nose, at eye height |
| `heading` | Part of the craft's heading, slowly | The craft's heading, quickly | The craft's heading, exactly |
| `persp` | 0 | 1 ÷ `chaseDistance` | 1 ÷ `cockpitLook` |
| `tilt` | 1 | tan of `chaseAngle` | minus the slope of the nose |
| `zoom` | 1 | The craft fills `chaseWidth` of the frame | `cockpitLens` × the frame's longer side ÷ `cockpitLook` |
| `cy` | The middle | 13% of the height lower | 12% of the height higher |

The numbers come from `TUNING` in `game.js`.

## A view is a share

The game holds two numbers, each 0 to 1: `inChase.at` and `inCockpit.at`. They say how much of each pose the camera has. Whatever is left over is the overhead pose.

- `nextView()` and `setView(name)` only set `goal`. Each share then glides toward 0 or 1 on a spring (`glide()`), so a change starts gently, ends gently, and can be redirected half-way.
- `frameCamera()` mixes the focus, the heading and the tilt by the shares.
- `aimCamera(cam, chase, cockpit, look, heading, tilt, width, height, tune)` mixes the rest: `persp` in a straight line, `zoom` through logarithms so things grow at an even rate, `cy` in a straight line.

**Never cut.** A new view is a new set of target numbers. Slide to them.

## Headings and turns

The overhead heading follows part of the craft's turn, slowly. The chase heading follows all of it, quickly. Over time they drift apart by whole turns. `headingGap` keeps only the short way between them, and it is updated without jumps while the camera is between views. The cockpit adds the small gap between the chase heading and the craft's true heading.

If you add a heading, treat it the same way, or the camera will spin during a change. `craft.yaw` is never wrapped to a range, which keeps everything that follows it turning the short way.

## The eye in the cockpit

To put the eye at a point, put the focus a fixed distance ahead of it and set `persp` to 1 over that distance. `frameCamera()` does this with `reach = tune.cockpitLook`. The checks confirm the eye stays in the craft.

- **Looking along the nose.** `nose = tan(craft.pitch × cockpitPitch)`. The focus is raised by `nose × reach` and `tilt` is `−nose`. The eye does not move.
- **The lens.** `cockpitLens` is the lens length as a share of the frame's longer side. Shorter sees wider.
- **The craft dissolves.** `settle()` sets `pose.solid` from the craft's distance in front of the eye. `drawStack` leaves pixels out in the dither pattern. The craft is gone before the eye reaches it.
- **Trails near the eye are skipped**, or they would be drawn huge across the view.

## Banking the picture

The camera cannot roll. `render()` does it instead:

1. `viewRoll` is the craft's bank plus any barrel roll, times a smooth curve of the cockpit share. In the other views it is 0.
2. If it is not 0, `fitSheet()` sizes a sheet just big enough to cover the frame once turned, and the camera's centre moves to the sheet's pivot.
3. The world, sky, trails and craft are drawn into the sheet exactly as they would be into the frame.
4. `pasteRolled()` copies the sheet into the frame, turned about the camera's centre.

Rules for code that draws the world:

- Draw into the picture you are given (`to`), and use its `width` and `height`. It may be the sheet.
- The sheet's arrays are longer than `width × height`. Loop over `width × height`, not over `color.length`.
- `sizeSheet()` allocates, once per resize. `fitSheet()` does not.

To bank another view, add its share to the `viewRoll` line. `+ craft.roll * 0.35 * chase` leans the chase view into turns.

## Keeping clear of hills and clouds

When the eye is a real point behind the craft, `frameCamera()` looks up the ground under it and raises the eye above that. It also keeps the eye out of the cloud layer: below it while the craft is low, above it otherwise. The correction is smoothed into `eyeLift` and added to `tilt`. It fades out with the cockpit share, because in the cockpit the eye is the craft, and the craft already keeps itself clear.

## Pointer to steering

Each view reads the pointer its own way. `update()` chooses by `inChase.at + inCockpit.at > 0.5`.

**From above**, the craft turns to face the pointer. The pointer's offset from the craft on screen, `(px, py)`, becomes a map direction with the camera's heading:

```js
const wx = px * cam.cos - py * cam.sin
const wy = px * cam.sin + py * cam.cos
const wantYaw = Math.atan2(wx, -wy)
```

**From behind and from the cockpit**, left or right of the middle turns, and above or below a reference point climbs or dives. The reference is the craft on screen in the chase view. In the cockpit there is no craft on screen, so it is the camera's centre.

## Adding a view

1. Add its name to `VIEWS` in `game.js`. `nextView()` then steps through it.
2. Add a share for it beside `inChase` and `inCockpit`, and a `glide()` call that sends it to 1 when `goal` is its index.
3. Take it out of the overhead share: `top = 1 − chase − seat − yours`.
4. In `frameCamera()`, add its focus, heading and tilt to the mixes.
5. In `aimCamera()`, add its `persp`, its `zoom` (inside the `Math.exp`) and its `cy`.
6. Decide how the pointer steers in it.
7. Add it to the hints in `main.js`, and to `START` in `scripts/snapshot.mjs` if you want snapshots of it.

Poses for common views:

- **A map from straight above.** `persp = 0`, `tilt` near 0, `zoom` below 1, `heading = 0`. With `tilt` at 0 the ground has no height on screen, so use about 0.2.
- **Isometric.** `persp = 0`, a fixed `heading` of 45°, `tilt` between 0.5 and 1.
- **Orbit.** The chase pose with a heading that turns steadily.

The checks draw every view named in `VIEWS` at three sizes and walk through every view change, so a new view is tested as soon as it is listed.

## Mistakes to avoid

- **Cutting.** Setting the camera's numbers directly on a key press. Set the goal and let it slide.
- **Sliding `zoom` in a straight line.** The craft balloons at the end of the move.
- **Wrapping a heading the camera follows.** The camera spins the long way round.
- **A camera inside a hill.** Any new eye position that trails the craft needs the same ground check as the chase view.
- **One steering rule for every view.** What "point up" means depends on the view.
- **Trying to roll the camera.** There is no roll in the formula. Turn the picture.
- **Testing only the ends.** `bun run check` draws every frame of every view change. Keep that check passing, and look at `bun run snapshot --view between,entering`.

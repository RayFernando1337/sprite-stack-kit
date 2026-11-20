---
name: cockpit-and-hud
description: "How the cockpit and its instruments are drawn in sprite-stack-kit: layers painted once per frame size and stamped every frame, a layout that scales to any screen, live instruments drawn from the game's gauges (map, attitude ball, compass tape, needles, lamps, number read-outs), a head-up display that stays on the real horizon, and the small pixel drawing tools and 3 × 5 font in paint.js. Use when changing how the cockpit looks, adding or changing a dial, screen, lamp or read-out, adding a radar, adding any in-picture HUD such as a score, a health bar, a minimap or a crosshair, or drawing pixel text or numbers into the picture."
---

# The cockpit and in-picture displays

Files, in the game's `src/` (the starter's is `examples/starter/src`): `cockpit.js` (the cockpit), `paint.js` (drawing tools and the font) and `render()` in `game.js` (where the gauges are filled in).

`docs/deep-dive.md` section 7 explains the ideas.

## Two kinds of part

**Painted once.** The canopy frame and the dashboard do not change, so `resize()` paints them into two layers. A layer is `{ width, height, color }`, where a pixel of 0 is see-through. Each frame, `stamp(fb, layer, left, top)` copies a layer over the picture.

**Drawn every frame.** Everything that moves is drawn straight into the picture from the game's numbers, after the layers.

Keep to this split. Work that does not change goes in `resize()`. Only what changes goes in `draw()`.

## The order of a cockpit frame

`cockpit.draw(fb, cam, world, craft, g, arrival)` is called at the end of `render()`, once the cockpit share is above 0.4:

1. Stamp the canopy frame. It slides down from the top as `arrival` goes from 0 to 1.
2. Draw the head-up display, once the camera has settled.
3. Stamp the dashboard. It slides up from the bottom, leans against a turn and shakes with the thrusters open.
4. Draw each instrument at its place on the dashboard.

The cockpit is drawn after `pasteRolled()`, so it never turns with the world.

## The gauges

`render()` fills one object, `gauges`, and passes it as `g`:

| Field | What it is |
| --- | --- |
| `speed` | World pixels per second |
| `altitude` | The craft's height |
| `heading` | The craft's yaw, in radians, not wrapped |
| `turn` | Turn rate, −1 to 1 |
| `climb` | Climb rate, −1 to 1 |
| `boost` | How far the thrusters are open, 0 to 1 |
| `roll` | How far the picture is banked, in radians |
| `pitch` | The craft's pitch, in radians |
| `horizon` | Rows from the middle of the view down to the horizon |
| `low`, `rolling`, `idle` | True or false: near the ground, in a barrel roll, nobody steering |
| `time` | The game's clock, for blinking |

To show something new, add a field here, set it in `render()`, and read it in `cockpit.js`. Do not reach into the game from the cockpit.

## The layout

`plan(width, height)` returns where everything goes. The dashboard was designed 86 pixels tall. `px(n)` scales a measurement from that design to the current size. Use it for every position and size, so the cockpit fits a phone and a wide monitor alike.

Positions in the plan are measured from the corner of the dashboard layer. In `draw()`, add `left` and `top` to get a place in the picture.

## Adding an instrument

1. **Give it a place.** Add a rectangle or a circle to the object `plan()` returns, built with `px()`.
2. **Cut its recess.** In `paintDash()`, call `well(layer, x, y, w, h)` or `roundWell(layer, x, y, radius, rim)`. That paints the dark hole and the lit rim.
3. **Write its draw function.** It takes the picture, a position, and the numbers it needs. It reads, then draws.
4. **Call it** in `draw()` with `left + p.yours.x, top + p.yours.y`.
5. Run `bun run snapshot --view cockpit` at two sizes and look: `--width 384 --height 240` and `--width 200 --height 420`.

Patterns to copy:

| You want | Copy | How it works |
| --- | --- | --- |
| A needle | `drawNeedle` | A line from the centre at an angle set by a value from −1 to 1 |
| A number | `drawReadout` | `number(fb, x, y, value, digits, colour, size)` |
| A bar | The thruster bar in `drawReadout` | Lit and unlit segments chosen by comparing with the value |
| A lamp | The loop at the end of `draw()` | One `box` in a lit or an unlit colour |
| A map or a radar | `drawMap` | For each pixel of the screen, step across the world and read the map |
| A moving scale | `drawTape` | Place each mark by how far its value is from the current one |
| A round display | `drawBall` | Loop over a square and skip pixels outside the circle |

The four lamps sit in pairs under the two dials, placed by `lampX()`. To add a fifth, change `lampX()` as well as `LAMPS`.

**A radar** is `drawMap` plus dots. Draw the ground, then for each thing to show, turn its offset from the craft by the craft's heading and plot a dot:

```js
const dx = thing.x - craft.x
const dy = thing.y - craft.y
const right = dx * cos + dy * sin // cos and sin of craft.yaw
const ahead = dx * sin - dy * cos
dot(fb, x0 + midX + Math.round(right / MAP_REACH), y0 + midY - Math.round(ahead / MAP_REACH), colour)
```

Offsets on a wrapping map should take the short way round: `dx -= WORLD_SIZE * Math.round(dx / WORLD_SIZE)`.

## The head-up display

`drawHud()` draws marks that line up with the world behind the glass.

- The horizon is `g.horizon` rows below the camera's centre. A line `a` degrees above it is `lens × tan(a)` higher, with `lens = cam.zoom / cam.persp`.
- The world was turned by `g.roll`, so the marks are turned by the same angle. A point `along` the horizon and `below` the centre lands at `(cx + along × cos + below × sin, cy + below × cos − along × sin)`.
- The nose marker and the numbers are not turned. They belong to the craft.

To mark a world point on the glass (a target box, a waypoint), `project()` it after `pasteRolled()`, then turn the result the same way about `(cam.cx, cam.cy)`. `place()` in `examples/worldfight/src/hud.js` is this code:

```js
if (project(cam, x, y, z)) {
  const dx = cam.sx - cam.cx
  const dy = cam.sy - cam.cy
  const sx = cam.cx + dx * cos + dy * sin // cos and sin of g.roll
  const sy = cam.cy + dy * cos - dx * sin
}
```

Something that stands in the world, such as a beam over a place, is drawn before `cockpit.draw()`, so the dashboard hides its foot. An overlay, such as a target box, is drawn after it.

## The drawing tools

`paint.js` draws into anything with `{ width, height, color }`: the picture, the sheet, or a layer. Everything is clipped.

| Tool | Draws |
| --- | --- |
| `dot(to, x, y, col)` | One pixel |
| `box(to, x, y, w, h, col)` | A filled rectangle |
| `line(to, x0, y0, x1, y1, col)` | A line one pixel wide |
| `disc(to, cx, cy, radius, col)` | A filled circle. `col` may be a function of `(dx, dy)` for shading |
| `text(to, x, y, word, col, size)` | A word in the 3 × 5 font |
| `number(to, x, y, value, digits, col, size)` | A whole number with leading zeros |

The font has the digits and the letters `A D E G H L N P S T W`. To add a letter, add a row of fifteen 0s and 1s to `SHAPES`: three across, five down, top row first.

`number()` builds no string, so it is safe every frame. `text()` is safe with a fixed word. Do not build strings in `draw()`.

## A display outside the cockpit

A score, a health bar or a crosshair that shows in every view is the same thing with no layers. Write a small file with a `draw(fb, values)` function that uses `paint.js`, and call it last in `render()`, after the cockpit. Keep it small and in a corner. Long text, menus and buttons are easier to read as page elements over the canvas: see `software-framebuffer`.

A game with a fight wants both. Hull and score show in every view. The cockpit adds what only it can: enemies on the radar, a box round the target on the glass, a lamp for a warning. The `combat-and-juice` skill says what a fight needs to show.

The cockpit is the view people remember. A new game keeps it and repaints it to suit the craft, unless the user says to drop it.

## Style

- Use few colours, from one family. The dashboard is five slate blues. The screens are seven strengths of one green.
- Shade with the dither pattern, not with gradients.
- Light comes from above and the left: light rims on top and left edges, dark rims on bottom and right.
- Make every colour once, at the top of the file, with `rgb()`.

## Mistakes to avoid

- **Covering the view.** The dashboard takes about a third of the height. More than that and there is little left to fly by.
- **More materials than `MAP_TONE` holds.** It is `new Uint8Array(13)`. A write past its end is dropped with no error, and that material gets no tone on the map screen. Make it as long as `MAT`.
- **Copying Dash's cockpit.** His art and layout are his. Read `cockpit.ts` for ideas with the `study-the-reference` skill, then draw your own.

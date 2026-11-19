# A deeper look

[How it works](how-it-works.md) is the tour. This page goes back over the same ground slowly. For each technique it says why it works, shows the few lines of the starter that do it, and suggests something to try.

You need school-level maths: fractions, a little trigonometry, and patience. Every file named here is in `examples/starter/src`. [The glossary](glossary.md) has the terms.

Contents:

1. [The camera](#1-the-camera)
2. [Drawing a stack](#2-drawing-a-stack)
3. [The ground sweep](#3-the-ground-sweep)
4. [Shadows from the maps](#4-shadows-from-the-maps)
5. [Turning the picture](#5-turning-the-picture)
6. [The eye in the cockpit](#6-the-eye-in-the-cockpit)
7. [The cockpit: paint once, draw live](#7-the-cockpit-paint-once-draw-live)
8. [Motion: ease and glide](#8-motion-ease-and-glide)
9. [The same frames every time](#9-the-same-frames-every-time)
10. [Speed](#10-speed)

## 1. The camera

Files: `camera.js`, and `frameCamera()` in `game.js`.

### Measuring a point

The camera looks at one world point, its **focus**. Every other point is measured from the focus in three directions:

```js
const dx = x - cam.x
const dy = y - cam.y
const across = dx * cam.cos + dy * cam.sin // to the right on screen
const depth = dx * cam.sin - dy * cam.cos // into the screen
const height = z - cam.alt // upward
```

`cam.sin` and `cam.cos` are the sine and cosine of the camera's heading. The map's y axis runs south, so "forward" for a heading `h` is `(sin h, −cos h)`. That is where the minus sign comes from.

### The formula

```
scale = zoom / (1 + persp × depth)
x     = cx + scale × across
y     = cy − scale × (height + tilt × depth)
```

### With `persp = 0`: the flat view

`scale` is just `zoom`, for every point. Nothing shrinks with distance. With `zoom = 1` and `tilt = 1` the last line becomes

```
y = cy − (height + depth)
```

One layer of height moves a point one pixel up the screen. One pixel of depth also moves it one pixel up. That is the whole rule of sprite stacking, and it falls straight out of the formula. `bun run check` tests exactly this.

### With `persp` above 0: there is an eye

`scale` grows without limit as `1 + persp × depth` approaches 0, which is at `depth = −1 / persp`. That is where the eye is: `1 / persp` behind the focus.

A point's distance in front of the eye is therefore `depth + 1 / persp`. Put that into the formula and it becomes

```
scale = (zoom / persp) / distance from the eye
```

Twice as far is half as big. That is real perspective. The number `zoom / persp` is the lens: how many pixels wide something is when it is as wide as it is far away.

### The horizon

The eye is `tilt / persp` above the focus. Take any point at exactly that height, at any depth, and work out its row:

```
y = cy − zoom × (tilt / persp + tilt × depth) / (1 + persp × depth)
  = cy − zoom × tilt / persp
```

The depth cancels. Every point at eye height lands on the same row, however far away it is. That row is the horizon, and it is what `horizonRow()` returns.

### A camera that leans without turning

The term `tilt × depth` deserves a second look. A real camera that looks down is rotated, and tall things then lean apart toward the edges of the picture. This camera never rotates up or down. It slides each point up the screen in proportion to its depth. That is called a shear.

The result is that **upright things stay exactly upright**. A column of ground is always a run of pixels in one screen column. The ground sweep in section 3 depends on that completely. It is also why the cockpit cannot bank by itself, and needs the trick in section 5.

### Three poses

A view is a choice of the camera's numbers. `aimCamera()` mixes three sets:

| | Overhead | Chase | Cockpit |
| --- | --- | --- | --- |
| `persp` | 0 | 1 ÷ `chaseDistance` | 1 ÷ `cockpitLook` |
| `zoom` | 1 | The craft fills `chaseWidth` of the frame | `cockpitLens` × the frame's longer side ÷ `cockpitLook` |
| `tilt` | 1 (45°) | tan of `chaseAngle` | minus the slope of the nose |
| Focus | A little ahead of the craft | The craft | A point `cockpitLook` ahead of the nose |
| Where the focus sits | The middle | A little below the middle | A little above the middle |

The game keeps two shares, `chase` and `cockpit`, each from 0 to 1. Whatever is left over is the overhead share. `persp` is mixed in a straight line:

```js
cam.persp = chase / tune.chaseDistance + cockpit / tune.cockpitLook
```

`zoom` is mixed through logarithms:

```js
cam.zoom = Math.exp(chase * Math.log(chaseZoom) + cockpit * Math.log(cockpitZoom))
```

Mixing logarithms multiplies where a straight line would add. The craft then grows by the same factor in every tenth of the move, which the eye reads as steady. A straight-line mix makes it balloon at the end.

**Try it.** In `aimCamera()`, replace the `cam.zoom` line with `cam.zoom = 1 + chase * (chaseZoom - 1) + cockpit * (cockpitZoom - 1)`. Press Space and watch the move from overhead to chase. Then put the line back.

## 2. Drawing a stack

Files: `model.js` (the data) and `stack.js` (the drawing).

### The craft's own axes

`stackAxes(yaw, roll, pitch)` returns three directions in the world: the craft's right side, its front, and up through its top. A cell that is `a` cells right of the centre line, `b` cells ahead of the pivot and `lift` slices above it sits at

```
pose + a × right + b × front + lift × up
```

That point goes through the camera like any other.

### A cell is a tile

Projecting only the centre of every cell would leave pin-holes as soon as the craft turned or grew. So each cell is treated as a small flat square lying in its slice. On screen that square is a slanted four-sided shape with two edges:

- `r`: one cell along the wing, in screen pixels
- `f`: one cell along the body, in screen pixels

For a pixel at offset `e` from the tile's centre, the question is "how many cells along `r` and along `f` is this?" That means solving `e = u × r + w × f` for `u` and `w`, which is a small inverse worked out once per stack:

```js
const det = rx * fy - fx * ry
const iux = fy / det
const iuy = -fx / det
const ivx = -ry / det
const ivy = rx / det
// … then for each pixel near the tile:
const u = (ex * iux + ey * iuy) * inv
const w = (ex * ivx + ey * ivy) * inv
```

The pixel is inside the tile when both `u` and `w` are within half a cell. The code allows 0.53 (`REACH`), so neighbouring tiles overlap by a sliver and no seam can open between them.

When the slices are seen exactly edge-on, `det` is close to 0 and there is no area to fill. Then only each cell's centre pixel is drawn.

### Which slice first

Nearer slices must cover farther ones. `drawStack` finds how high the eye is, measured along the stack's own up axis, and draws the slices in order of their distance from that level, farthest first:

```js
rank[n] = Math.abs((n - model.pivotZ) * pose.spread - eye)
```

In the flat view the eye is infinitely far above the stack, so this is simply bottom to top. If the craft is upside down in a roll, it becomes top to bottom, with no special case.

### The outline

While a stack is drawn, every pixel it touches is marked in a scratch array, `fb.mask`. Afterwards, each unmarked pixel that has a marked neighbour is painted dark. That is the outline. The marks are then wiped, so the next stack starts clean.

### Dissolving

`pose.solid` runs from 1 (every pixel) to 0 (none). In between, a pixel is drawn only where the dither pattern allows it:

```js
if (ink === 16 || ink > BAYER4[((y & 3) << 2) | (x & 3)]) color[o] = col
```

This is how the craft fades as the camera enters the cockpit, with no blending.

**Try it.** In `stack.js`, change `REACH` from `0.53` to `0.45` and fly in the chase view. Seams open between the cells. Put it back.

## 3. The ground sweep

File: `terrain.js`.

### One step of depth

The sweep takes one depth `d` at a time, from near to far. At that depth every height has one screen row, the same across the whole screen, because of the shear in section 1:

```js
k = zoom / (1 + persp * d)
sea = cy - k * (tilt * d - alt) // the row of sea level at this depth
rowsNow[z] = Math.floor(sea - k * z) // the row of height z
```

`rowsPrev` keeps the same table from the step before.

### One column of ground

For each screen column the sweep finds the ground pixel under it. Moving one column to the right on screen is a fixed step across the map, so each pixel costs two additions:

```js
const stepX = cos / k
const stepY = sin / k
// for each px: wx += stepX, wy += stepY
```

A ground pixel of height `h` shows two faces between this step and the last:

- its **wall**, from `rowsPrev[h]` downward
- its **top**, from `rowsNow[h]` down to where the wall starts

Both are filled only where the picture is still empty. Then `skyline[px]` is raised to the top of what was drawn. On later steps, ground whose rows are all below the skyline is skipped after one comparison:

```js
if (top >= edge && wall >= edge) continue // hidden behind nearer ground
```

That one line is why a frame costs about the same whether the view is full of hills or not.

### How big a step

Too small a step wastes time. Too big a step skips ground. The right step is the one that moves the sea up the screen by one row. The sea's row changes with depth at the rate

```
zoom × (tilt + persp × alt) / (1 + persp × d)²
```

so one row of sea is a step of `(1 + persp × d)² / (zoom × (tilt + persp × alt))`. That is this line:

```js
let step = (den * den) / climb
```

In the flat view the step is constant. With perspective it grows with the square of the distance, which matches how fast far ground shrinks. The step is also capped so that it never skips more than three screen columns' worth of map.

### Clouds, fog and sky

Clouds are drawn in the same sweep, from a second map: a top face, an underside (seen when the eye is below them) and a wall.

Fog mixes a colour toward the haze colour. The amount is rounded to one of 8 levels, so distance shows as flat bands:

```js
fog = Math.round(Math.sqrt(f) * FOG_BANDS) * (256 / FOG_BANDS)
```

`drawSky` then fills every pixel that is still empty: sky bands above the horizon row, haze below it.

**Try it.** Change `FOG_BANDS` from `8` to `3` and fly in the chase view. Then try `24`. Notice how much of the "pixel art" look comes from having few steps.

## 4. Shadows from the maps

File: `terrain.js`, inside the same sweep.

There are no light rays. A ground pixel asks one question: "is there cloud between me and the sun?" The sun's direction is fixed, so the answer is one lookup in the cloud map, at a spot shifted toward the sun by the height difference:

```js
const lift = CLOUD_BASE - h
const over = cloudMap[/* gx − SUN_X × lift, gy − SUN_Y × lift, wrapped */]
if (over > 1) shaded = true
```

The craft's shadow is the same idea. Step from the ground pixel toward the sun, up to the craft's height, and see whether that spot falls inside the craft's outline seen from above (`caster.footprint`).

A shaded pixel uses a second palette that is cooler as well as darker. Shade that is only darker reads as dirt.

**Try it.** In `world.js`, change `SUN_X` and `SUN_Y` to `-0.55` and `0.4`. Every shadow now falls to the west.

## 5. Turning the picture

File: `roll.js`, called from `render()` in `game.js`.

Section 1 showed that this camera keeps upright things upright. So a banked view cannot come from the camera. It comes from turning the finished picture.

### How big the sheet must be

Turn the frame's four corners by the bank angle about the camera's point, and take the box that contains them. That is `fitSheet()`:

```js
const u = x * cos - y * sin
const v = x * sin + y * cos
// … keep the smallest and largest u and v
```

At no bank the box is the frame itself. At 45° a 384 × 240 frame needs a sheet about 445 × 445, a little over twice the pixels. The sheet's memory is sized once for the worst case (`sizeSheet()`), and each frame uses only the part it needs.

### Drawing on it

While the world is drawn, the camera's centre is moved to the sheet's pivot. Nothing else changes: `drawWorld`, `drawSky`, the trails and the craft all draw into the sheet as they would into the frame.

```js
fitSheet(sheet, fb.width, fb.height, cx, cy, viewRoll)
cam.cx = sheet.cx
cam.cy = sheet.cy
```

### Copying it back, turned

For every pixel of the frame, find where it came from on the sheet. Along one row of the frame, each step to the right is the same step across the sheet, `(cos, sin)`. So the inner loop is two additions and one copy:

```js
for (let x = 0; x < W; x++, u += cos, v += sin) out[o++] = from[(v | 0) * stride + (u | 0)]
```

Each frame pixel takes the colour of the one sheet pixel it lands in. Nothing is averaged, so hard pixels stay hard.

**Try it.** Make the chase view bank a little too. In `frameCamera()` in `game.js`, add `+ craft.roll * 0.35 * chase` to the end of the `viewRoll` line. The horizon now leans into turns from behind as well.

## 6. The eye in the cockpit

Files: `frameCamera()` and `settle()` in `game.js`.

### Putting the eye in the seat

Section 1 found the eye `1 / persp` behind the focus. So to put the eye in the craft, put the focus a fixed distance ahead of the nose and set `persp` to 1 over that distance:

```js
look.x = craft.x + Math.sin(craft.yaw) * reach // reach is tune.cockpitLook
look.y = craft.y - Math.cos(craft.yaw) * reach
cam.persp = 1 / reach
```

These lines show the full cockpit view. On the way in, the code mixes each one with the other views by the cockpit share.

The eye then sits exactly on the craft, whatever it does. `bun run check` flies a hard climbing turn and confirms the eye never drifts.

### Looking up and down

The view should follow the nose. With this camera that is a change of `tilt`: a negative tilt looks up. The focus is raised by the same slope, so the eye itself stays put:

```js
const nose = Math.tan(craft.pitch * tune.cockpitPitch)
look.alt = craft.z + tune.cockpitEye + nose * reach
tilt = -nose
```

### The lens

In the cockpit, `zoom` is set so that the scale at a distance `d` from the eye is `cockpitLens × longer side ÷ d`. A lens of 0.62 sees about 78° across a wide frame. A shorter lens sees more and makes speed feel greater. A longer one is a telescope.

### Getting in without a bump

Three things happen as the cockpit share goes from 0 to 1:

- The craft dissolves. `settle()` measures how far the craft is in front of the eye, and sets `pose.solid` from that. It is gone before the eye reaches it.
- The bank is let in gradually. The picture's roll is the craft's roll times a smooth curve of the cockpit share, so the horizon does not snap over.
- The cockpit slides into place, the frame from above and the dashboard from below.

### Steering

From inside, there is no craft on screen to point at. So the pointer is read against the middle of the view: left or right of it turns, above or below it climbs or dives. It is the same rule as the chase view, with a different centre.

**Try it.** Set `cockpitPitch` to `1` and climb hard. The view now follows the nose fully. Set it to `0` and the horizon stays level whatever you do. The starter uses 0.6 because the full amount is tiring to watch.

## 7. The cockpit: paint once, draw live

Files: `cockpit.js` and `paint.js`.

### Two layers

A layer is a picture where 0 means see-through. The cockpit has two, both painted in `resize()`:

- **The canopy frame.** An arch with square shoulders. The shape is a superellipse: the points where `|x/a|^3.5 + |y/b|^3.5 = 1`. With a power of 2 it would be an ordinary ellipse, and higher powers square the corners. Each pixel's distance outside that curve picks its tone, which gives the frame a dark edge, a lit band and a shaded band.
- **The dashboard.** Its top edge is higher in the middle, over the instruments, with a smooth shoulder each side. The face is two close tones mixed with the dither pattern, so it darkens toward the bottom without a smooth gradient. Every instrument sits in a recess with a light rim above and to the left and a dark one below and to the right, which is all it takes to make a flat rectangle look sunk in.

Each frame, `stamp()` copies a layer over the picture and skips the see-through pixels. Copying it one or two pixels to the side makes it sway.

### One layout for every size

`plan(width, height)` works out where everything goes. The dashboard was designed 86 pixels tall. For any other frame, every measurement is scaled by `dashboard height ÷ 86` and rounded. On a phone held upright the same cockpit comes out small. On a wide monitor it comes out large with double-size letters.

### The live parts

Each instrument is a small function that reads the craft's numbers and draws.

- **The map** looks straight down. For each pixel of the screen it steps across the world, turned by the craft's heading so that ahead is up, and reads the material there. One tone per material, darker on every second row for scan lines.
- **The attitude ball** fills a circle with sky above a line and ground below it. The line is tilted by the bank and moved by the pitch.
- **The compass tape** draws a mark every 15°, placed by how far that heading is from the craft's, the short way round.
- **Numbers** are drawn by `number()` in `paint.js`, from a font of 3 × 5 pixel glyphs. It takes the number apart with arithmetic and builds no string, so it creates nothing for the browser to tidy up.

### The head-up display

The marks on the glass must line up with the world behind them, even though the world has been turned. Two facts make that easy.

First, the horizon's distance below the middle of the view is known: `−zoom × tilt ÷ persp` (section 1). A line 10° above the horizon is `lens × tan(10°)` higher, where the lens is `zoom ÷ persp`.

Second, the picture was turned by the bank angle, so the marks are turned by the same angle. A point `along` the horizon and `below` the middle lands at

```js
x = cx + along * cos + below * sin
y = cy + below * cos - along * sin
```

That is all `drawHud()` does, seven times, for the horizon and three rungs each side of it.

**Try it.** In `cockpit.js`, change `MAP_REACH` from `5` to `12`. The map now shows more than twice as much ground. Then give a lamp a new meaning: in the last loop of `draw()`, replace `g.low && ((g.time * 6) & 1) === 0` with `g.altitude > 150`. The red lamp now lights when you fly high.

## 8. Motion: ease and glide

File: `game.js`.

### Ease

Almost every moving number uses one line:

```js
value += (goal - value) * ease(dt, rate)
// where
const ease = (dt, rate) => 1 - Math.exp(-dt * rate)
```

It moves `value` a share of the way to `goal`. The share is worked out from the real time that has passed, so the motion is the same at 30, 60 or 144 frames a second. Two half-length frames leave exactly as much distance to go as one full-length frame, because `exp(−a) × exp(−a) = exp(−2a)`.

A plain `value += (goal - value) * 0.1` does not have that property. It runs faster on a faster screen.

`rate` is how quick the move is. After `1 / rate` seconds, about two thirds of the distance is gone.

### Glide

An ease starts at full speed, which is fine for a wing dipping and wrong for a camera. The view change uses a spring that also carries speed:

```js
part.speed += (pull * pull * (goal - part.at) - 2 * pull * part.speed) * dt
part.at += part.speed * dt
```

It starts gently, ends gently, never overshoots, and can be given a new goal half-way without a jump. `pull` is `4.6 ÷ viewSeconds`, which leaves the move about 94% done after `viewSeconds`.

### Two shares, three views

The chase share and the cockpit share each glide toward 0 or 1. The overhead view is whatever is left. Going from the cockpit to overhead, the cockpit share falls while the chase share stays at 0, and the camera pulls up and out in one move. Any future view is one more share.

**Try it.** Set `viewSeconds` to `4` and watch a view change in slow motion. Every frame on the way is a complete, sensible picture. That is the test of a camera built this way.

## 9. The same frames every time

File: `rng.js`.

`makeRng(seed)` returns a function that gives the same series of numbers for the same seed. The world builder uses it for everything, so a seed is a world.

`hash2(x, y)` turns two whole numbers into a number from 0 to 255, always the same for the same pair. It gives every map cell its own "random" value with nothing stored. Add a time counter and the value changes on a schedule: that is how the surf and the flames flicker, the same way on every run.

The game never calls `Math.random()` and never reads the clock. Time only enters through `update(seconds)`. So the same seed and the same calls draw the same pixels. `bun run check` flies the same flight twice and compares the two frames.

This is worth protecting. It is why a bug can be replayed exactly, why the pictures in these documents can be redrawn, and why a coding agent can test the game with no browser.

## 10. Speed

A 480 × 270 frame takes between 1 and 3 milliseconds on a recent laptop, in every view. The reasons, in order of how much they matter:

1. **A small picture.** About 100,000 pixels. Doubling the width and height would cost four times as much.
2. **Near to far, and the skyline.** Each pixel is written once. Hidden ground costs one comparison.
3. **Nothing created per frame.** Typed arrays are made in `resize()` and reused. Pose objects, trail rings and the sheet are made once. The browser never has to stop and collect memory.
4. **Tables, not sums.** The row of every height is worked out once per depth step, not once per pixel. Colours are packed once per palette, not once per pixel.
5. **Powers of two.** A map position wraps with `& WORLD_MASK`.

`bun run check` prints the time per frame for each view. Run it before and after a change to drawing. If the time doubles, find out why before you go on.

## Where to go next

- [The tutorial](tutorial.md), if you have not made the changes yourself yet.
- [The skills](README.md#the-skills-are-how-to-guides), for step-by-step guidance on a particular job.
- [A map of Dash's code](reference-map.md), to read how the original does the things the starter leaves out.

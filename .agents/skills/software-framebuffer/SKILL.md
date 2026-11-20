---
name: software-framebuffer
description: "How the low-resolution picture works in sprite-stack-kit: the Uint32Array of packed colours, the depth array, the order a frame is drawn in, integer upscaling with hard pixels, dithering instead of blending, and page elements over the canvas for hints and buttons. Use when drawing anything new into the picture, adding an effect (flash, glow, vignette, screen shake), fixing blurry or misaligned pixels, handling resize or high-DPI screens, or adding hints, menus or buttons to the page."
---

# The picture

File: `framebuffer.js` in the game's `src/` (the starter's is `examples/starter/src`). Shown by `main.js`.

## What it is

`createFramebuffer()` returns one object with four arrays over the same frame:

| Field | Type | Holds |
| --- | --- | --- |
| `color` | `Uint32Array` | One packed colour per pixel. Index is `y * width + x` |
| `depth` | `Float32Array` | How far into the view the surface at that pixel is |
| `mask` | `Uint8Array` | Scratch for the sprite being drawn. Always left cleared |
| `bytes` | `Uint8ClampedArray` | The same memory as `color`, as bytes, for `ImageData` |

`resize(w, h)` allocates all four. It is the only place that allocates. `clear()` sets every colour to `EMPTY` (0) and every depth to `FAR`.

A picture's `width` and `height` can be smaller than its arrays. The sheet in `roll.js` is a framebuffer that uses only part of its memory each frame. Loop over `width × height`, not over `color.length`.

## Colours

- Make a colour with `rgb(r, g, b)`. It is packed as `0xAABBGGRR` with full alpha.
- `EMPTY` is 0 and means "nothing drawn here yet". Every real colour has full alpha, so no real colour is 0.
- `tint(color, r, g, b)` scales the channels, for shade.
- `mix(a, b, amount)` moves `a` toward `b` by `amount` out of 256. Use it for stepped fog, with only a few distinct amounts.
- Build colours once, when a palette is made. Do not call `rgb()` per pixel.

## The order of a frame

`render()` in `game.js` does this, and new drawing has to fit into it:

1. Choose the picture to draw the world on, `to`. It is the frame, or the larger sheet when the view is banked (see `one-camera-views`).
2. `to.clear()`.
3. `drawWorld`: ground and clouds, near to far. It writes only where `color` is `EMPTY`, and it writes `depth`.
4. `drawSky`: fills whatever is still `EMPTY`.
5. Everything else in the world (trails, sprites, particles). Each of these **tests** `depth` and overwrites `color`.
6. If the sheet was used, `pasteRolled` turns it into the frame.
7. Things fixed to the screen: the cockpit, then any other display. These draw into `fb` and do not test depth.

Anything that belongs to the world goes in step 5 and draws into `to`. Anything that belongs to the screen goes in step 7 and draws into `fb`.

A pixel drawn in step 5 follows this pattern:

```js
if (project(cam, x, y, z)) {
  const px = Math.round(cam.sx)
  const py = Math.round(cam.sy)
  if (px >= 0 && py >= 0 && px < to.width && py < to.height) {
    const at = py * to.width + px
    if (to.depth[at] >= cam.depth - 1) to.color[at] = colour // not behind a hill or a cloud
  }
}
```

Sprites do not write `depth`. When two of them can overlap, draw the farther one first.

## Showing it

`fit()` in `main.js`:

- Picks `pixel`, a whole number of screen pixels per game pixel.
- Sets the canvas's `width` and `height` to the game size, and its CSS size to exactly `pixel` times that.
- Relies on `image-rendering: pixelated` in `index.html`.
- Wraps `fb.bytes` in one `ImageData`. Each frame is then a single `putImageData`.

After any `resize`, make a new `ImageData`. The old one points at memory that is no longer used.

Pointer positions arrive in screen pixels. Divide by `pixel` before giving them to the game.

## Fading without blending

`BAYER4` holds 16 thresholds. To show something at a strength from 0 to 1:

```js
if (strength * 16 > BAYER4[((y & 3) << 2) | (x & 3)]) fb.color[at] = colour
```

At half strength, half the pixels are drawn in a fixed checker-like pattern. The trails in `game.js` fade this way, and `drawStack` dissolves the craft this way when `pose.solid` is below 1. Use it for smoke, spray, fades and soft edges.

## Text, counters and buttons

There are two places for words and numbers. Choose by what they are.

- **Part of the game's world or its instruments:** draw them into the picture with `paint.js`. The cockpit's read-outs are done this way, in a 3 × 5 pixel font. Use this for a score, a health bar, a speed read-out or a crosshair. The `cockpit-and-hud` skill covers it.
- **Part of the page:** hints, menus, long text and buttons are DOM elements over the canvas, as `index.html` does with `#hint` and `#view`. They stay sharp at any size and work with touch and screen readers. Update their text only when it changes.

## Whole-picture effects

Most run after everything is drawn, as a loop over `fb.color`. The `combat-and-juice` skill says when each one earns its place.

- **Flash:** `mix` every pixel toward white by an amount that decays.
- **Vignette:** precompute a per-pixel darkening table in `resize`, then apply it with `tint` logic.
- **Screen shake and glow:** the `combat-and-juice` skill has both, in its `feedback.md`. Shake moves `cam.cx` and `cam.cy`, never the canvas.

## Mistakes to avoid

- **Fractional CSS scale.** If the canvas's CSS size is not an exact multiple of its pixel size, pixels come out uneven. Keep the `fit()` arithmetic.
- **Smoothing.** Never draw the picture with `drawImage` scaling or CSS transforms that resample.
- **Forgetting the bounds test.** Writing outside `0..width-1` wraps onto the next row.
- **`| 0` on negative numbers.** It rounds toward zero, not down. Use `Math.floor`, or keep values positive as `terrain.js` does.
- **Leaving `mask` dirty.** If you use it, clear the area you touched before returning.

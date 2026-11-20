---
name: stacked-terrain
description: "How the world is built and drawn in sprite-stack-kit: the wrapping height map and material map, procedural islands from seeded tileable noise, clouds as a second map, the near-to-far column sweep, shadows, stepped fog and the banded sky. Use when changing the landscape (new biome, materials, buildings, roads, rivers, trees), changing world size or seed handling, adding weather or time of day, fixing gaps, shimmer or missing ground in the distance, or improving terrain drawing speed."
---

# The world

Files: `examples/starter/src/world.js` (data) and `terrain.js` (drawing).

## The data

`buildWorld(seed, { land, clouds })` returns:

| Field | What it is |
| --- | --- |
| `heights` | `Uint8Array`, `WORLD_SIZE²`. Layers of height at each ground pixel. Water is 0 |
| `materials` | `Uint8Array`, same size. An index from `MAT` |
| `cloudMap` | `Uint8Array`, `CLOUD_SIZE²`. How many layers thick the cloud is. 0 is clear sky |
| `spawnX`, `spawnY` | A start over open water near land |
| `palette` | Every colour the world uses, already packed |

Both maps wrap. Sizes are powers of two, so a position wraps with `& WORLD_MASK`. A cell is at `(y << WORLD_SHIFT) | x`. `groundAt(world, x, y)` does this for you.

Limits to respect:

- Ground is at most `GROUND_MAX` layers. Clouds sit at `CLOUD_BASE` and are at most `CLOUD_LAYERS` thick.
- Nothing may be taller than `TOP_Z`. The renderer sizes its tables from it. If you add something taller, raise `TOP_Z`.

## How the land is made

1. `tileableNoise` adds several layers of noise that match at the edges.
2. A histogram finds the sea level that leaves the wanted share of land.
3. Each land cell gets a height in terraces of two layers, and a material from how high it is and which way its slope faces.
4. Trees are small mounds stamped onto low grass.
5. Clouds are short random walks that stamp a dome at each step.

All randomness comes from `makeRng(seed)` and `hash2(x, y)`.

## Changing the land

**Colours.** Edit `MATERIALS`: one `[top colour, side colour]` pair per material, in the same order as `MAT`. The side colour should be a darker, less saturated version of the top.

**A new material.** Add a name to `MAT` and a row to `MATERIALS` at the same index. Keep water materials below `WATER_BELOW`. Then assign it in `buildWorld`.

**A new biome.** Change the thresholds in the main loop of `buildWorld`: `rise > 0.8` is snow and `rise > 0.48` is rock. For a desert island, swap the grass colours for sand tones and drop the trees. A world with no sea at all needs more: stop placing the sea level in `buildWorld`, and make the changes under "The sea" in `.agents/skills/sprite-stack-game/needs.md`. For an ice world, lower the snow line.

**A real place.** `examples/worldfight` builds its maps from real elevation data. `bun run maps` packs each place into a small grid in the source, and the game's `world.js` rebuilds the map from it. Read its README before you write your own.

**Buildings, walls, towers.** After the land is made, stamp them: raise `heights` over a rectangle and set a material. A building is a tall column with its own top and side colours.

**Roads and rivers.** Walk a path across the map and set the material, and for a river also set the height to 0.

**More or less land, more or fewer clouds.** Pass `{ land, clouds }` to `buildWorld`.

After any change, run `bun run check`. It checks that the same seed still gives the same world and that nothing is too tall. The cockpit's map screen colours the ground by material (`MAP_TONE` in `cockpit.js`), so give a new material a tone there too.

## How it is drawn

`drawWorld(to, cam, world, time, caster)` sweeps depth from the nearest row of the view to the farthest. `to` is the frame, or the larger sheet when the view is banked, so the sweep always uses `to.width` and `to.height`. `docs/images/sweep.png` shows the sweep stopped at three depths.

At each depth step it works out, once, the screen row of every possible height (`rowsNow`) and keeps the rows from the step before (`rowsPrev`). Then for each screen column:

1. Find the ground pixel under that column at this depth. One step right on the screen is `(stepX, stepY)` on the map.
2. Draw the cloud above it, if any: top face, underside, and wall.
3. Look up the ground's height `h` and material.
4. If `rowsNow[h]` and `rowsPrev[h]` are both below `skyline[px]`, the ground is hidden. Skip it.
5. Otherwise fill the wall from `rowsPrev[h]` down to the skyline, then the top from `rowsNow[h]` down, in pixels that are still `EMPTY`. Write the depth too.
6. Raise `skyline[px]`.

The step size grows with distance so that each step is about one screen row of sea.

`drawSky(to, cam, world, span)` then fills what is left: sky bands above the horizon, haze below. `span` is how many rows the whole sky takes. The game passes it from the frame's height, so the sky looks the same on the sheet.

## Shade, fog and sparkle

- **Cloud shadows.** A ground pixel looks up the cloud map at a spot offset by `SUN_X`, `SUN_Y` times the height difference. Shaded pixels use `topShade` and `sideShade`.
- **Object shadows.** The same idea with the object's top-down outline (`caster.footprint`).
- **Fog.** Past `FOG_START`, colours are mixed toward `palette.haze` in `FOG_BANDS` steps.
- **Water.** Surf flickers by adding a time counter to a per-cell hash. Glints are rare cells that light up for a moment.

To add **time of day**, write one function that tints a colour for sunset or night, apply it to every colour in `buildPalette()`, and rebuild the palette when the time changes. Do not tint per pixel.

## Mistakes to avoid

- **Reading a map without the mask.** Every lookup must wrap, or the game breaks at the map's edge.
- **A size that is not a power of two.** Masks and shifts stop working.
- **Drawing the world after sprites.** The world only fills empty pixels, so it must go first.
- **Overwriting in the sweep.** Never write a pixel that is not `EMPTY` inside `drawWorld`. Near ground would be painted over by far ground.
- **Moving things in the height map.** The map is for things that stay put. Anything that moves is a sprite stack, depth-tested against the map.
- **A large picture.** The sweep costs one map lookup per screen column per depth step. Keep the picture near 400 pixels wide.
- **Assuming the horizon is level.** The sweep draws an upright world. A banked view comes from turning the finished picture (`roll.js`), never from the sweep.
- **Shimmer far away.** If distant ground flickers, lower `VIEW_DISTANCE` or start the fog sooner. Do not shrink the step size; that costs speed everywhere.

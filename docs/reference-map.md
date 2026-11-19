# A map of Dash's code

This page says where things are in the public build of Dash's "fighter", so you can find and read the part you care about.

Get the files first with `bun run fetch-reference`. Paths below are inside `reference/creativedash-fighter/`.

Line numbers are for published revision 43 (fetched 18 November 2026). They will drift when Dash updates the game, so search for the function name if a number is off.

This page describes his code. It does not reproduce it. Read it to learn, then write your own. See [getting-the-source.md](getting-the-source.md) for what you may do with the files.

## The files

| File | Lines | What it is |
| --- | --- | --- |
| `src/lib/scene.ts` | 2,132 | The first version's renderer: flight and three views. **Read this one first** |
| `src/lib/eject/scene.ts` | 4,826 | The current renderer: a copy of the above with combat, crashes and ejection added |
| `src/lib/jet-model.ts` | 114 | The jet as data: 13 slices of 34 × 46 |
| `src/lib/pilot-model.ts` | 97 | The pilot (sitting and hanging) and the ejection seat as voxel grids |
| `src/lib/voxel-sprite.ts` | 218 | Draws the small voxel models from any angle, with ink lines |
| `src/lib/cockpit.ts` | 1,201 | The cockpit: layered pixel art, live instruments and the head-up display |
| `src/lib/post.ts` | 185 | Glow, colour depth, vignette and film grain on the finished picture |
| `src/lib/flame-layer.ts` | 251 | The optional smooth flames, drawn with WebGL over the pixel canvas |
| `src/lib/sound.ts` | 325 | The sound mixer |
| `src/lib/eject/tutorial.ts` | 315 | The step-by-step tutorial |
| `src/components/fighter-jet-eject.tsx` | 1,033 | The current game's React component: canvases, input, on-screen text |
| `src/components/fighter-jet-scene.tsx` | 494 | The first version's component |
| `src/main.tsx` | | Forge's entry file. It lists the two versions and their settings |
| `tools/gen-pilot-model.mjs` | 323 | The script that builds the pilot model, which is modelled on the four-view drawing |
| `tools/gen-sounds.mjs` | 122 | The script that generated the sound effects with a text-to-sound service |
| `share-metadata.json` | | Every setting in the game's control panel, with its default |

## A reading order for `src/lib/scene.ts`

| Step | Where | What you learn |
| --- | --- | --- |
| 1 | Lines 1 to 130 | The header comment explains the whole approach. `DEFAULT_PARAMS` lists every setting. The constants give the world's sizes |
| 2 | `project`, line 1247, and the comment above it | The camera formula |
| 3 | `updateView`, line 712 | How three views are blended into one camera |
| 4 | `drawWorld`, line 1263 | The near-to-far sweep that draws islands and clouds as stacked columns |
| 5 | `drawJet`, line 1649 | Drawing the sprite stack, its flames and its outline |
| 6 | `render`, line 2033 | The order things are drawn in, and the rolled sheet for the cockpit |
| 7 | `step`, line 942 | Flight, steering, the camera's motion |
| 8 | `buildWorld`, line 464 | Islands, forests and clouds from a seed |

## How the first version does each thing

**The picture.** One `Uint32Array` (`fb`) with colours packed as `0xAABBGGRR` by `pack`. A second array, `zbuf`, holds a depth per pixel. `render` returns the same memory as bytes for `putImageData`.

**The world.** `N = 2048` and `HMAX = 40`: a 2048 × 2048 wrapping map with ground up to 40 layers tall. `buildWorld` adds six octaves of tileable noise, then picks the sea level from a histogram so that land covers the share set by the `land` setting. Land is cut into terraces: 8 grass levels, 4 rock levels and a snow cap. Forests are small cones of leaves stamped onto the lower grass.

**Clouds.** `NC = 1024`, `CK = 8`, `CLOUD_ALT = 40`: a 1024 × 1024 wrapping map, up to 8 layers thick, floating at height 40. Each cell holds a rank and a thickness in one byte. The `clouds` setting shows every cloud whose rank is under a threshold, so the slider adds and removes whole clouds.

**The camera.** `updateView` computes `vQ` (perspective), `vTan` (tilt), `vS` (scale) and `vYaw` (heading) from two weights, `vC` for the chase view and `vK` for the cockpit. Perspective is blended directly. Scale is blended through logarithms so the jet grows at an even rate. The weights each glide through three chained smoothing stages (`wChase`, `wCock` in `step`), which makes a view change start and end gently.

**The jet.** `drawJet` projects every voxel of every slice and plots it several times (2 to 8 samples a side, more when the jet is drawn larger) so a turned slice has no pin-holes. Slices are sorted by distance from eye level. The left and right halves are lit separately from the sun's direction. A mask (`jetMask`) records which pixels the jet touched, and a final pass outlines them. `dropOf` makes the slices fall into place for the intro.

**Flames.** Pixel flames are sliced the same way as the jet so they stack with it. With the "realistic" style the scene only measures where each flame is and writes 16 numbers per flame (`flameData`) for the WebGL layer.

**Trails and smoke.** Each wingtip keeps a ring of `TRAIL_N = 160` points. `drawTrails` joins them and thins them out with a dither pattern as they age. Smoke puffs live in one flat typed array (`smoke`) and are blended into the picture.

**Shadows.** In `drawWorld`, each ground pixel looks up the cloud map at a spot offset toward the sun. Jet shadows test the jet's top-down outline (`shadowMask`) the same way.

**The cockpit.** The view rolls with the jet. `render` draws the world onto a larger square sheet, `turnSheet` rotates it into the frame, and `drawCockpitView` lays the cockpit over it. Only the part of the sheet that will be visible is drawn (`colLo`, `colHi`, `rowLo`, `rowHi`). While this happens, `render` swaps the picture, depth and mask arrays for the sheet's, then swaps them back. The starter has its own, simpler version of this in `roll.js` and `cockpit.js`: two layers where his has four, and no radar or colour schemes.

**Flight.** `step` smooths everything with the same pattern: move a share of the way to the goal each frame. The jet follows the ground ahead (`groundAhead`) with room to spare, so in this version it cannot crash. A press shorter than `HOLD = 0.2` seconds is a roll and a longer one opens the thrusters. With nobody steering, the jet wanders by itself.

## What the current renderer adds (`src/lib/eject/scene.ts`)

| Feature | Start here | Constants worth reading |
| --- | --- | --- |
| Cannon, tracers, spent cases | `stepWeapons` 2043, `drawWeapons` 2826, `mountAt` 1408 | `SHOT_RATE` 18 a second, `SHOT_SPEED` 620, `SHOT_LIFE` 0.95 s, `GUN_MEET` 520 |
| Lock-on and missiles | `inSights` 1811, `fireMissile` 1471, `launchMissile` 1427, `drawSights` 2971 | `LOCK_RANGE` 950, `LOCK_TIME` 0.8 s, `MISSILE_DROP` 0.34 s, `MISSILE_RAMP` 0.5 s, `MISSILE_BURN` 1.9 s, `MISSILE_TURN` 3.4 rad/s |
| Enemy jets | `placeFoe` 1627, `syncFoes` 1660, `stepFoes` 1823, `hitFoe` 1792 | `FOE_MAX` 5, `FOE_HP` 5, `FOE_REACH` 430, `FOE_SHOT` 380 |
| Incoming missiles, dodge, slow motion, counter-attack | `stepInbound` 1674, `drawThreat` 3040, the start of `step` 3184 | `PARRY` 0.6, `SLOW_RATE` 0.13, `COUNTER_OPEN` 0.6 s, `VOLLEY` 3, `VOLLEY_GAP` 0.12 s |
| Damage and explosions | `hitPlayer` 1768, `lostJet` 1780, `explode` 2371, `blastAt` 1505, `stepWreckage` 2398, `drawWreckage` 2739 | `HULL` 6, `DEBRIS_N` 56, `BLAST_N` 6 |
| Ejection, parachute, rescue | `startEject` 2290, `openChute` 2330, `cutChute` 2345, `stepEject` 2474, `drawPilot` 3076, `canopy` 2696 | The `EJ_` stages, `MEET` 2.8 s, `FALL` 0.42 s, `HANDOVER` 1.3 s, `DRIFT` 13, `SINK` 15 |
| Loops flown by hand or by key | `startLoop` 1322, `loopOf` 1133, `leanOf` 1019 | `STEEP` 1.4 rad, `DIVE` 0.62 rad, `LOOP_T` 3.6 s |
| Jets cutting through clouds | `cutCloud` 1541, `stepClouds` 1571 | `CUT_N`, `CUT_HEAL` 11 s |
| Wake and spray over the sea | `wakeOf` 2235, `stepWake` 2242, `drawWake` 4030 | `WAKE_REACH` 24, `WAKE_LIFE` 2.8 s, `WAKE_N` 150 |
| Small drawing helpers | `box` 2616, `ball` 2627, `thread` 2646 | |
| The frame | `step` 3184, `render` 4577 | |

The functions it shares with the first version have moved: `updateView` 1038, `buildWorld` 642, `project` 3667, `drawWorld` 3683, `drawJet` 4114, `turnSheet` 4485.

Things that are easy to misread:

- **`PARRY` is not seconds.** Its comment says a roll throws a missile off if the roll is "no further through than this" when the missile arrives. It is a share of the roll.
- **Slow motion has two clocks.** The comment on `VOLLEY_GAP` says it runs "by the clock, not by the slowed time". Check which clock a timer uses before you change it.
- **Positions are in map pixels and the map wraps.** Forward for a jet is `(sin yaw, −cos yaw)`, because y runs down the map.
- **Pools, not lists.** Rounds, cases, debris, smoke, wake marks and cloud cuts each live in a fixed typed array with a few numbers per item. The `_N` constant is how many fit and the `_F` constant is how many numbers each one takes.
- **The scene tells the page what happened.** The component reads plain values from the scene each frame for the counters, the tutorial and the sound. Nothing in the scene touches the page.

## The other modules

**`jet-model.ts`.** `decodeJet` (line 101) returns 13 slices. The data is one base64 string of byte pairs, each a run length and a palette index. Palette indices are grouped in families of 16: body tones, accent tones, canopy tones and engine glow. Grouping lets the scene recolour one family from a single colour the player picks. That recolouring is in `rebuildPalettes` in the scene: each tone is rebuilt from the chosen colour according to how much lighter or darker it was than the family's key tone. The file also exports where the pivot, engines, nozzles and wingtips are on the model.

**`pilot-model.ts`.** `decodePilot` (line 85) returns three grids of 20 × 24 × 32 voxels. They use the jet's palette, so the pilot takes the jet's colours.

**`voxel-sprite.ts`.** `shellOf` (line 26) keeps only the voxels on the surface of a model and works out which way each one faces. `createVoxelPainter` (line 82) draws them into a small scratch area with its own depth, then inks the result: a dark line round the whole figure and a shadow line wherever one part passes in front of another. The jet does not use this, because it is only ever seen from above or behind. The pilot tumbles, so he needs it.

**`cockpit.ts`.** `buildCockpit` (line 213) paints the fixed metalwork once per frame size and colour scheme, as four layers at different distances from the pilot's eyes. `drawCockpit` (line 867) lays the layers over the view each frame, shifted by different amounts as the pilot's head sways, so near things move most. It then draws the live parts: radar, status screen, attitude ball, dials and the head-up display.

**`post.ts`.** `createPost` (line 16) returns the pass that finishes each frame. It works on the low-resolution picture, so the glow has the same big pixels as everything else. Every effect can be turned down to nothing.

**`flame-layer.ts`.** `createFlameLayer` (line 148) draws the optional smooth flames on a second, clear canvas at the screen's full resolution. It is the only use of the graphics card in the game.

**`sound.ts`.** `createSound` (line 73). Continuous sounds (engine, afterburner, wind, alarm) are mixed every frame from the game's state. One-off sounds are played on top. Nothing loads or plays until the player first clicks or presses a key, because browsers require that.

**`eject/tutorial.ts`.** `createTutorial` (line 119) walks through a list of steps and decides a step is done by watching counters the scene exposes. `lessonWords` (line 45) words each step for a mouse, a touch screen or a game controller.

**`fighter-jet-eject.tsx`.** The component sizes the canvas, runs the frame loop, and handles the mouse, keyboard, touch and game controllers. The counters, buttons, tutorial card and help panel are ordinary page elements laid over the canvas, which keeps text sharp.

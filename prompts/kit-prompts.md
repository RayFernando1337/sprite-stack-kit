# Prompts written for this kit

Two kinds of prompt are here: requests to give a coding agent that has this repository open, and one prompt that builds a game from nothing in a single file.

## For an agent working in this repository

The agent reads `AGENTS.md` and the skills by itself, so these can be short. Say what you want to see, not how to build it.

**Reskin**

```text
Using the sprite-stack-kit skills, change the starter into a different game with the same controls:
the craft is a red hot-air balloon, the world is a desert with mesas and a few oases, and there
are no clouds. Keep all three camera views. Run the checks and show me a snapshot of each view.
```

**A new object**

```text
Add sailing boats to the starter. About twenty of them drift slowly on open water, each a small
sprite stack with a white sail. They are hidden by islands and clouds the same way the craft is.
Follow the sprite-stack-models skill. Add a check that the boats are only ever on water.
```

**A new view**

```text
Add a fourth camera view to the starter: a map view from high above, with north at the top and
the whole island group in sight. Space reaches it after the cockpit, and the camera slides into
it like every other view change. The craft stays visible as a small marker. Read the
one-camera-views skill first. Add the view to the checks and show me a snapshot of it, and one
taken half-way through the move into it.
```

**A new instrument**

```text
Add a radar to the cockpit in place of the air vents on the left. It shows the nearest island
peaks as dots, turned so that ahead is up, and a ring that sweeps round once every two seconds.
Follow the cockpit-and-hud skill. It must fit a phone-shaped frame as well as a wide one, so show
me cockpit snapshots at 384 × 240 and at 200 × 420.
```
**A new game**

```text
Make a new game in examples/harbour by copying the starter. I steer a tugboat between islands and
push drifting crates into a marked harbour. Overhead view only. Keep to the kit's rules. Tell me
which parts of the starter you kept, changed and removed.
```

**When something looks wrong**

```text
The far islands flicker in the chase view. Follow the check-your-work skill: save snapshots that
show it, find the cause, fix it, and show me before and after frames.
```

## From nothing, in one file

Paste this into a model with no repository at all. It describes what this kit's starter does.

It has not been run against a model yet, so treat it as a starting point and adjust it. The cockpit (point 7) is the newest part and the most likely to need a second round. If you get a good result, please share your version in a pull request.

The order of priorities at the end follows the idea in [axu's prompt](axu-ai-pixel-fighter-spec.md). The term for the ground technique comes from [Levi's](leviwoyun-pixel-fighter.md).

```text
Build a playable browser flight game in one HTML file. Use no 3D engine, no WebGL, no libraries,
and no image or sound files. Every pixel is drawn by your own JavaScript.

HOW IT MUST BE BUILT

1. A software renderer. Draw the whole game into one low-resolution picture: a Uint32Array with
   one colour per pixel, and a Float32Array with a depth per pixel. Make it about 400 pixels
   across. Show it on a canvas with putImageData, scaled up by a whole number, with
   `image-rendering: pixelated`. Recompute the size when the window changes.

2. One camera. Project every world point with:
       scale = zoom / (1 + persp × depth)
       x = cx + scale × across
       y = cy − scale × (height + tilt × depth)
   With persp = 0 and tilt = 1 this is the flat overhead view. Raising persp gives a chase view
   from behind, with a horizon. A view change slides these numbers over about 1.2 seconds. Never
   cut between views. Space steps through the views: overhead, chase, cockpit.

3. A sprite-stacked craft. Define the craft in code as a grid of palette indices about 31 wide,
   42 long and 11 layers tall (0 is empty), mirrored left to right: delta wing, twin fins, canopy,
   two engines. Give each surface three tones and choose the tone from which way the cell faces.
   Draw each filled cell as a small flat tile through the camera, so the craft can turn, bank and
   pitch with no gaps. Draw the slices far from eye level first. Finish with a dark outline one
   pixel wide round the whole craft.

4. A stacked world. Make a 1024 × 1024 height map that wraps at its edges, from several layers of
   tileable noise and a fixed seed, with about 30% land. Each ground pixel has a height (0 to
   about 30 layers, in terraces) and a material with a top colour and a darker side colour: deep
   sea, sea, shallows, surf, sand, grass, trees, rock, snow. Draw it from near to far
   (Comanche-style voxel terrain): at each depth step and for each screen column, fill that
   ground pixel's wall and top only where nothing is drawn yet, and remember for each column the
   highest row reached. Fill what is left with a banded sky above the horizon.

5. Clouds. A second wrapping map holds how thick the cloud is at each point. Clouds float above
   the tallest ground and are drawn in the same sweep. Clouds and the craft cast shadows on the
   land and the sea.

6. Depth. Everything drawn after the world tests the depth array, so a hill or a cloud can hide
   the craft.

7. A cockpit view. A third pose of the same camera puts the eye inside the craft: the camera
   looks at a point a fixed distance ahead of the nose, and persp is 1 ÷ that distance. The
   craft dissolves with a dither pattern as the eye moves into it. The view banks with the
   craft: draw the world upright onto a larger off-screen picture, then copy it into the frame
   turned by the bank angle. Over that, draw a pixel-art cockpit made in code: a canopy frame
   and a dashboard painted once per size, and instruments drawn every frame from the flight's
   numbers (an attitude indicator, a heading tape, speed and height read-outs in a tiny pixel
   font, and a horizon line on the glass that stays on the real horizon).
HOW IT MUST FEEL

- Overhead view: the craft turns to face the pointer. Chase and cockpit views: point left or
  right to turn, up to climb, down to dive. Arrow keys and WASD work too.
- A click rolls the craft. Holding the button opens the thrusters: more speed, longer flames.
- The craft banks into turns and pitches with climbs. Every value eases toward its goal each
  frame. Nothing snaps.
- The craft follows the ground ahead with room to spare and cannot crash.
- White trails from the wingtips that thin out with a dither pattern, not with transparency.
- With nobody steering, the craft wanders by itself.

RULES

- No colour blending for fades. Use ordered dithering, and fog in about 8 steps.
- No Math.random in the game. One seed gives the same world every time.
- Nothing is allocated in the frame loop. Make typed arrays once and reuse them.
- Hints and buttons are DOM elements over the canvas. Cockpit read-outs are pixels in the picture.
- It runs at 60 frames per second on a laptop.

IF YOU RUN SHORT OF ROOM, protect quality in this order:
  1. The renderer, the world, the craft and overhead flight
  2. The chase view and the sliding camera
  3. Clouds and shadows
  4. The cockpit view: first the eye in the craft, then the banked picture, then the instruments
  5. Trails, flames and polish

Output the complete file. Do not leave placeholders.
```

### Ways to change it

- **A different craft.** Replace the shape in point 3: "a galleon with three masts", "a dragon with spread wings", "a hovering car".
- **A different world.** Replace the materials in point 4: "dunes, rock and oases", "ice floes and dark water", "a city of flat-roofed blocks".
- **More game.** Add a section after "How it must feel", and add it to the priority list in the place you want it protected.
- **A size limit.** Levi's prompt asks for a total under 40 KB. A limit like that pushes a model toward compact code.

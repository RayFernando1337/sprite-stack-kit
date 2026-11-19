# Glossary

The words this kit uses, in plain language. Where a word names something in the code, the file is given (all in `examples/starter/src`).

## The picture

**Framebuffer.** The picture the game draws into: an array with one number per pixel. The kit's documents usually just call it "the picture". `framebuffer.js`.

**Software renderer.** A program that works out the colour of every pixel itself, on the processor, with no help from the graphics card. The whole starter is one.

**Game pixel, screen pixel.** A game pixel is one cell of the picture. A screen pixel is one dot of your display. Each game pixel is shown as a square of 2 to 8 screen pixels.

**Packed colour.** Red, green, blue and alpha stored together in one 32-bit number. `rgb(r, g, b)` makes one.

**Empty.** A pixel that nothing has drawn yet. It holds 0, which no real colour does.

**Depth array.** A second array, the same size as the picture, that holds how far into the view each pixel's surface is. Things drawn later test it, so near things hide far ones. Elsewhere this is called a depth buffer or z-buffer.

**Dithering.** Showing something faintly by drawing only some of its pixels, in a fixed pattern, with no blending of colours. The kit uses the 4 × 4 **Bayer** pattern, `BAYER4`.

**Sheet.** A second picture, bigger than the frame, that the world is drawn on when the view is banked. It is then turned into the frame. `roll.js`.

**Layer.** In the cockpit: a picture painted once and copied over the world every frame. A pixel of 0 in a layer is see-through. `cockpit.js`.

## Shapes

**Sprite.** A small flat picture of a game object.

**Sprite stack.** A pile of flat pixel pictures, one per layer of height. Drawn one pixel apart and turned together, the pile reads as a solid object.

**Slice.** One of the flat pictures in a stack.

**Cell.** One square of a slice. Elsewhere, a filled cell of a 3D grid is called a **voxel**, short for "volume pixel".

**Grid.** A whole model as numbers: width × length × height cells. `model.js`.

**Palette, palette index.** The palette is a model's short list of colours. A cell holds a palette index, a small number that picks one of them. Index 0 means the cell is empty.

**Pivot.** The cell a model turns about.

**Outline.** The dark line one pixel wide that is drawn round a finished stack.

**Footprint.** A model seen from straight above, as filled or empty. It is used to cast the model's shadow.

## The world

**Height map.** A map that holds a height for every ground pixel. `world.js`.

**Material.** What a ground pixel is made of: deep sea, sand, grass, rock, snow. Each material has a top colour and a side colour.

**Wrapping.** Leaving one edge of the map brings you in at the opposite edge. Map sizes are powers of two, so that wrapping a position is a single cheap operation called a **mask**.

**Sweep.** The way the ground is drawn: one step of depth at a time, from nearest to farthest. `terrain.js`.

**Skyline.** For each screen column, the highest row the ground has reached so far in the sweep. Anything below it is already hidden.

**Haze, fog bands.** Distant ground is mixed toward the haze colour in a few flat steps.

**Seed.** The number all randomness comes from. The same seed always makes the same world. `rng.js`.

**Repeatable.** The same seed and the same input always draw the same frames. Elsewhere this is called deterministic.

**Noise, tileable noise.** Smooth random bumps used to shape the land. Tileable noise matches at its opposite edges, so the map can wrap without a seam.

## The camera

**Projection.** Turning a point in the world into a pixel on the screen. `project()` in `camera.js`.

**Focus.** The world point the camera looks at. It lands on the screen at `cx`, `cy`.

**`across`, `depth`, `height`.** Where a point is, measured from the focus: across the screen, into the screen, and upward.

**`zoom`.** Screen pixels per world pixel at the focus.

**`persp`.** How strong the perspective is: 1 divided by the distance from the eye to the focus. At 0 the eye is infinitely far away and nothing shrinks with distance.

**`tilt`.** How steeply the eye looks down. It is the tangent of the angle: 1 is 45°, 0 is level.

**Heading.** A compass direction. 0 is north and it grows clockwise.

**Horizon.** The screen row where the sea meets the sky. Everything at the eye's own height lands on it.

**Pose.** One complete set of camera settings (for a view), or one complete set of position and angles (for a model).

**View.** A camera pose with a name: overhead, chase or cockpit.

## The craft

**Yaw.** Which way the craft points on the map. The craft's own heading.

**Roll, bank.** Tipping to one side. A positive roll dips the right wing. The bank is the roll the craft holds in a turn.

**Pitch.** Nose up or nose down. A positive pitch lifts the nose.

**Barrel roll.** One full turn about the craft's long axis. A click does it.

## Motion

**Easing.** Moving a share of the way to a goal each frame, so nothing jumps. `ease()` in `game.js`.

**Spring.** A smoothing that also carries speed, so a move starts gently as well as ending gently. The view change uses one. `glide()` in `game.js`.

**Frame.** One finished picture. Also the time between two of them.

**`dt`.** The seconds since the last frame. Motion is multiplied by it so the game runs at the same speed on every screen.

**State map.** A file beside a game, `states.js`, that lists what the player can do, the states the game can be in, and the rules that must hold in every one. `bun run states` walks all of it on the real game.

**Pool, ring.** A fixed array used for things that come and go, such as trail points. When it is full, the oldest entry is overwritten. Nothing is created or freed.

## The cockpit

**Canopy frame.** The arch of metal round the glass.

**Head-up display (HUD).** Marks that seem to float on the glass: a horizon line, a nose marker, and numbers.

**Attitude ball.** The round instrument that shows sky above a line and ground below it. The line always lies along the real horizon.

**Compass tape.** A strip of heading marks that slides past a fixed pointer.

## Older techniques people compare this to

**Mode 7.** A Super Nintendo trick that stretches one flat picture to look like a floor. It has no height.

**Voxel Space.** Drawing a height map column by column, near to far. Named after the engine of NovaLogic's *Comanche* (1992). The kit's ground sweep is a relative.

**Ray marching.** Sending a ray through every pixel to find what it hits, usually on the graphics card. Nothing in the kit does this.

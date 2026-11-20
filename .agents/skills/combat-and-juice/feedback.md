# Feedback

Everything here is Dash's design unless it says "kit". His version blends colours for smoke, foam and rings. This kit dithers them instead, and the recipes below say how.

## What answers what

Build each row whole. A row with one cell filled is the flat game this skill exists to prevent.

| Event | In the world | Camera and light | Sound |
| --- | --- | --- | --- |
| A round is fired | Tracer, muzzle flash, spent case | | Gun loop. Everything else drops to half |
| The trigger is let go | | | The gun's tail: last rounds and an echo |
| A round meets the ground | A puff of dust, or a spurt of water | | |
| A round hits an enemy | Three sparks, carried along with the enemy | | Kit: a short tick. His has none |
| An enemy is shot down | Blast, six pieces of wreck (half of them burning), ten sparks. The wreck falls, spinning and smoking | Shake 0.4, flash 0.4 | Explosion |
| The wreck meets the ground | A bigger blast with smoke that hangs, or a splash with a foam ring | Shake 0.5, flash 0.5 | Explosion, or splash |
| A round hits the player | Four sparks. Smoke from the craft at half hull | Shake 0.4, flash 0.1 | A hard metal hit |
| A missile hits the player | A blast on the craft, and all of the row above | Shake 0.4, flash 0.3 | Blast and hit |
| Locking on | Corner brackets closing on the enemy, blinking | | Pips that quicken |
| Locked | Brackets shut and red, a pulsing diamond | | A steady higher warble |
| A missile is launched | It drops, lights with a flare and a burst of smoke, leaves a trail | | A clunk, then the motor |
| A missile is coming | Two rings closing, a wedge for its direction, a red missile with a long flame | | Low pips that quicken, then a high urgent one |
| A missile is dodged | It passes beside the craft and bursts behind | Slow motion. Corners darken, colours deepen | A whoosh. All else sinks to a murmur |
| Into a cloud | A ring of vapour bursts open. A channel is cut | Mist over the cockpit glass | A rush, and more wind |
| Low over the sea | Foam wake and spray | | A water loop |
| The player's craft is lost | See `enemies.md` | Shake 1, flash 1 | The loudest explosion |

## Shake

One number from 0 to 1. Set it with `shake = Math.max(shake, amount)`, never by adding, so ten hits in a burst do not throw the picture off the screen. Let it die with `shake *= Math.exp(-dt * 4.5)`.

His shake moves the picture sideways only, by about 3 pixels times `shake`, on a fast sine of the game's time (about 14 swings a second). It uses the slowed clock, so it slows in slow motion.

Kit: add the offset to `cam.cx` straight after `aimCamera` sets it, as `settle()` in `examples/worldfight/src/game.js` does. Or add it at the top of `render()` and take it off before returning. The banked cockpit path in `render()` reads `cam.cx`, so change it nowhere else. The world and every mark placed with `project()` move together. The cockpit's layers and read-outs fixed to the screen are drawn at fixed places, so they stay still. Give `TUNING` a `shake` setting that scales it, down to 0.

## Flash

One number from 0 to 1, set the same way, dying with `Math.exp(-dt * 9)`. It is gone in a third of a second. His flash blends the picture toward white.

Kit: dither it. After the world is drawn, and before the cockpit and the HUD, set a pixel to a warm white where `Math.min(3, flash * 7) > 15 - BAYER4[((y & 3) << 2) | (x & 3)]`. The cap of 3 lights three pixels in sixteen at most, so the fight still shows through. Skip the loop when the flash is under 0.01.

## A blast

Six blasts can burn at once. Each is one object made at the start: where, how long ago, how big, and whether it is over water. Sizes: a missile 1, an enemy shot down 1.3, a wreck meeting the ground 1.6.

Starting one also sets shake and flash to 0.3 × its size, throws ten sparks, and over water throws a dozen puffs of spray outward.

It is drawn from its age alone, with `hash2` giving each part its own numbers. Nothing is stored per fireball. It lasts 1.5 seconds.

1. **The first 0.07 seconds:** one near-white disc, growing fast.
2. **Six fireballs.** Each starts up to 0.12 seconds late and lives 0.5 to 0.9 seconds. It sits a few pixels off centre and rises. Its radius grows quickly and then slowly, to between 3 and 7 pixels. Its colour steps with age: yellow, orange, red, soot. For its first 40% it has a brighter core at about half its radius. Over its last 40% it thins to nothing.
3. **Over land:** a puff of black smoke every few frames for most of a second.
4. **Over water:** a ring of foam racing outward and slowing, with gaps that change, and nine columns of spray that rise and fall back.

Scale every size by `cam.scale`. Draw it a few units nearer than it is (`cam.depth - 3`), so the hillside it struck does not hide it. Make five flat fire tones once, from near-white to soot, in your own colours.

Kit: one helper draws every fireball, puff of smoke and splash.

```js
// Call after project(). strength is 0..1. The edge is always ragged: fire and smoke, not a coin.
function puff(to, cam, radius, tone, strength) {
  const W = to.width
  const cx = cam.sx
  const cy = cam.sy
  const near = cam.depth - 1
  const x0 = Math.max(0, Math.floor(cx - radius))
  const x1 = Math.min(W - 1, Math.ceil(cx + radius))
  const y0 = Math.max(0, Math.floor(cy - radius))
  const y1 = Math.min(to.height - 1, Math.ceil(cy + radius))
  const inv = 1 / (radius * radius)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d2 = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) * inv
      if (d2 > 1) continue
      const at = y * W + x
      if (to.depth[at] < near) continue
      if (strength * 16 * (1.6 - d2 * 1.2) > BAYER4[((y & 3) << 2) | (x & 3)]) to.color[at] = tone
    }
  }
}
```

## Debris and sparks

One pool of about 56, eight numbers each: position, velocity, when it was thrown, and what it is. Gravity is about 150 px/s². A piece ends when it meets the ground.

- **A piece of the craft:** a box of one or two pixels in the craft's own tones. It lasts up to four seconds and splashes if it lands in the sea.
- **A burning piece:** flickers between two fire tones and leaves a thread of small smoke puffs.
- **A spark:** one pixel with a short tail drawn back along its path. White, then yellow, then orange. Each burns out in its own time, 0.7 to 1.6 seconds.

Sparks from a hit leave with about half the target's velocity plus up to 60 px/s any way. Sparks from a blast fly out 20 to 90 px/s and up 30 to 120.

## Smoke

The biggest pool: about 360 puffs of ten numbers. Position, when, size, a push (x and y), strength, life and kind. A missile alone drops 60 a second.

- Three kinds: grey for dust and exhaust, white for vapour, spray and missile trails, black for wrecks.
- A puff is shoved by its push at first and the shove dies away in a fraction of a second. Then it hangs and rises: black fastest, white slowly, grey hardly at all.
- Its radius grows to about three times its size over its life.
- Its strength follows `(1 − age)²`, with a quick fade in at the start so it does not pop.

Kit: draw it with `puff()` above. Give each kind two or three flat tones and step through them with age. Skip a puff wider than about 60 pixels. It is beside the eye and would cover the picture.

## Glow, corners, grain

His last step over every frame. In this kit it goes in its own `post.js`, called at the very end of `render()`. Make every buffer in `resize`.

- **Glow.** The palette is flat, so the exact colours of fire, flames, nozzles, the sun and sea glints can be listed, each with a weight. A table indexed by the top five bits of each channel says how much a pixel shines. Add up what shines at half size, blur it with two passes of a box blur each way, and add it back. This is what makes tracers and explosions look hot.
- **Corners.** A table built in `resize` that is 0 across the middle and rises smoothly into the corners. Darken by it at about 0.3. Add 0.6 while time is slow.
- **Colour.** He raises saturation and contrast a little, and more while time is slow. Kit: in normal play choose richer palette colours instead, and save the pass for slow motion.
- **Grain.** Off by default in his game. Kit: if you add it, take it from `hash2(pixel, (time * 24) | 0)`. A generator that runs on from frame to frame makes a frame depend on how many were drawn before it, and the replay check fails.

Three cautions, all kit:

- The checks and the starter's `states.js` find the craft by counting pixels of `model.outline`. A pass that changes every pixel breaks them. Keep the middle of the corner table at exactly 0, and add glow only where there is something to add. A flash and the slow-motion look do change pixels all over the picture for a moment, so a rule in the game's own `states.js` that counts a colour should not be asked while `flash` or `slow` is above 0. Say so in the rule's name. Run `bun run check` after adding each pass.
- A blur over the whole picture costs time. `bun run check` prints milliseconds per frame. Compare before and after.
- These passes change the finished picture only. Nothing in `update` may read them.

## Clouds that part

A craft in the cloud layer cuts a channel through it, and the cut closes again later.

- Cut only when the craft's `z` is between `CLOUD_BASE − 3` and `TOP_Z + 3`.
- Set every cloud cell within about 12 px of the craft to 0. Roughen the radius by a pixel or two with `hash2` of the cell, so the edge is ragged. Thin the cells just beyond it by two layers.
- Remember each cell you changed and when, in a ring of two typed arrays (cell index, time). After about 11 seconds put back the oldest from a copy of the clouds as they were made. If the ring fills, put the oldest back at once.
- Enemies and falling wrecks cut too.
- While the player is inside: vapour puffs stream off the wingtips, about 60 a second. On the frame of entry: a ring of 14 puffs bursting outward, and a sound. In the cockpit, a `mist` number eases up (rate 9) and down (rate 4), and whitens the view.

Kit:

- **Cut a copy.** The tools build one world and pass it to many games, so writing to the shared `world.cloudMap` leaks from one game into the next. In `createGame`, give the game its own: `{ ...world, cloudMap: world.cloudMap.slice() }`, and keep a second copy to heal from.
- **Find the right cell.** Clouds drift. `drawWorld` in `terrain.js` reads cell `(x + cloudX) & CLOUD_MASK`, where `cloudX` comes from `CLOUD_DRIFT_X` and the time. Use the same sum, or the hole appears beside the craft. Those two constants are private to `terrain.js`, so export them.
- The ground shadow of a cloud is read from the same map, so the cut shows in the shadow for free.
- Draw the mist by dithering, not by blending.

## Wake over the sea

- **How strong:** 0 unless the craft is over water (`world.materials` there is under `WATER_BELOW`) and within about 24 px of it. Full at about 7 px. Scaled by speed.
- **Foam marks:** a ring of about 150, six numbers each: where, when, how strong, and which way is across the wake. Drop one every 2 or 3 px flown. Each lasts about 3 seconds.
- **A mark is drawn as** two foam discs that move apart sideways and grow, from 3 px to about 30 px off the centre line, plus a churned strip down the middle that is gone by half-way. In the chase view, squash the discs to match the tilt of the sea. Break the edge up with `BAYER4`, more as it ages. It should look like foam, not paint.
- **Spray:** 40 to 110 white puffs a second, thrown out sideways from just behind the craft.
- Every craft throws spray. Only the player's leaves foam.

Draw the wake first among the world's effects. It lies on the water, under everything else.

## The sights

Marks on the glass. They ignore depth, so use `line` and `box` from `paint.js`.

- A small chevron above every enemy. A second one, flashing, above one that is attacking.
- For an enemy outside the frame, a small square at the edge, on the side to turn toward.
- On the lock candidate, four corner brackets that start at twice the enemy's size and close as the lock fills, blinking fast, in yellow.
- Locked: the brackets are shut and red, with a diamond inside that pulses.

Kit: draw these at the end of step 5 into `to`, without the depth test, while the camera is still set up for that picture. In a banked cockpit view they then turn with the world. Drawn into `fb` afterwards they would sit where the enemy was before the picture was turned. The missile warning rings are fixed to the screen, so they belong in step 7.

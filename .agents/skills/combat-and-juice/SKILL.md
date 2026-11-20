---
name: combat-and-juice
description: "What makes a fight in a sprite-stack game fun, and how to build it in sprite-stack-kit: a fast cannon with tracers and spent cases, lock-on and homing missiles, enemies that threaten in ways the player can read, a dodge rewarded with slow motion and a counter-attack, damage, explosions, debris and smoke, shake, flash and glow, clouds that part, wake on the sea, sound made in code, and a tutorial. Has a fun bar to hold a game against and a way to test it with scripted pilots. Use when adding or tuning weapons, enemies, projectiles, damage, explosions, particles, screen effects or sound, when a game works but feels flat or slow, and before calling any game with fighting in it done."
---

# Combat and juice

"Juice" is everything a game does in answer to the player beyond the bare rule: the sparks, the shake, the sound, the smoke. A fight can keep every rule in the entry skill and still be dull. This skill says what makes the dogfight in Dash's game fun, and how to build the same in this kit.

The ideas marked "Dash" were read in his code (`docs/reference-map.md` says where). The numbers here are starting points, given as rounded values for the starter's speed of 84. They are not his tables. Tune them, but know what each one is for before you change it.

## Why his dogfight is fun

1. **The gun is a hose, not a pistol.** About 18 rounds a second from two guns in turn, flying about seven times as fast as the craft. The player aims by pointing and walks a visible stream onto the target.
2. **Kills are quick. Getting into position is the fight.** Five rounds or one missile brings an enemy down. A new enemy arrives a few seconds later.
3. **Two weapons ask for two skills.** The cannon wants you close and steady. A missile wants the target held in front for most of a second, then flies itself.
4. **Every threat is announced before it lands.** Enemy rounds are slower than yours and red. An attacker is marked. A missile shows two closing rings and a beep that quickens. Nothing hurts the player from nowhere.
5. **One move answers every threat, and good timing pays.** A roll lets rounds pass. A roll begun just before a missile arrives throws it off, slows time, and opens a counter-attack of three missiles.
6. **Pressure comes in waves.** Two attackers at most. Bursts, then pauses. One enemy missile in the air at a time. The hull mends when left alone.
7. **Everything that happens is answered several ways at once, in the world.** A hit is sparks, a jolt, a flash and a sound in the same frame. The counter on the screen is the least of it.
8. **The world notices the craft.** Clouds tear open, the sea is churned into a wake, rounds kick up dust and spray.
9. **Losing is a show, not a stop.** The pilot ejects, a new craft collects him, and the fight goes on. Only the kill tally is lost.

## How it fits the kit

These parts are fragile. Keep them exactly.

- **Own files.** `combat.js` (weapons, enemies, damage) and `fx.js` (smoke, debris, blasts) beside `game.js`, called from `update` and `render`. `sound.js` and any tutorial sit beside `main.js` and read the game. The game never touches the page.
- **Pools.** Every round, case, spark, puff and wake mark lives in a `Float32Array` made once, with a head that wraps. The pattern is in the `game-feel` skill under "Particles". Missiles, blasts and enemies are a few objects made once and switched on and off. No `push`, `filter`, `find`, object literal or string in `update` or `render`.
- **Chance.** Use `hash2(slot, (time * 60) | 0)` from `rng.js` for scatter, sizes and timings. It needs nothing stored and replays exactly.
- **Two clocks.** `update` gets real seconds. Slow motion makes a second, slower `dt` for the world. Timers the player's hands are on stay on the real one. See `enemies.md`.
- **Counters out.** The game exposes numbers that only go up (`rounds`, `hits`, `kills`, `evades`) and a few levels (`threat`, `lock`, `slow`). Sound, the tutorial, the tests and `states.js` all read these. An event list would allocate.
- **Into the one picture.** World things are drawn in step 5 of the frame (see `software-framebuffer`), test `depth`, and fade by dithering with `BAYER4`. Sights and warnings are step 7. Flash, glow and vignette run last over `fb.color`.
- **One set of coordinates.** The craft's `x` and `y` are never wrapped. Place enemies and rounds relative to it and use plain differences. Only map look-ups wrap, and `groundAt` does that itself.

## Read the part you are building

| File | Covers |
| --- | --- |
| [weapons.md](weapons.md) | Cannon, tracers, spent cases, muzzle flash, ammunition, lock-on, missiles, hit tests, controls |
| [enemies.md](enemies.md) | How enemies fly and attack, enemy missiles, the warning, the dodge, slow motion, the counter-attack, hull, losing the craft |
| [feedback.md](feedback.md) | What answers each event, explosions, debris, smoke, shake, flash, glow, vignette, grain, clouds that part, wake, sights |
| [sound.md](sound.md) | Sound made in code with Web Audio: the mix, each sound as a recipe, what the game exposes |
| [playtest.md](playtest.md) | Scripted pilots, what to measure, rules for `states.js`, the tutorial |

Build in this order, checking after each: cannon and tracers, enemies that can be shot down, feedback for hits and kills, enemies that shoot back, the missile and lock, the enemy missile and dodge, sound, the world's reactions, the tutorial. A game is fun to fire in after the first step, or the first step is not done.

## The fun bar

Hold the game against this before you call it done. `playtest.md` says how to measure each line with no person.

- [ ] Holding the trigger sends 15 to 20 rounds a second, and at least ten streaks are in the picture.
- [ ] A round crosses the picture in under a second. The lead on a crossing enemy 200 px away is less than its own length.
- [ ] A steady aim kills in under a second. A careful pilot gets a kill every 5 to 15 seconds.
- [ ] Within 20 seconds of the start, something is shooting at the player.
- [ ] Every threat can be seen for at least a second before it lands, and has an answer.
- [ ] A well-timed dodge gives the player something: slow motion and a stronger attack.
- [ ] A careful pilot wins but takes damage. An idle pilot loses the craft. A pilot who only holds the trigger hits little.
- [ ] Firing, hitting, being hit, a kill and a near miss each change the picture in the world, move the camera or the light, and make a sound. Count three answers for each.
- [ ] Losing the craft takes a few seconds, looks good, and ends with the player flying again.
- [ ] The same seed and input draw the same frames, with all of it switched on. Nothing is created in the frame loop.
- [ ] A new player is shown each move once, in a safe setting.

If a line does not suit the game, say so in the report. Do not drop it silently.

## Mistakes you can predict

- **Single slow shots.** Six rounds a second at three times the craft's speed reads as a pea-shooter, and a turning target walks out of the way. Raise the rate and the speed before anything else.
- **Enemies that never threaten.** One shot every second or so that a gentle turn avoids is not a threat. Give them bursts aimed ahead of the player, and a missile that must be answered.
- **Threats with no warning.** Fast enemy rounds, or a missile with no mark, feel unfair. Slow theirs down and mark them.
- **Feedback only in a bar or a number.** If a hit changes nothing but the hull display, the player does not feel it.
- **A kill that is over at once.** A pop and a vanished sprite wastes the best moment. Let the wreck fall, burn and hit the ground.
- **Enemies that all attack together,** or never stop. The player needs gaps to hunt in.
- **Effects that break the replay.** `Math.random()`, the clock, or anything read from the page. `bun run check` fails on `Math.random(` in any file under `src/`, `sound.js` included.
- **Effects that allocate.** A list of events, a new object per round, a `filter` over the enemies each frame.
- **Slowing every timer.** In slow motion the reward window must run on real time, or it stretches to many seconds.
- **Blended smoke.** His smoke is blended. This kit's is dithered. Do not carry the blend over.
- **Sound files.** His sounds are recordings. This kit makes its own in code.

## Credit

If you build any of this, add a line to Dash's entry in `CREDITS.md` naming the techniques you followed, as the `study-the-reference` skill asks.

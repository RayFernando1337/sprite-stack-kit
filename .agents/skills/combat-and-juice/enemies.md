# Enemies, threats and the dodge

Everything here is Dash's design unless it says "kit". Distances are world pixels.

## An enemy is a craft with three states

Flying, falling, and gone (waiting to come back). Make each enemy once: a pose for `drawStack`, hit points, a state, a few timers. Three is a good number in the air. Five is his most.

A flying enemy moves the way the player does: a wanted turn rate, `yawRate` easing toward it (rate about 2), bank following turn rate, speed easing toward a wanted speed.

**Wandering.** Two slow sine waves steer it, with a different phase for each enemy. It flies at about 0.8 × cruise, near the player's height, clear of the ground ahead.

- More than 700 away: it turns back toward the player and flies faster than the player can. The player can never lose the fight by flying off.
- Closer than 130 and facing the player: it turns away, so it never sits on top of the craft.
- Locked on to, or with a missile after it: it adds a hard turn that flips sides every second or two. It jinks.

**Attacking.** Each enemy has a timer. When it runs out the enemy starts an attack, but only if fewer than two others are attacking. An attack lasts 11 to 16 seconds and a rest 4 to 9. The first attacks are staggered (7 seconds, then 4 more for each enemy), and nobody fires in the first 6 seconds of a game. These gaps are when the player hunts.

An attacker:

- Steers for the **lead point**: where the player will be when a round fired now gets there (`player + playerVelocity × distance ÷ roundSpeed`).
- Hurries when far (1.5 × or more), matches the player a little faster when near, drops just under the player's speed when close behind, and breaks hard to one side under 80.
- Flies at exactly the player's height.

**Its gun.** When it is 110 to 430 away, its nose is within 0.14 radians of the lead point and it is about level, it fires a burst: 0.6 seconds at 9 rounds a second. Then it waits 0.9 to 1.8 seconds.

- Its rounds fly at about 380, two thirds of the player's. They can be seen coming.
- They are aimed at the lead point with a little scatter. So they hit a player who flies straight, and miss one who turns or rolls. This is the whole trick: the threat is real, and the answer is to fly.

**Two craft in the same air** (within 12 across and 6.5 up) destroy each other. That goes for the player and an enemy too.

**Falling.** At no hit points it explodes and becomes a wreck: it noses down to about −1 radian, spins at 3.4 radians a second, falls under gravity, and pours a puff of black smoke every 0.03 seconds. When it meets the ground there is a second, bigger blast, or a splash on the sea. This takes a few seconds and is the player's reward. Do not cut it short.

**Coming back.** After 3 to 5.5 seconds it is placed 640 to 900 away, in any direction. The very first enemies are placed 360 to 620 away within about a radian of the nose, so the player sees them at once.

## The enemy's missile

- Only one is in the air at a time. An attacker fires it from 250 to 640 away, with its nose within 0.3 radians of the player. Then no enemy fires another for 11 to 19 seconds.
- It speeds up to the player's speed plus about 170, and turns at about 3 radians a second. The player cannot outrun it or out-turn it, and it still takes a few seconds to arrive. Only the dodge answers it.
- It takes 4 of the hull's 6. Two end the craft.
- Every frame, work out the seconds until it arrives: distance ÷ closing speed. Expose that as `threat`, with the direction it is coming from.

### The warning

Two rings round the craft. In the cockpit they sit in the upper middle of the screen.

- The inner ring is fixed, about 5% of the frame's short side and at least 9 pixels.
- The outer ring is dashed. Its radius shrinks toward the inner ring as `threat` falls, starting from about three seconds out.
- A wedge on the outer ring shows where the missile is coming from. The top is dead ahead.
- When `threat` is under about half a second both rings turn red and flash 16 times a second. The beep changes too (see `sound.md`).

The lesson for the player is one sentence: roll when the rings meet.

### The dodge

When the missile arrives (within about 7 px plus one frame of closing):

```js
const dodged = craft.spin >= 0 && craft.spin <= PARRY // PARRY = 0.6: a share of the roll, not seconds
```

With the starter's `rollSeconds` of 0.75, that is a roll begun in the last 0.45 seconds. A roll cannot restart until it ends, so rolling all the time still fails often. A wider window makes the dodge free. A much narrower one makes it luck.

- **Not dodged:** a blast on the craft, and the hull loses 4.
- **Dodged:** the missile goes blind. Move it to just beside the craft, a wing's breadth off on the side it was nearer, so the player sees it go by. It flies on and explodes 0.7 seconds later, behind. Count it in `evades`. Start slow motion. Open the counter-attack. Remember which enemy fired.

## Slow motion: two clocks

```js
const real = clamp(seconds, 0, 0.05)
slowLeft -= real
const deep = slowLeft > 0.3 ? 1 : 0
slow += (deep - slow) * ease(real, deep ? 30 : 8) // in at once, out over the last third of a second
const dt = real * (1 - (1 - SLOW_RATE) * slow) // SLOW_RATE = 0.13
time += dt
```

| On the real clock | On the slowed clock (`dt`) |
| --- | --- |
| The slow motion's own countdown (1.3 s) | `time`, and so every particle's age and every flicker |
| The counter-attack window | Flight, enemies, rounds, missiles, smoke |
| The gap between the three counter missiles | His shake and flash dying away |
| Kit: the click-or-hold timer, the idle timer and the glide between views, so the controls feel the same | |
| Kit: shake and flash dying away, or one flash hangs for seconds | |

While `slow` is above 0 the picture changes with it: the corners darken and the colours deepen (`feedback.md`), and all sound sinks to a murmur (`sound.md`). Expose `slow` for both.

## The counter-attack

The window is the slow motion plus 0.6 seconds, by the real clock. Pressing the missile button inside it fires three, 0.12 real seconds apart, so they leave during the slow motion and the player watches them go.

- They light at once, with no drop.
- They leave fanned out: one up and left, one up and right, one straight over the top.
- They hold the fan for about 0.2 seconds, then turn as hard as they need to. They burn until they arrive. They cannot miss.
- The target is the enemy that fired, or else the locked one, or else the nearest.
- The first two burst on the target without ending it. The third ends it. Three explosions in a row.
- They use no ammunition. Count the volley in `counters`.

His page also shows a short note: "Evaded", then "Counter ×3".

## The hull

- Six points. A round takes 1, a missile 4.
- Six seconds without a hit and it mends, one point every three seconds. Breaking off is a real choice.
- At half or less the craft trails thin dark smoke, a puff every 0.07 seconds. Nearly gone, thicker smoke every 0.03. The player reads the hull in the world, not in a bar.
- After the craft is lost, enemies hold their fire until the player is flying again and for 5 seconds more.

## Losing the craft

There is no game-over screen in his game. At no hull:

1. A large blast. The kill tally goes back to 0. That is the whole penalty.
2. The canopy flies off and the pilot is shot upward on a rocket for a quarter of a second. The camera pulls back to watch.
3. The empty craft noses over, spins, burns, and hits the ground with the biggest blast in the game: full shake, full flash, a ring racing out, 14 pieces, 30 sparks, and smoke for five seconds.
4. A parachute opens at the top. The pilot swings under it on a spring. The camera comes in close.
5. A new craft comes in from behind and below, slowing. Under three seconds after the parachute opened, the pilot lets go and drops into its open cockpit as it passes. The canopy shuts and the thrusters kick.

He also lets the player do this on purpose by holding a dive into the ground.

Kit:

- His pilot is a small voxel model with its own painter, which this kit does not have. A stack seen from the side thins to lines. Draw the pilot and parachute as a few pixels with depth-tested discs and lines, or keep the camera on the falling wreck and bring the new craft in.
- Keep `game.craft` as the same object and move it. The tools hold on to it.
- `bun run check` expects that a held dive never reaches the ground. Lose the craft through the hull, and add a crash by diving only if the user asks.

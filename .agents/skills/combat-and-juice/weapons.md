# Weapons

Everything here is Dash's design unless it says "kit". Speeds are world pixels per second for a craft that cruises at 84.

## The cannon

The game gets `setFire(held)` from the page and keeps a timer:

```js
if (firing && rounds > 0) {
  gunDue -= dt
  while (gunDue <= 0) {
    gunDue += 1 / RATE
    fireRound()
  }
} else gunDue = 0
```

The `while` keeps the rate true at any frame rate. Setting `gunDue` to 0 on release means the first round leaves on the frame the trigger is pressed. A delay there feels like lag.

| Number | Start with | What it is for |
| --- | --- | --- |
| Rate | 18 a second, from two guns in turn | Under about 10 the eye sees single shots. At 18 it sees a stream |
| Speed | 560 to 620, about 7 × cruise | The lead on a crossing enemy 200 px away stays under its own length, so pointing is aiming |
| Life | 0.9 s | A reach of about 500 px: further than the player can aim, so the stream fades out and never just stops |
| Meeting point | 500 px ahead | The two streams toe in and cross there, which reads as one weapon with depth |
| Scatter | About ± 6 px/s on each axis | Enough that the stream is not a ruled line |

A round is eight numbers in a pool of about 72: position, velocity, when it was fired, whose it is. To end one, set its birth time to `-1e9`.

Where and how it leaves:

- From a gun under each wing, about two thirds of the way out. Work the point out from the craft's axes, the way `wingtip()` in `game.js` does for the trails.
- Velocity is the nose direction times the speed, **plus the craft's own velocity**. Without that, rounds fall behind a craft with its thrusters open. `update` in `game.js` has the craft's `vx`, `vy` and `climbRate`. Pass them in.
- Add the toe-in along the craft's right axis: `-side × gunOffset × speed ÷ meetingDistance`.

Each frame a live round moves, then is tested against enemies (see "Hit tests"), then against the ground: `z <= groundAt(world, x, y)`. A round that meets the ground leaves one puff. It is white spray where `world.materials` there is under `WATER_BELOW`, and dust otherwise.

### Tracers

A round is drawn as a streak from where it was 0.04 seconds ago to where it is. At 18 a second and this speed the streaks nearly join, which is what makes it a stream.

```js
function streak(to, cam, x, y, z, vx, vy, vz, tone, hot) {
  if (!project(cam, x - vx * 0.04, y - vy * 0.04, z - vz * 0.04)) return
  const ax = cam.sx
  const ay = cam.sy
  if (!project(cam, x, y, z)) return
  const near = cam.depth - 1
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(cam.sx - ax), Math.abs(cam.sy - ay))))
  if (steps > 200) return // right beside the eye
  for (let i = 0; i <= steps; i++) {
    const px = Math.round(ax + ((cam.sx - ax) * i) / steps)
    const py = Math.round(ay + ((cam.sy - ay) * i) / steps)
    if (px < 0 || py < 0 || px >= to.width || py >= to.height) continue
    const at = py * to.width + px
    if (to.depth[at] >= near) to.color[at] = i === steps ? hot : tone
  }
}
```

- The player's are yellow with a white-hot head. The enemy's are red with a pale head, and two pixels wide so they are never missed.
- In the last 0.2 seconds, thin the streak with `BAYER4` so it fades out.
- Draw a second pixel beside the line when `cam.scale` is large.

### Spent cases

Every round throws out a brass case. It costs almost nothing and does three jobs: it shows the gun is a machine, it shows how fast the craft is going as the cases fall behind, and it fills the picture near the craft while the tracers fill it far away.

- A pool of 48, seven numbers each, followed for 1.5 seconds.
- Starts at the gun with most of the craft's velocity (about 0.86 of it), thrown outward 20 to 50 px/s, some flicked up and some down.
- Gravity about 120 px/s². Air slows the sideways speed (`*= Math.exp(-dt * 0.9)`).
- Drawn as a box about 2 × 1 pixels that is wide, then tall, then wide, about 20 times a second, in three brass tones so it glints. One dark row underneath makes it show against sky and cloud.
- In its last quarter second it blinks. On the sea it leaves a tiny splash.

### Muzzle flash

One number per gun. Set it to 1 when that gun fires and let it fall by 14 a second. While it is above 0.3, draw a small ragged disc at the muzzle, white above 0.7 and yellow below. The two guns flash in turn. Skip it in the cockpit view, where the guns are behind the eye.

### Ammunition

300 rounds, then five seconds to reload: about 17 seconds of fire. Six missiles, reloaded the same way. An empty trigger gives a click. This makes the player fire in bursts and choose when to spend a missile. Make it a setting, so a game can switch it off.

## Lock-on

The sights choose the enemy nearest to dead ahead, and lock when it has been held there.

1. For each flying enemy within about 950 px, take the cosine of the angle between the nose and the line to it. Count the height difference at 0.6 of its size. From overhead the player cannot judge height, so the lock should not demand it.
2. The candidate is the best one inside a cone of 0.4 radians. If the candidate changes, the timer starts again. Otherwise it runs.
3. At 0.8 seconds it is locked.
4. A locked enemy stays locked until it is more than 0.9 radians off the nose or beyond 1.25 × the range. Without this wider cone the lock drops at every wobble.

Expose `lock` from 0 to 1 for the sights and the sound. Clear it when the target is shot down.

## The missile

A launch has stages. The pause at the start is what makes it feel heavy.

| Stage | Lasts | What happens |
| --- | --- | --- |
| Drop | A third of a second | It leaves the rail with the craft's velocity and nothing more, and falls away below the wing. A clunk |
| Light | One frame | A flare more than twice the size of the flame, four puffs of white smoke, the launch sound |
| Ramp | Half a second | Thrust eases up to about 400 px/s². It can steer only as hard as its thrust has built |
| Burn | About 2 s in all | It gathers speed up to about cruise + 400, dropping a puff of white smoke about 60 times a second |
| Coast | Until it ends | A little drag. No smoke |

- **Steering.** It aims at where the target will be: the target's position plus its velocity times `min(1.2, distance ÷ speed)`. Turn the direction toward that by at most about 3.5 radians a second, then make it one unit long again. With no lock it flies straight.
- **Hit.** Within about 9 px plus one frame of its own travel, so a fast missile cannot skip over the target. A missile kills outright.
- **End.** It explodes on the ground, after about 5 seconds with a target, or about 3.5 without. It never just vanishes.
- **Pace.** 0.4 seconds between launches, from the left and right rails in turn.
- **Drawn** as a short pale line with a dark line under it, so it shows over cloud, and a flickering two-tone disc at the tail.

The smoke trail is what the player follows with the eye, and it is why the smoke pool is the biggest (see `feedback.md`).

An enemy that is locked or has a missile after it jinks (see `enemies.md`). That is what gives the half second before the launch its tension.

## Hit tests

Use a box in world pixels: `|dx| < r`, `|dy| < r`, `|dz| < 0.8 × r`.

- For an enemy, `r` is about 11: two thirds of its half span.
- For the player, about 9. Smaller on purpose. Near misses should miss.
- A round moves about 10 px a frame at 60 frames a second, so a box 22 across cannot be skipped. At the 0.05 second cap in `update` it moves 30. If the game must hold at 20 frames a second, test the middle of the step too.
- One enemy round cannot hurt the player within 0.14 seconds of the last, so a burst is felt as several hits and not one.
- A rolling player is not hit by rounds at all.

## Controls

His page maps: hold the right mouse button for the cannon, M for a missile, the click and hold of the left button unchanged (roll and thrusters). A game controller and on-screen buttons call the same functions.

Kit: add `setFire(held)` and `missile()` to the game and map them in `main.js`. The starter already stops the right-click menu. For touch, add GUN and MISSILE as page buttons, as VIEW is. Keep click for roll and hold for thrusters: `needs.md` in the entry skill lists what the checks expect.

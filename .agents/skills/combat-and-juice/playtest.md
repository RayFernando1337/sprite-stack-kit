# Testing fun without a person

A person feels in ten seconds what is wrong with a fight. An agent has to measure it. Three tools do most of the work: pilots written as code, a few numbers, and rules in `states.js`. The method is this kit's own. The tutorial at the end is Dash's design.

## What the game must expose

The same few names serve the sound, the tutorial, the pilots and the rules. Expose them the way `craft` and `camera` are exposed.

- `game.setFire(held)`, `game.missile()`, and `game.roll()` as it is.
- `game.did`: counts that only go up. `rounds`, `hits`, `kills`, `launches`, `struck` (hits on the player), `lost` (craft lost), `evades`, `counters`.
- `game.hull`, `game.lock` (0 to 1), `game.threat` (seconds until a missile arrives, 99 for none), `game.slow` (0 to 1), `game.counterOpen`, `game.shake`, `game.flash`.
- `game.enemies`: the array made at the start, each with `x`, `y`, `z` and `flying`.
- `game.combat` and `game.fx`, so a rule can count live rounds, sparks and puffs in the pools.

Do not add anything that only a test calls.

## Scripted pilots

Put this beside the game's `states.js` and run it with `bun examples/<name>/playtest.js`. It is not one of the kit's commands. Report its output next to theirs.

```js
import { createGame } from './src/game.js'

const FPS = 60
const wrap = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2))

const pilots = {
  // hands off: the craft wanders by itself
  idle() {},
  // holds the trigger and never steers: aiming must matter
  trigger(game) {
    game.setFire(true)
  },
  // flies at the nearest enemy, fires when lined up, uses the lock, rolls when a missile is close
  careful(game) {
    const me = game.craft
    let foe = null
    let near = 1e9
    for (const e of game.enemies) {
      const d = Math.hypot(e.x - me.x, e.y - me.y)
      if (e.flying && d < near) {
        near = d
        foe = e
      }
    }
    const off = foe ? wrap(Math.atan2(foe.x - me.x, -(foe.y - me.y)) - me.yaw) : 0
    game.setKeys(Math.max(-1, Math.min(1, off * 3)), foe ? Math.sign(foe.z - me.z) * 0.5 : 0, near > 300)
    game.setFire(!!foe && near < 350 && Math.abs(off) < 0.12)
    if (game.lock >= 1 || game.counterOpen) game.missile()
    if (game.threat < 0.3) game.roll()
  },
}

function fly(name, seed, seconds) {
  const game = createGame({ seed })
  game.resize(384, 240)
  let lostAt = -1
  let hurtAt = -1
  let early = 0
  for (let f = 0; f < seconds * FPS; f++) {
    pilots[name](game)
    game.update(1 / FPS)
    if (f % 10 === 0) game.render() // drawing must never change the game, so skipping frames is safe
    if (f === 5 * FPS) early = game.did.rounds
    if (hurtAt < 0 && game.did.struck > 0) hurtAt = f / FPS
    if (lostAt < 0 && game.did.lost > 0) lostAt = f / FPS
  }
  let sum = 2166136261
  const frame = game.render()
  for (let i = 0; i < frame.width * frame.height; i++) sum = Math.imul(sum ^ frame.color[i], 16777619)
  return { ...game.did, early, hurtAt, lostAt, picture: sum >>> 0 }
}

let failed = 0
const expect = (what, ok, detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}  (${detail})`)
}

for (const seed of [7, 8, 9, 10, 11]) {
  const idle = fly('idle', seed, 90)
  const hose = fly('trigger', seed, 60)
  const ace = fly('careful', seed, 60)
  expect(`seed ${seed}: holding the trigger fires 15 to 20 rounds a second`, hose.early / 5 >= 15 && hose.early / 5 <= 20, `${(hose.early / 5).toFixed(1)} a second over the first five`)
  expect(`seed ${seed}: a careful pilot shoots down at least 4 in a minute`, ace.kills >= 4, `${ace.kills} kills`)
  expect(`seed ${seed}: a careful pilot is hit, and keeps the craft`, ace.struck > 0 && ace.lost === 0, `${ace.struck} hits taken, lost ${ace.lost}`)
  expect(`seed ${seed}: an idle pilot is first hit between 6 and 30 seconds in`, idle.hurtAt >= 6 && idle.hurtAt <= 30, `${idle.hurtAt.toFixed(1)} s`)
  expect(`seed ${seed}: an idle pilot loses the craft inside 90 seconds`, idle.lost > 0, `lost at ${idle.lostAt.toFixed(1)} s`)
  expect(`seed ${seed}: firing without aiming gets under a third of a careful pilot's kills`, hose.kills * 3 < ace.kills, `${hose.kills} against ${ace.kills}`)
  expect(`seed ${seed}: the same flight twice ends on the same picture`, fly('careful', seed, 60).picture === ace.picture, `${ace.picture.toString(16)}`)
}
process.exit(failed ? 1 : 0)
```

Read a failure as a note about the game, not about the test:

| The pilot | Means | Change |
| --- | --- | --- |
| Careful pilot gets few kills | The gun is too weak, or enemies are too hard to line up | Rate and speed of rounds, the hit box, how hard enemies turn |
| Careful pilot is never hit | Enemies do not threaten | Burst length, how well they lead, how often they attack |
| Careful pilot loses the craft | Threats cannot be answered, or come too often | The dodge window, the gaps between attacks, the hull |
| Idle pilot survives | Nothing forces the player to act | Enemy missiles, the first attack's delay |
| Trigger pilot does well | Aiming does not matter | The hit box, the scatter, where enemies start |

Fix the game. Do not teach the pilot a trick to get a pass, and do not widen a range without saying so. If the game's brief wants something else (a calm game, a hard one), change the numbers in the open and say why.

More things to measure in the same file:

- **Time to kill.** Note `time` when `hits` first rises on an enemy and when `kills` rises. Half a second to four seconds for the careful pilot. Under that, enemies are paper. Over it, the gun is a pea-shooter.
- **Warning time.** From `threat` first dropping below 99 to the hit or the dodge: at least 1.5 seconds.
- **The dodge window.** Call `roll()` at each frame offset before a missile arrives. The dodge should work for about 0.35 to 0.55 seconds, and not for a roll begun a second early.
- **The picture.** Fly two games on one seed for two seconds, one holding the trigger. Count the pixels that differ at 384 × 240. Under about 150 means the tracers cannot be seen.
- **Speed.** Time 600 frames of `update` and `render` with the trigger held and three enemies alive. Compare with the same game before the feature.
- **Allocation.** Search the files the frame loop runs for `push(`, `splice(`, `filter(`, `map(`, `find(`, `new `, template strings, and `[` or `{` literals inside `update`, `render` and whatever they call.

## Rules for `states.js`

The `verify-states` skill says how the map works. A walk is short, so events put things where they need to be, as that skill describes: start a round right beside its target, or a missile right behind the craft.

Events worth adding:

- `'you hold the trigger'` and `'you let the trigger go'`. Write `notes.firing`.
- `'you press MISSILE'`.
- `'your round reaches an enemy'`, `'their round reaches you'`, `'their missile reaches you'`.

State worth adding, a few values each: `hull` (the number itself), `enemy` (`flying`, `falling`, `gone`), `threat` (`none`, `coming`, `now`), `time` (`normal`, `slow`), `trigger` (`held`, `up`), `counter` (`open`, `shut`). Leave any of these out and the walk will treat two different games as one.

Rules that catch real breaks:

| Kind | Rule |
| --- | --- |
| Never | The hull is never below 0 or above full |
| Never | A count in `did` never goes down |
| Never | More than two enemies attack at once |
| Never | Time is slow without a dodge just before it |
| Never | A number in a pool is anything but a real number |
| Always, in a state | With the trigger held and rounds left, `rounds` rose during the wait |
| Always, in a state | On the frame a round reaches you: `struck` rose, `shake` is above 0, and sparks are alive in the pool |
| Always, in a state | On the frame an enemy is shot down: `kills` rose, a blast is burning, `shake` and `flash` are above 0 |
| Always, in a state | A missile that reaches a rolling craft is dodged, and one that reaches a level craft is not |
| Left alone, it ends | Slow motion ends. Shake and flash die away. The counter-attack shuts |
| Left alone, it ends | A lost craft is replaced and the player is flying again. Give this its own, longer wait |
| The picture | Every pixel is drawn, with blasts, smoke and slow motion on the screen |

Break each feature once on purpose and see its rule fail, as `verify-states` asks. The "always" rows are the ones that keep feedback from quietly going missing later.

A walk does not tell you whether the fight is fun. The pilots tell you part of it. Looking at frames tells you more: take snapshots with rounds in the air, a blast at each age, and slow motion, in all three views. Say in the report that nobody played it, if nobody did.

## The tutorial

His game teaches each move once, in a safe setting, and that is part of why the fight is fun and not confusing.

- **Steps, in groups.** Fly: turn, climb, dive, thrusters, change view. Tricks: roll, loops. Fight: lock on, cannon, missile, dodge, counter-attack. Then bail out.
- **A drill for each step.** The tutorial asks the game for a setting. *Calm*: no enemies. *Target*: one drone that comes in ahead and off to one side, flies steadily, never fires, and comes round in front again if the player loses it. *Attack*: one enemy behind that fires missiles with dummy warheads, more often than in a real fight. A hit jolts and bangs and costs nothing.
- **Done is decided by the counts.** The tutorial notes `did` when a step starts and watches for the change: a radian or so of turning, a second and a half of thrusters, two dozen rounds, one kill, one dodge, one counter. Steps that take time show a bar filling.
- **Hints follow the moment.** "Missile inbound. Roll as the rings meet." "It got you. Here comes another." "Now! Fire!" "Lock on first."
- **The words fit the hands.** Each step is worded for mouse and keys, for touch, and for a game controller.
- **A chime** for each step done, a longer one at the end. Any step can be skipped. When it ends, the real enemies come back.

Kit: the card and its words are page elements, in a `tutorial.js` beside `main.js` that reads `game.did` each frame. The game needs one new function, `drill(mode)`, and the tutorial is its real caller. Write your own wording.

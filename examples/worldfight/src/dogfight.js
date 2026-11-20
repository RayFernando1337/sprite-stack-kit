// The dogfight over the city: the enemy pilots, the cannon, missiles both ways, hull
// strength, the score, the waves, and who won. Nothing here draws.
//
// An enemy is flown by a few numbers the computer writes for it each frame (which way to
// turn, how fast to go, whether to fire), and the same flight code as the player's moves it.
// A pilot steered by a person on another computer would only need those written from elsewhere.

import { groundAt, WORLD_SIZE, WATER_BELOW, WORLD_MASK, WORLD_SHIFT } from './world.js'
import { hash2 } from './rng.js'

export const FIGHT = {
  waves: [2, 3, 4], // how many enemies come in each wave
  waveGap: 2.6, // seconds of quiet between two waves
  enemyHull: 8,
  hull: 8, // hits the player's plane can take

  // the cannon
  gunRate: 14, // rounds a second while the trigger is held
  gunSpeed: 430, // world px per second, on top of the plane's own speed
  gunLife: 0.62, // seconds
  gunHelp: 0.07, // radians: how far a round is steered towards an enemy that is in the sights
  hitRadius: 11, // world px, across the ground
  hitHeight: 13, // … and up and down

  // the player's missiles
  lockRange: 430,
  lockCone: 0.9, // the cosine of how far off the nose an enemy can be locked on to
  lockSeconds: 0.7,
  rails: 2,
  railReload: 5, // seconds to put one missile back
  missileDrop: 0.22, // seconds it falls from the rail before its motor lights
  missileSpeed: 370,
  missileTurn: 3.4, // radians per second
  missileLife: 3.2,
  missileDamage: 8, // the whole of an enemy's hull: a missile that arrives is the end of it

  // the enemies
  enemySpeed: 0.92, // × the player's cruising speed
  enemyTurn: 1.3, // radians per second: a little less nimble than the player
  enemyShotSpeed: 300,
  enemyShotLife: 1.1,
  enemyReach: 330, // an attacker fires its guns from this close …
  enemyAim: 0.16, // … with its nose within this many radians of where the player will be
  burst: 4, // rounds in a burst
  burstGap: 0.11,
  burstRest: 1.1, // seconds between bursts
  playerRadius: 8,
  playerHeight: 9,

  // their missiles
  inboundTurn: 2.4,
  inboundEdge: 120, // px per second faster than the player it ends up
  inboundDamage: 3,
  parry: 0.6, // a roll throws a missile off while it is no further through than this share
  slowSeconds: 0.9, // how long time slows after one is thrown off
  counterOpen: 0.7, // seconds after that in which the missile button answers with a volley
  volley: 3,
  volleyGap: 0.12,

  hitPoints: 5,
  downPoints: 100,
  evadePoints: 50,
  wavePoints: 150,
  winPoints: 300,
  hullPoints: 25, // for each hit the plane could still take at the end
}

const SHOTS = 96
const SHOT_F = 8 // x, y, z, speed east, south and up, seconds left, whose (0 the player's, 1 theirs)
const MISSILES = 6
const INBOUND = 3
const MOST = Math.max(...FIGHT.waves)
const TOTAL = FIGHT.waves.reduce((sum, n) => sum + n, 0)
const MARGIN = 120 // enemies keep this far inside the edge of the city

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const wrap = (angle) => angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2))
const ease = (dt, rate) => 1 - Math.exp(-dt * rate)

/**
 * `fx` makes smoke, debris and blasts (effects.js). `heard` counts what happened, for the
 * page to play as sound. `feel` is how the game shakes, flashes and slows: this file asks
 * for those by writing to it.
 */
export function createDogfight(tune, fx, heard, feel) {
  const pilots = []
  for (let n = 0; n < MOST; n++) {
    pilots.push({
      x: 0, y: 0, z: 0, yaw: 0, yawRate: 0, roll: 0, pitch: 0, vx: 0, vy: 0, vz: 0, speed: 0,
      hull: 0,
      state: 0, // 0 not there, 1 flying, 2 shot down and falling
      flash: 0, // seconds left of the flash of a hit
      breakFor: 0, // seconds left of the hard turn it makes when it is hit
      attacking: false, // it is after the player
      turnIn: 0, // seconds until it thinks again about attacking
      burst: 0, due: 0, rest: 0, // rounds left in this burst, seconds to the next round, and to the next burst
      missileIn: 0, // seconds until it may fire a missile
      wobble: 0, cruise: 0, smoke: 0, breakTo: 1, hunted: false,
    })
  }
  const shots = new Float32Array(SHOTS * SHOT_F)
  const missiles = []
  for (let n = 0; n < MISSILES; n++) missiles.push({ on: false, sure: false, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0, speed: 0, age: 0, target: -1, puff: 0 })
  const inbound = []
  for (let n = 0; n < INBOUND; n++) inbound.push({ on: false, lost: false, lostFor: 0, x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 0, speed: 0, age: 0, from: -1, puff: 0 })

  let shotHead = 0
  let gunDue = 0
  let gunSide = 1
  let railSide = 1
  let railIn = 0
  let volley = 0 // missiles of a counter-attack still to leave
  let volleyDue = 0
  let volleyAt = -1
  let counterFoe = -1
  let autoIn = 0
  let clock = 0
  let land = null // the map the fight is over
  let quiet = 0 // seconds the enemies hold their fire: at the start of a fight

  const fight = {
    pilots, shots, missiles, inbound,
    shotCount: SHOTS,
    shotSize: SHOT_F,
    hull: FIGHT.hull,
    hullMax: FIGHT.hull,
    score: 0,
    best: 0,
    round: 0, // how many fights have started
    outcome: 'playing', // 'playing', 'won' or 'lost'
    overFor: 0, // seconds since it was won or lost
    wave: 0,
    waveSize: 0,
    waveDue: 0, // seconds until the next wave arrives, or 0
    enemiesLeft: 0, // still to shoot down, in this wave and the ones to come
    flying: 0,
    downed: 0,
    rounds: 0, // cannon rounds the player has fired
    rails: FIGHT.rails,
    railsMax: FIGHT.rails,
    evades: 0,
    lockOn: -1, // the enemy in the sights, or −1
    lockFor: 0,
    locked: false,
    threatIn: 99, // seconds until the nearest enemy missile arrives, or 99
    threatFrom: 0, // … and where it is, in radians clockwise from the nose
    counterFor: 0, // seconds left to answer a missile that was thrown off
    hurt: 9, // seconds since the player was last hit
    muzzle: 0, // 1 the moment a round leaves, fading
    muzzleSide: 1,
    assist: false, // missiles leave by themselves once locked: for play with one button

    /** Starts a fight: full hull, no score, and the first wave in front of the player. */
    begin(craft, world) {
      land = world
      fight.round++
      fight.hull = FIGHT.hull
      fight.score = 0
      fight.outcome = 'playing'
      fight.overFor = 0
      fight.hurt = 9
      fight.wave = 0
      fight.waveDue = 0
      fight.enemiesLeft = TOTAL
      fight.downed = 0
      fight.rails = FIGHT.rails
      fight.evades = 0
      fight.counterFor = 0
      railIn = 0
      volley = 0
      quiet = 4
      clear()
      spawnWave(craft)
    },

    /** Ends the fight and clears the sky: the player has left the city. */
    end() {
      clear()
      fight.enemiesLeft = 0
      fight.waveDue = 0
      fight.waveSize = 0
      fight.outcome = 'playing'
    },

    /** Starts a round. `whose` is 0 for the player's and 1 for an enemy's. */
    shoot(x, y, z, east, south, up, whose) {
      const o = shotHead * SHOT_F
      shotHead = (shotHead + 1) % SHOTS
      shots[o] = x
      shots[o + 1] = y
      shots[o + 2] = z
      shots[o + 3] = east
      shots[o + 4] = south
      shots[o + 5] = up
      shots[o + 6] = whose === 0 ? FIGHT.gunLife : FIGHT.enemyShotLife
      shots[o + 7] = whose
    },

    /**
     * The missile button. Says whether anything left. In the moment after an enemy missile
     * was thrown off it is a counter-attack: three, one after another, at whoever fired it.
     */
    launch(craft) {
      if (fight.outcome !== 'playing') return false
      if (fight.counterFor > 0 && volley === 0) {
        let at = counterFoe >= 0 && pilots[counterFoe].state === 1 ? counterFoe : fight.locked ? fight.lockOn : -1
        if (at < 0) {
          let near = 1e9
          for (let n = 0; n < pilots.length; n++) {
            if (pilots[n].state !== 1) continue
            const far = Math.hypot(pilots[n].x - craft.x, pilots[n].y - craft.y)
            if (far < near) {
              near = far
              at = n
            }
          }
        }
        if (at >= 0) {
          fight.counterFor = 0
          volley = FIGHT.volley
          volleyDue = 0
          volleyAt = at
          return true
        }
      }
      if (fight.rails <= 0) {
        heard.empty++
        return false
      }
      if (fight.rails === FIGHT.rails) railIn = FIGHT.railReload
      fight.rails--
      railSide = -railSide
      release(craft, fight.locked ? fight.lockOn : -1, railSide, false)
      return true
    },

    /** Enemy `n` fires a missile at the player. Says whether it left. */
    enemyLaunch(n, craft) {
      const pilot = pilots[n]
      const missile = inbound.find((each) => !each.on)
      if (!missile || pilot.state !== 1) return false
      const gx = craft.x - pilot.x
      const gy = craft.y - pilot.y
      const gz = craft.z - pilot.z
      const far = Math.hypot(gx, gy, gz) || 1
      missile.on = true
      missile.lost = false
      missile.lostFor = 0
      missile.x = pilot.x
      missile.y = pilot.y
      missile.z = pilot.z - 2
      missile.fx = gx / far
      missile.fy = gy / far
      missile.fz = gz / far
      missile.speed = pilot.speed + 40
      missile.age = 0
      missile.from = n
      missile.puff = 0
      heard.inbound++
      return true
    },

    /**
     * One step of the fight. `dt` is game time, which slows after a dodge; `real` is the
     * clock's. `firing` is the player's trigger.
     */
    update(dt, real, world, craft, firing) {
      land = world
      clock += dt
      fight.hurt += dt
      if (quiet > 0) quiet -= dt
      if (fight.muzzle > 0) fight.muzzle = Math.max(0, fight.muzzle - dt * 14)
      if (fight.outcome !== 'playing') fight.overFor += real
      const playing = fight.outcome === 'playing'

      if (playing && fight.waveDue > 0) {
        fight.waveDue -= dt
        if (fight.waveDue <= 0) {
          fight.waveDue = 0
          fight.wave++
          spawnWave(craft)
        }
      }
      if (fight.rails < FIGHT.rails) {
        railIn -= dt
        if (railIn <= 0) {
          fight.rails++
          railIn = FIGHT.railReload
          heard.reload++
        }
      }

      stepLock(dt, craft, playing)
      // the cannon: rounds at a steady rate for as long as the trigger is held
      if (playing && firing) {
        gunDue -= dt
        while (gunDue <= 0) {
          gunDue += 1 / FIGHT.gunRate
          fireRound(craft)
        }
      } else gunDue = 0
      // a counter-attack leaves by the clock, not by the slowed time, or it would crawl out
      if (fight.counterFor > 0) fight.counterFor -= real
      if (volley > 0) {
        volleyDue -= real
        if (volleyDue <= 0) {
          release(craft, volleyAt, [-1, 1, 0][(FIGHT.volley - volley) % 3], true)
          volley--
          volleyDue = FIGHT.volleyGap
        }
      }
      stepPilots(dt, world, craft, playing)
      stepShots(dt, world, craft, playing)
      stepMissiles(dt, world, craft)
      stepInbound(dt, world, craft)
      if (fight.score > fight.best) fight.best = fight.score
    },
  }

  function clear() {
    for (const pilot of pilots) {
      pilot.hull = 0
      pilot.state = 0
      pilot.flash = 0
    }
    for (const missile of missiles) missile.on = false
    for (const missile of inbound) missile.on = false
    shots.fill(0)
    fight.flying = 0
    fight.lockOn = -1
    fight.lockFor = 0
    fight.locked = false
    fight.threatIn = 99
    fight.muzzle = 0
  }

  /**
   * Brings in the wave `fight.wave`: ahead of the player and off to the sides, crossing in
   * front. A player who is out by the edge of the city is met from the middle, so the fight
   * drifts in over the town and not out over the sea.
   */
  function spawnWave(craft) {
    const count = FIGHT.waves[fight.wave]
    fight.waveSize = count
    const inward = Math.atan2(WORLD_SIZE / 2 - craft.x, -(WORLD_SIZE / 2 - craft.y))
    const out = Math.hypot(WORLD_SIZE / 2 - craft.x, WORLD_SIZE / 2 - craft.y)
    const from = out > 230 ? inward : craft.yaw + fight.wave * 2.2
    for (let n = 0; n < count; n++) {
      const pilot = pilots[n]
      const way = from + (n - (count - 1) / 2) * 0.75
      const far = 330 + (n & 1) * 70
      pilot.x = clamp(craft.x + Math.sin(way) * far, MARGIN, WORLD_SIZE - MARGIN)
      pilot.y = clamp(craft.y - Math.cos(way) * far, MARGIN, WORLD_SIZE - MARGIN)
      if (Math.hypot(pilot.x - craft.x, pilot.y - craft.y) < 170) {
        // the player is in a corner of the city: come from the middle instead
        pilot.x = WORLD_SIZE / 2 + Math.cos(n * 2.4) * 130
        pilot.y = WORLD_SIZE / 2 + Math.sin(n * 2.4) * 130
      }
      pilot.cruise = tune.altitude + (n - 1) * 9
      pilot.z = Math.max(groundAt(land, pilot.x, pilot.y) + tune.clearance + 4, pilot.cruise)
      pilot.yaw = Math.atan2(craft.x - pilot.x, -(craft.y - pilot.y)) + (n & 1 ? 0.7 : -0.7)
      pilot.yawRate = 0
      pilot.roll = 0
      pilot.pitch = 0
      pilot.speed = tune.speed * FIGHT.enemySpeed
      pilot.vx = Math.sin(pilot.yaw) * pilot.speed
      pilot.vy = -Math.cos(pilot.yaw) * pilot.speed
      pilot.vz = 0
      pilot.hull = FIGHT.enemyHull
      pilot.state = 1
      pilot.flash = 0
      pilot.breakFor = 0
      pilot.attacking = false
      pilot.turnIn = 1 + n * 2.5
      pilot.burst = 0
      pilot.rest = 1
      pilot.missileIn = (fight.wave === 0 ? 7 : 3) + n * 2.5
      pilot.wobble = n * 2.4 + 0.7 + fight.wave
      pilot.smoke = 0
      pilot.hunted = false
    }
    fight.flying = count
    heard.wave++
    feel.note(3, fight.wave + 1)
  }
  /** Which enemy is in the sights, and for how long it has been. */
  function stepLock(dt, craft, playing) {
    const east = Math.sin(craft.yaw)
    const south = -Math.cos(craft.yaw)
    let best = -1
    let bestAim = FIGHT.lockCone
    if (playing) {
      for (let n = 0; n < pilots.length; n++) {
        const pilot = pilots[n]
        if (pilot.state !== 1) continue
        const dx = pilot.x - craft.x
        const dy = pilot.y - craft.y
        const dz = (pilot.z - craft.z) * 0.6 // height counts for less: from above there is no judging it
        const far = Math.hypot(dx, dy, dz)
        if (far > FIGHT.lockRange || far < 1) continue
        // the one it already has is kept a little longer, so the lock does not flicker between two
        const aim = (dx * east + dy * south) / far + (n === fight.lockOn ? 0.05 : 0)
        if (aim > bestAim) {
          bestAim = aim
          best = n
        }
      }
    }
    if (best !== fight.lockOn) {
      fight.lockOn = best
      fight.lockFor = 0
    } else if (best >= 0) {
      const before = fight.lockFor
      fight.lockFor += dt
      if (before < FIGHT.lockSeconds && fight.lockFor >= FIGHT.lockSeconds) heard.lock++
    }
    fight.locked = fight.lockOn >= 0 && fight.lockFor >= FIGHT.lockSeconds
    if (fight.assist && playing && ((fight.locked && fight.rails > 0) || fight.counterFor > 0)) {
      autoIn += dt
      if (autoIn > 0.3) {
        autoIn = 0
        fight.launch(craft)
      }
    } else autoIn = 0
  }

  /** One round leaves a gun: the two fire in turn. */
  function fireRound(craft) {
    const side = gunSide
    gunSide = -gunSide
    let east = Math.sin(craft.yaw)
    let south = -Math.cos(craft.yaw)
    const x = craft.x + east * 10 - south * side * 4
    const y = craft.y + south * 10 + east * side * 4
    const z = craft.z - 1
    let up = craft.vz
    const target = fight.lockOn >= 0 ? pilots[fight.lockOn] : null
    if (target) {
      // The guns are raised or lowered on to whoever is in the sights, and turned a hair
      // towards where they will be. From above, height cannot be judged by eye.
      const ex = target.x - x
      const ey = target.y - y
      const time = Math.max(0.05, Math.hypot(ex, ey) / FIGHT.gunSpeed)
      const off = wrap(Math.atan2(ex + (target.vx - craft.vx) * time, -(ey + (target.vy - craft.vy) * time)) - craft.yaw)
      if (Math.abs(off) < 0.3) {
        const way = craft.yaw + clamp(off, -FIGHT.gunHelp, FIGHT.gunHelp)
        east = Math.sin(way)
        south = -Math.cos(way)
      }
      up = clamp((target.z + target.vz * time - z) / time, -FIGHT.gunSpeed * 0.4, FIGHT.gunSpeed * 0.4)
    }
    const stray = (hash2(fight.rounds, 77) - 127.5) * 0.06
    fight.shoot(x, y, z, east * FIGHT.gunSpeed + craft.vx - south * stray, south * FIGHT.gunSpeed + craft.vy + east * stray, up, 0)
    fight.rounds++
    fight.muzzle = 1
    fight.muzzleSide = side
    heard.shot++
  }

  /** A missile leaves the player's plane. One of a counter-attack lights at once and fans out. */
  function release(craft, target, side, sure) {
    let missile = missiles[0]
    for (const each of missiles) {
      if (!each.on) {
        missile = each
        break
      }
      if (each.age > missile.age) missile = each
    }
    const east = Math.sin(craft.yaw)
    const south = -Math.cos(craft.yaw)
    missile.on = true
    missile.sure = sure
    missile.x = craft.x - south * side * 12
    missile.y = craft.y + east * side * 12
    missile.z = craft.z - 1
    missile.fx = east
    missile.fy = south
    missile.fz = 0
    if (sure) {
      missile.fx -= south * side * 0.6
      missile.fy += east * side * 0.6
      missile.fz = side === 0 ? 0.75 : 0.4
      const size = Math.hypot(missile.fx, missile.fy, missile.fz)
      missile.fx /= size
      missile.fy /= size
      missile.fz /= size
    }
    missile.speed = Math.hypot(craft.vx, craft.vy) // it leaves with the plane's own speed: it is only let go
    missile.age = 0
    missile.target = target
    missile.puff = 0
    heard.launch++
  }

  /** Turns a missile towards the point (gx, gy, gz) away from it, by at most `rate` radians a second. */
  function steer(missile, gx, gy, gz, rate, dt) {
    const far = Math.hypot(gx, gy, gz) || 1
    const off = Math.acos(clamp((missile.fx * gx + missile.fy * gy + missile.fz * gz) / far, -1, 1))
    const share = off < 1e-4 ? 1 : Math.min(1, (rate * dt) / off)
    missile.fx += (gx / far - missile.fx) * share
    missile.fy += (gy / far - missile.fy) * share
    missile.fz += (gz / far - missile.fz) * share
    const size = Math.hypot(missile.fx, missile.fy, missile.fz) || 1
    missile.fx /= size
    missile.fy /= size
    missile.fz /= size
  }

  const wetAt = (world, x, y) => world.materials[(((y | 0) & WORLD_MASK) << WORLD_SHIFT) | ((x | 0) & WORLD_MASK)] < WATER_BELOW

  function stepPilots(dt, world, craft, playing) {
    const base = tune.speed * FIGHT.enemySpeed
    const mine = Math.hypot(craft.vx, craft.vy)
    const armed = playing && quiet <= 0
    const mostAttackers = fight.wave + 1
    const mostInbound = Math.min(INBOUND, fight.wave + 1)
    let attackers = 0
    let incoming = 0
    for (const pilot of pilots) if (pilot.state === 1 && pilot.attacking) attackers++
    for (const missile of inbound) if (missile.on && !missile.lost) incoming++
    let flying = 0
    for (let n = 0; n < pilots.length; n++) {
      const pilot = pilots[n]
      if (pilot.flash > 0) pilot.flash -= dt
      if (pilot.state === 2) {
        fall(pilot, dt, world)
        continue
      }
      if (pilot.state !== 1) continue
      flying++
      const dx = craft.x - pilot.x
      const dy = craft.y - pilot.y
      const far = Math.hypot(dx, dy) || 1
      const chance = hash2(n * 31 + 7, (clock * 10) | 0) / 255

      // Enemies take it in turns to come after the player: one at a time in the first wave,
      // two in the second, three in the third. One that is on its way does not give up before it gets there.
      if (!pilot.attacking || far < 460) pilot.turnIn -= dt
      if (!armed) {
        if (pilot.attacking) attackers--
        pilot.attacking = false
      } else if (pilot.turnIn <= 0) {
        if (pilot.attacking) {
          pilot.attacking = false
          attackers--
          pilot.turnIn = 2 + chance * 2
        } else if (attackers < mostAttackers) {
          pilot.attacking = true
          attackers++
          pilot.turnIn = 10 + chance * 5
        } else pilot.turnIn = 1
      }

      const toPlayer = wrap(Math.atan2(dx, -dy) - pilot.yaw)
      let want = 0.5 * Math.sin(clock * 0.23 + pilot.wobble) + 0.3 * Math.sin(clock * 0.61 + pilot.wobble * 2.1)
      let speed = base
      let aimed = false
      // where the player will be by the time a round fired now gets there
      const time = far / FIGHT.enemyShotSpeed
      const ax = dx + craft.vx * time
      const ay = dy + craft.vy * time
      const az = craft.z + craft.vz * time - pilot.z
      if (pilot.attacking) {
        const toAim = wrap(Math.atan2(ax, -ay) - pilot.yaw)
        // too close to turn inside the player: break away, and come round again
        want = far < 70 ? (toPlayer > 0 ? -1 : 1) : clamp(toAim * 1.8, -1, 1)
        // it hurries to catch up, then settles in behind at a little over the player's speed
        speed = far > 420 ? Math.max(base * 1.5, mine * 1.7) : far > 160 ? Math.max(base, mine * 1.1) : mine * 0.9
        aimed = far < FIGHT.enemyReach && far > 90 && Math.abs(toAim) < FIGHT.enemyAim && Math.abs(az) < 20 + far * 0.3
      } else if (far > 520) want = clamp(toPlayer * 1.3, -1, 1)
      else if (far < 80) want = toPlayer > 0 ? -0.9 : 0.9
      // the city has edges, and beyond them is somewhere else
      const cx = WORLD_SIZE / 2 - pilot.x
      const cy = WORLD_SIZE / 2 - pilot.y
      if (Math.max(Math.abs(cx), Math.abs(cy)) > WORLD_SIZE / 2 - MARGIN) want = clamp(wrap(Math.atan2(cx, -cy) - pilot.yaw) * 2, -1, 1)
      // locked on to, or with a missile after it, it jinks
      if ((fight.lockOn === n && fight.lockFor > 0.25) || pilot.hunted) {
        want = Math.sin(clock * 3.1 + pilot.wobble) > 0 ? 1 : -1
        speed *= 1.15
      }
      if (pilot.breakFor > 0) {
        // hit: it breaks hard one way, and is not so easily hit again
        pilot.breakFor -= dt
        want = pilot.breakTo
        speed *= 1.2
      }
      pilot.hunted = false

      // the same flight as the player's plane, with its own numbers
      pilot.yawRate += (want * FIGHT.enemyTurn - pilot.yawRate) * ease(dt, 2.8)
      pilot.yaw += pilot.yawRate * dt
      pilot.roll += (clamp(pilot.yawRate / FIGHT.enemyTurn, -1, 1) * tune.bank - pilot.roll) * ease(dt, 5)
      pilot.speed += (speed - pilot.speed) * ease(dt, 1.5)
      const east = Math.sin(pilot.yaw)
      const south = -Math.cos(pilot.yaw)
      pilot.vx = east * pilot.speed
      pilot.vy = south * pilot.speed
      pilot.x = clamp(pilot.x + pilot.vx * dt, 8, WORLD_SIZE - 8)
      pilot.y = clamp(pilot.y + pilot.vy * dt, 8, WORLD_SIZE - 8)
      // it flies at the player's height when it is after them, and always clear of the ground ahead
      const floor = Math.max(groundAt(world, pilot.x, pilot.y), groundAt(world, pilot.x + east * 30, pilot.y + south * 30)) + tune.clearance
      const before = pilot.z
      pilot.z += clamp((Math.max(floor + 4, pilot.attacking ? craft.z : pilot.cruise) - pilot.z) * ease(dt, 2), -40 * dt, 40 * dt)
      if (pilot.z < floor) pilot.z = floor
      pilot.vz = (pilot.z - before) / dt
      pilot.pitch += (clamp(pilot.vz / Math.max(20, pilot.speed), -0.5, 0.5) - pilot.pitch) * ease(dt, 4)

      // guns in bursts, at where the player will be: a turn or a roll throws the aim off
      pilot.rest -= dt
      pilot.missileIn -= dt
      if (!armed) pilot.burst = 0
      else {
        if (aimed && pilot.rest <= 0 && pilot.burst === 0) {
          pilot.burst = FIGHT.burst
          pilot.due = 0
        }
        if (pilot.burst > 0) {
          pilot.due -= dt
          if (pilot.due <= 0) {
            const reach = Math.hypot(ax, ay, az) || 1
            const stray = (hash2(n + pilot.burst * 5, (clock * 30) | 0) - 127.5) * 0.05
            fight.shoot(
              pilot.x + east * 10, pilot.y + south * 10, pilot.z,
              (ax / reach) * FIGHT.enemyShotSpeed - south * stray, (ay / reach) * FIGHT.enemyShotSpeed + east * stray, (az / reach) * FIGHT.enemyShotSpeed, 1,
            )
            heard.foeShot++
            pilot.due = FIGHT.burstGap
            // the first wave is slower on the trigger than the ones after it
            if (--pilot.burst === 0) pilot.rest = FIGHT.burstRest * (fight.wave === 0 ? 2 : 1) + chance * 0.8
          }
        }
        if (pilot.attacking && pilot.missileIn <= 0 && far > 170 && far < 480 && Math.abs(toPlayer) < 0.5 && incoming < mostInbound) {
          if (fight.enemyLaunch(n, craft)) incoming++
          pilot.missileIn = 5 + chance * 4
        }
      }

      // one that has taken half its hits trails smoke, and nearly done for, black smoke
      if (pilot.hull <= FIGHT.enemyHull / 2) {
        pilot.smoke -= dt
        if (pilot.smoke <= 0) {
          pilot.smoke = 0.07
          fx.smoke(pilot.x - east * 8, pilot.y - south * 8, pilot.z, 0, 0, 5, 1.7, 0.9, pilot.hull <= 2 ? 2 : 0)
        }
      }
    }
    fight.flying = flying
  }

  /** Shot down: nose down, turning over and over, pouring smoke, until it meets the ground. */
  function fall(pilot, dt, world) {
    pilot.vz -= 80 * dt
    pilot.vx *= Math.exp(-dt * 0.35)
    pilot.vy *= Math.exp(-dt * 0.35)
    pilot.x = clamp(pilot.x + pilot.vx * dt, 4, WORLD_SIZE - 4)
    pilot.y = clamp(pilot.y + pilot.vy * dt, 4, WORLD_SIZE - 4)
    pilot.z += pilot.vz * dt
    pilot.pitch += (-1 - pilot.pitch) * ease(dt, 1.5)
    pilot.roll += 3.6 * dt
    pilot.smoke -= dt
    if (pilot.smoke <= 0) {
      pilot.smoke = 0.035
      fx.smoke(pilot.x, pilot.y, pilot.z, 0, 0, 7, 2.3, 1.3, 2)
      fx.smoke(pilot.x, pilot.y, pilot.z, pilot.vx * 0.3, pilot.vy * 0.3, 2, 1.4, 0.35, 3)
    }
    const floor = groundAt(world, pilot.x, pilot.y)
    if (pilot.z <= floor + 1.5) {
      fx.blast(pilot.x, pilot.y, floor + 1, 1.5, wetAt(world, pilot.x, pilot.y))
      pilot.state = 0
    }
  }

  /** An enemy is hit: by a cannon round (1), or by a missile, which is the end of it. */
  function hitFoe(n, damage) {
    const pilot = pilots[n]
    if (pilot.state !== 1) return
    pilot.hull = Math.max(0, pilot.hull - damage)
    pilot.flash = 0.12
    if (pilot.breakFor <= 0) {
      pilot.breakFor = 0.8
      pilot.breakTo = hash2(n, (clock * 10) | 0) & 1 ? 1 : -1
    }
    fight.score += FIGHT.hitPoints
    heard.hit++
    fx.debris(pilot.x, pilot.y, pilot.z, pilot.vx * 0.5, pilot.vy * 0.5, 3, 20)
    fx.sparks(pilot.x, pilot.y, pilot.z)
    if (pilot.hull > 0) return
    pilot.state = 2
    pilot.vz = 16
    pilot.attacking = false
    fight.enemiesLeft--
    fight.downed++
    fight.score += FIGHT.downPoints
    heard.down++
    fx.blast(pilot.x, pilot.y, pilot.z, 1.2, false)
    fx.debris(pilot.x, pilot.y, pilot.z, pilot.vx * 0.4, pilot.vy * 0.4, 7, 40)
    feel.note(6, 0)
    if (fight.lockOn === n) {
      fight.lockOn = -1
      fight.lockFor = 0
      fight.locked = false
    }
    for (const missile of missiles) if (missile.target === n) missile.target = -1
    let flying = 0
    for (const each of pilots) if (each.state === 1) flying++
    if (fight.enemiesLeft === 0) {
      fight.outcome = 'won'
      fight.overFor = 0
      fight.score += FIGHT.winPoints + fight.hull * FIGHT.hullPoints
      feel.slow = Math.max(feel.slow, 0.8)
      heard.win++
    } else if (flying === 0) {
      fight.waveDue = FIGHT.waveGap
      fight.score += FIGHT.wavePoints
      feel.slow = Math.max(feel.slow, 0.5)
      feel.note(4, 0)
      heard.clear++
    }
  }

  /** The player is hit. Enough of it and the plane is lost. */
  function hitPlayer(damage, craft) {
    if (fight.outcome !== 'playing') return
    if (damage === 1 && fight.hurt < 0.14) return // two rounds of one burst do not both land
    fight.hull = Math.max(0, fight.hull - damage)
    fight.hurt = 0
    feel.shake = Math.max(feel.shake, damage > 1 ? 1 : 0.5)
    feel.flash = Math.max(feel.flash, damage > 1 ? 0.5 : 0.22)
    heard.hurt++
    fx.debris(craft.x, craft.y, craft.z, craft.vx * 0.6, craft.vy * 0.6, 4, 24)
    if (fight.hull > 0) return
    fight.outcome = 'lost'
    fight.overFor = 0
    fight.lockOn = -1
    fight.locked = false
    feel.slow = Math.max(feel.slow, 0.9)
    heard.lose++
  }

  /** Does a round that flew from (px, py, pz) to where it is now pass through `thing`? */
  function passes(o, px, py, pz, thing, radius, height) {
    const dx = shots[o] - px
    const dy = shots[o + 1] - py
    const size = dx * dx + dy * dy
    // the point of this frame's flight that came nearest: a fast round is not let jump over
    const share = size > 0 ? clamp(((thing.x - px) * dx + (thing.y - py) * dy) / size, 0, 1) : 0
    const nx = px + dx * share - thing.x
    const ny = py + dy * share - thing.y
    return nx * nx + ny * ny < radius * radius && Math.abs(pz + (shots[o + 2] - pz) * share - thing.z) < height
  }

  function stepShots(dt, world, craft, playing) {
    for (let n = 0; n < SHOTS; n++) {
      const o = n * SHOT_F
      if (shots[o + 6] <= 0) continue
      shots[o + 6] -= dt
      const px = shots[o]
      const py = shots[o + 1]
      const pz = shots[o + 2]
      shots[o] += shots[o + 3] * dt
      shots[o + 1] += shots[o + 4] * dt
      shots[o + 2] += shots[o + 5] * dt
      if (shots[o + 7] === 1) {
        // an enemy's: the player's plane in its way is hit, unless it is rolling, which throws them off
        if (playing && craft.spin < 0 && passes(o, px, py, pz, craft, FIGHT.playerRadius, FIGHT.playerHeight)) {
          shots[o + 6] = 0
          hitPlayer(1, craft)
          continue
        }
      } else {
        let struck = false
        for (let i = 0; i < pilots.length && !struck; i++) {
          if (pilots[i].state !== 1 || !passes(o, px, py, pz, pilots[i], FIGHT.hitRadius, FIGHT.hitHeight)) continue
          hitFoe(i, 1)
          struck = true
        }
        if (struck) {
          shots[o + 6] = 0
          continue
        }
      }
      const floor = groundAt(world, shots[o], shots[o + 1])
      if (shots[o + 2] <= floor) {
        // it strikes: a spurt of water, or of dust
        fx.smoke(shots[o], shots[o + 1], floor + 1, 0, 0, 8, 1.3, 0.4, wetAt(world, shots[o], shots[o + 1]) ? 1 : 4)
        shots[o + 6] = 0
      }
    }
  }

  function stepMissiles(dt, world, craft) {
    for (const missile of missiles) {
      if (!missile.on) continue
      missile.age += dt
      if (missile.age < (missile.sure ? 0.04 : FIGHT.missileDrop)) missile.z -= 24 * dt // let go: it falls away from the wing
      else {
        // its motor is lit: it gathers speed, and turns after its target for as long as it has one
        missile.speed = Math.min(FIGHT.missileSpeed * (missile.sure ? 1.25 : 1), missile.speed + 560 * dt)
        const target = missile.target >= 0 && pilots[missile.target].state === 1 ? pilots[missile.target] : null
        if (target) {
          target.hunted = true
          const far = Math.hypot(target.x - missile.x, target.y - missile.y, target.z - missile.z)
          if (far < 10 + missile.speed * dt) {
            missile.on = false
            fx.blast(target.x, target.y, target.z, 0.8, false)
            hitFoe(missile.target, FIGHT.missileDamage)
            continue
          }
          const time = (far / missile.speed) * 0.7
          steer(missile, target.x + target.vx * time - missile.x, target.y + target.vy * time - missile.y, target.z + target.vz * time - missile.z, missile.sure ? 7 : FIGHT.missileTurn, dt)
        }
        missile.puff -= dt
        if (missile.puff <= 0) {
          missile.puff = 0.02
          fx.smoke(missile.x - missile.fx * 3, missile.y - missile.fy * 3, missile.z - missile.fz * 3, 0, 0, 1, 1.2, 0.7, 1)
        }
      }
      missile.x += missile.fx * missile.speed * dt
      missile.y += missile.fy * missile.speed * dt
      missile.z += missile.fz * missile.speed * dt
      const floor = groundAt(world, missile.x, missile.y)
      if (missile.z <= floor + 1 || missile.age > FIGHT.missileLife) {
        missile.on = false
        fx.blast(missile.x, missile.y, Math.max(missile.z, floor + 1), 0.7, missile.z <= floor + 1 && wetAt(world, missile.x, missile.y))
      }
    }
  }

  /** The enemy's missiles: after the player, until one is thrown off or arrives. */
  function stepInbound(dt, world, craft) {
    fight.threatIn = 99
    const mine = Math.hypot(craft.vx, craft.vy)
    for (const missile of inbound) {
      if (!missile.on) continue
      missile.age += dt
      // always gaining on the player, thrusters or no, but not so fast that it cannot be seen coming
      missile.speed = Math.min(Math.max(tune.speed * 1.2, mine) + FIGHT.inboundEdge, missile.speed + 220 * dt)
      const gx = craft.x - missile.x
      const gy = craft.y - missile.y
      const gz = craft.z - missile.z
      const far = Math.hypot(gx, gy, gz) || 1
      if (!missile.lost && fight.outcome !== 'playing') missile.lost = true
      if (!missile.lost) {
        steer(missile, gx, gy, gz, FIGHT.inboundTurn, dt)
        const closing = Math.max(50, missile.speed - (craft.vx * gx + craft.vy * gy + craft.vz * gz) / far)
        if (far / closing < fight.threatIn) {
          fight.threatIn = far / closing
          fight.threatFrom = wrap(Math.atan2(-gx, gy) - craft.yaw)
        }
        if (far < 8 + closing * dt) {
          if (craft.spin >= 0 && craft.spin <= FIGHT.parry) {
            // A roll just begun throws it off: it goes by alongside, blind, and blows up behind.
            // For a moment time all but stops to watch it go, and the missile button is a counter-attack.
            missile.lost = true
            missile.lostFor = 0
            const flat = Math.hypot(missile.fx, missile.fy) || 1
            const px = -missile.fy / flat
            const py = missile.fx / flat
            const side = (missile.x - craft.x) * px + (missile.y - craft.y) * py >= 0 ? 1 : -1
            missile.x = craft.x - missile.fx * 14 + px * side * 10
            missile.y = craft.y - missile.fy * 14 + py * side * 10
            missile.z = craft.z + 2
            missile.fz *= 0.3
            fight.evades++
            fight.score += FIGHT.evadePoints
            fight.counterFor = FIGHT.slowSeconds + FIGHT.counterOpen
            counterFoe = missile.from
            feel.slow = Math.max(feel.slow, FIGHT.slowSeconds)
            feel.note(5, 0)
            heard.evade++
          } else {
            missile.on = false
            fx.blast(craft.x, craft.y, craft.z, 1, false)
            hitPlayer(FIGHT.inboundDamage, craft)
            continue
          }
        }
      } else {
        missile.lostFor += dt
        if (missile.lostFor > 0.6) {
          missile.on = false
          fx.blast(missile.x, missile.y, missile.z, 0.8, false)
          continue
        }
      }
      missile.puff -= dt
      if (missile.puff <= 0) {
        missile.puff = 0.025
        fx.smoke(missile.x - missile.fx * 3, missile.y - missile.fy * 3, missile.z - missile.fz * 3, 0, 0, 1, 1.2, 0.6, 0)
      }
      missile.x += missile.fx * missile.speed * dt
      missile.y += missile.fy * missile.speed * dt
      missile.z += missile.fz * missile.speed * dt
      const floor = groundAt(world, missile.x, missile.y)
      if (missile.z <= floor + 1 || missile.age > 8) {
        missile.on = false
        fx.blast(missile.x, missile.y, Math.max(missile.z, floor + 1), 0.8, missile.z <= floor + 1 && wetAt(world, missile.x, missile.y))
      }
    }
  }

  return fight
}

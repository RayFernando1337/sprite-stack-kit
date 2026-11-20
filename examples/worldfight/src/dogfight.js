// The dogfight over the city: computer pilots, shots, hull strength, the score, and who won.
//
// A pilot is steered by two numbers, `turn` (−1..1) and `fire` (true or false), and this
// file moves it. The computer writes those numbers for the enemies in think(). A pilot
// steered by a person on another computer would only need them written from elsewhere.

import { groundAt, WORLD_SIZE } from './world.js'

export const FIGHT = {
  enemies: 4,
  enemyHull: 3,
  hull: 5, // hits the player's ship can take
  enemySpeed: 0.8, // × the player's speed
  enemyTurn: 1.0, // radians per second: a little less nimble than the player
  sight: 420, // an enemy chases the player from this far away, in world px
  range: 190, // … and shoots from this far
  aim: 0.16, // … when its nose is within this many radians of the player
  reload: 1.3, // seconds between an enemy's shots
  playerReload: 0.16,
  shotSpeed: 300, // world px per second, the player's
  enemyShotSpeed: 170, // slower, so a turn gets out of the way
  shotLife: 0.85, // seconds
  hitRadius: 10, // world px, across the ground
  hitHeight: 14, // … and up and down
  boomSeconds: 0.6,
  hitPoints: 1,
  downPoints: 5,
}

const SHOTS = 48
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const wrap = (angle) => angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2))
const ease = (dt, rate) => 1 - Math.exp(-dt * rate)

export function createDogfight(tune) {
  const pilots = []
  for (let n = 0; n < FIGHT.enemies; n++) {
    pilots.push({ x: 0, y: 0, z: 0, yaw: 0, yawRate: 0, roll: 0, hull: 0, turn: 0, fire: false, reload: 0, boom: 0, homeX: 0, homeY: 0 })
  }
  // every shot: x, y, z, speed east, speed south, seconds left; and whose it is (0 the player's, 1 theirs)
  const shots = new Float32Array(SHOTS * 6)
  const owner = new Uint8Array(SHOTS)

  const fight = {
    pilots,
    shots,
    owner,
    shotCount: SHOTS,
    hull: FIGHT.hull,
    score: 0,
    round: 0, // how many fights have started
    outcome: 'playing', // 'playing', 'won' or 'lost'
    reload: 0,
    hurt: 0, // seconds since the player was last hit, for a flash
    enemiesLeft: 0,

    /** Starts a fight: full hull, and the enemies spread round the middle of the city. */
    begin() {
      fight.round++
      fight.hull = FIGHT.hull
      fight.outcome = 'playing'
      fight.hurt = 9
      shots.fill(0)
      for (let n = 0; n < pilots.length; n++) {
        const pilot = pilots[n]
        const way = (n / pilots.length) * Math.PI * 2 + 0.6
        pilot.homeX = WORLD_SIZE * 0.52 + Math.cos(way) * 170
        pilot.homeY = WORLD_SIZE * 0.5 + Math.sin(way) * 150
        pilot.x = pilot.homeX
        pilot.y = pilot.homeY
        pilot.z = tune.altitude
        pilot.yaw = way + Math.PI / 2
        pilot.yawRate = 0
        pilot.roll = 0
        pilot.hull = FIGHT.enemyHull
        pilot.reload = 1 + n * 0.4
        pilot.boom = 0
        pilot.turn = 0
        pilot.fire = false
      }
      fight.enemiesLeft = pilots.length
    },

    /** Ends the fight and clears the sky: the player has left the city. */
    end() {
      for (const pilot of pilots) {
        pilot.hull = 0
        pilot.boom = 0
      }
      shots.fill(0)
      fight.enemiesLeft = 0
      fight.outcome = 'playing'
    },

    /** Starts a shot. `whose` is 0 for the player's and 1 for an enemy's. */
    shoot(x, y, z, east, south, whose) {
      for (let n = 0; n < SHOTS; n++) {
        const o = n * 6
        if (shots[o + 5] > 0) continue
        const speed = whose === 0 ? FIGHT.shotSpeed : FIGHT.enemyShotSpeed
        shots[o] = x
        shots[o + 1] = y
        shots[o + 2] = z
        shots[o + 3] = east * speed
        shots[o + 4] = south * speed
        shots[o + 5] = FIGHT.shotLife
        owner[n] = whose
        return
      }
    },

    /** The player pulls the trigger. Says whether a shot left. */
    fire(craft) {
      if (fight.outcome !== 'playing' || fight.reload > 0) return false
      fight.reload = FIGHT.playerReload
      const east = Math.sin(craft.yaw)
      const south = -Math.cos(craft.yaw)
      fight.shoot(craft.x + east * 16, craft.y + south * 16, craft.z, east, south, 0)
      return true
    },

    update(dt, world, craft, speed) {
      fight.reload -= dt
      fight.hurt += dt
      const playing = fight.outcome === 'playing'

      for (let n = 0; n < pilots.length; n++) {
        const pilot = pilots[n]
        if (pilot.boom > 0) pilot.boom -= dt
        if (pilot.hull <= 0) continue
        think(pilot, n, craft, playing)
        // the same flight as the player's ship, with its own numbers
        pilot.yawRate += (pilot.turn * FIGHT.enemyTurn - pilot.yawRate) * ease(dt, 2.8)
        pilot.yaw += pilot.yawRate * dt
        pilot.roll += (clamp(pilot.yawRate / FIGHT.enemyTurn, -1, 1) * tune.bank - pilot.roll) * ease(dt, 5)
        const east = Math.sin(pilot.yaw)
        const south = -Math.cos(pilot.yaw)
        pilot.x = clamp(pilot.x + east * speed * FIGHT.enemySpeed * dt, 8, WORLD_SIZE - 8)
        pilot.y = clamp(pilot.y + south * speed * FIGHT.enemySpeed * dt, 8, WORLD_SIZE - 8)
        // it flies at the player's height when chasing, and always clear of the ground ahead
        const ground = Math.max(groundAt(world, pilot.x, pilot.y), groundAt(world, pilot.x + east * 30, pilot.y + south * 30))
        const want = Math.max(ground + tune.clearance + 4, playing ? craft.z : tune.altitude)
        pilot.z += clamp((want - pilot.z) * ease(dt, 2), -40 * dt, 40 * dt)
        if (pilot.z < ground + tune.clearance) pilot.z = ground + tune.clearance
        pilot.reload -= dt
        if (pilot.fire && pilot.reload <= 0) {
          pilot.reload = FIGHT.reload
          fight.shoot(pilot.x + east * 16, pilot.y + south * 16, pilot.z, east, south, 1)
        }
      }

      for (let n = 0; n < SHOTS; n++) {
        const o = n * 6
        if (shots[o + 5] <= 0) continue
        shots[o + 5] -= dt
        shots[o] += shots[o + 3] * dt
        shots[o + 1] += shots[o + 4] * dt
        if (shots[o + 2] <= groundAt(world, shots[o], shots[o + 1])) shots[o + 5] = 0 // into a hill or a building
        if (shots[o + 5] <= 0 || fight.outcome !== 'playing') continue
        if (owner[n] === 1) {
          if (near(shots, o, craft)) {
            shots[o + 5] = 0
            fight.hull = Math.max(0, fight.hull - 1)
            fight.hurt = 0
            if (fight.hull === 0) fight.outcome = 'lost'
          }
          continue
        }
        for (const pilot of pilots) {
          if (pilot.hull <= 0 || !near(shots, o, pilot)) continue
          shots[o + 5] = 0
          pilot.hull--
          fight.score += FIGHT.hitPoints
          if (pilot.hull === 0) {
            pilot.boom = FIGHT.boomSeconds
            fight.score += FIGHT.downPoints
            fight.enemiesLeft--
            if (fight.enemiesLeft === 0) fight.outcome = 'won'
          }
          break
        }
      }
    },
  }

  /** The computer's hands on one enemy's controls. */
  function think(pilot, n, craft, playing) {
    const dx = craft.x - pilot.x
    const dy = craft.y - pilot.y
    const far = Math.hypot(dx, dy)
    let toX = pilot.homeX
    let toY = pilot.homeY
    pilot.fire = false
    if (playing && far < FIGHT.sight) {
      toX = craft.x
      toY = craft.y
    }
    const off = wrap(Math.atan2(toX - pilot.x, -(toY - pilot.y)) - pilot.yaw)
    if (playing && far < FIGHT.sight) {
      // too close to turn inside the player: break away to one side, then come round again
      pilot.turn = far < 34 ? (n & 1 ? 1 : -1) : clamp(off * 2.2, -1, 1)
      pilot.fire = far < FIGHT.range && Math.abs(off) < FIGHT.aim
    } else {
      // circle its own patch of sky
      const out = Math.hypot(toX - pilot.x, toY - pilot.y)
      pilot.turn = out > 90 ? clamp(off * 2, -1, 1) : 0.35
    }
  }

  return fight
}

function near(shots, o, thing) {
  const dx = shots[o] - thing.x
  const dy = shots[o + 1] - thing.y
  return dx * dx + dy * dy < FIGHT.hitRadius * FIGHT.hitRadius && Math.abs(shots[o + 2] - thing.z) < FIGHT.hitHeight
}

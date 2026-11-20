// The game: how the ship flies, which level it is on, where the camera sits, and the order
// things are drawn in. It knows nothing about the page. main.js feeds it input and shows its
// picture, and scripts/snapshot.mjs runs it with no browser at all.

import { createFramebuffer, BAYER4 } from './framebuffer.js'
import { createCamera, project, aimCamera, eyeDistance } from './camera.js'
import { buildWorld, groundAt, LEVELS, WORLD_SIZE, CLOUD_BASE, TOP_Z } from './world.js'
import { acrossX, acrossY } from './atlas.js'
import { drawWorld, drawSky } from './terrain.js'
import { buildCraft } from './model.js'
import { drawStack, stackAxes } from './stack.js'
import { drawHud } from './hud.js'
import { createDogfight, FIGHT } from './dogfight.js'
import { rgb } from './framebuffer.js'

const SHOT_OURS = rgb(255, 246, 170)
const SHOT_THEIRS = rgb(255, 92, 110)

export const TUNING = {
  speed: 84, // world px per second, in the city
  levelSpeed: [0.55, 0.75, 1], // × speed on each level: the higher up, the more ground a pixel is
  boost: 1.7, // × speed while the thrusters are open
  turnRate: 1.4, // radians per second at full deflection
  bank: 0.8, // radians of bank at full turn rate
  altitude: 58, // cruising height
  ceiling: 230,
  clearance: 9, // the closest the ship comes to the ground
  viewSeconds: 1.2, // a view change is nearly done after this long, then settles gently
  cameraFollow: 0.5, // overhead: how much of the ship's turn the camera makes with it
  chaseDistance: 130, // world px from the eye to the ship
  chaseAngle: 15, // degrees the chase eye looks down
  chaseWidth: 0.15, // how wide the ship is in the chase view, as a share of the frame
  holdSeconds: 0.22, // a shorter press is a click; a longer one opens the thrusters
  rollSeconds: 0.75,
  trailSeconds: 2,
  shiftSeconds: 1.7, // how long a change of level takes
  shiftZoom: 2.8, // how far the camera closes in on the way through
}

/** The views, in the order the VIEW button steps through them. */
export const VIEWS = ['top', 'chase']

const TRAIL_POINTS = 120
const TRAIL_GAP = 3 // world px between trail points
// The ship dissolves as the eye comes up to it.
const FADE_NEAR = 30 // gone when the eye is this close, in world px …
const FADE_FAR = 70 // … and solid from here out
const FADE_SHARE = 0.54 // … or from this share of the chase distance
const EDGE = 24 // this close to the edge of a country or a city, the ship leaves it
const ARRIVE = 150 // coming down, the ship arrives at least this far inside the new map

// "Move this share of the way to the goal." Smooths anything, at any frame rate.
const ease = (dt, rate) => 1 - Math.exp(-dt * rate)
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const wrap = (angle) => angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2))
const inOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t))

// A spring from where a number is to where it is going, so a change starts gently, ends
// gently, and can be turned round half-way.
function glide(part, goal, pull, dt) {
  part.speed += (pull * pull * (goal - part.at) - 2 * pull * part.speed) * dt
  part.at = clamp(part.at + part.speed * dt, 0, 1)
  if (Math.abs(part.at - goal) < 0.0005 && Math.abs(part.speed) < 0.005) {
    part.at = goal
    part.speed = 0
  }
}

export function createGame(options = {}) {
  // Tools that start many games on one seed pass the first game's world to the rest.
  const levels = options.world?.levels ?? buildWorld(options.seed ?? 7).levels
  let level = clamp(options.level | 0, 0, levels.length - 1)
  let world = levels[level]
  const model = buildCraft()
  const tune = { ...TUNING, ...options.tuning, craftWidth: model.width }
  const fadeFar = Math.min(FADE_FAR, tune.chaseDistance * FADE_SHARE)
  const fadeNear = fadeFar * (FADE_NEAR / FADE_FAR)
  const rival = buildCraft({ rival: true })
  const fight = createDogfight(tune)
  const foe = { x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, scale: 1, spread: 1, thrust: 0.6, solid: 1 }
  const fb = createFramebuffer()
  const cam = createCamera()
  const axes = {}

  // The marked place on each level where the ship can go down: the middle of the next map.
  const doors = []
  for (let n = 0; n + 1 < levels.length; n++) {
    const here = levels[n].map
    const below = levels[n + 1].map
    doors.push({
      x: acrossX(below, here, WORLD_SIZE / 2),
      y: acrossY(below, here, WORLD_SIZE / 2),
      // near enough to go down: over the place itself, with some room round a small one
      reach: Math.max(60, ((below.span / here.span) * WORLD_SIZE) / 2 + 30),
      label: LEVELS[n + 1].label,
    })
  }

  const craft = {
    x: world.spawnX,
    y: world.spawnY,
    z: tune.altitude,
    yaw: 0.9, // never wrapped, so anything that follows it turns the short way
    yawRate: 0,
    roll: 0, // the bank it holds in a turn
    pitch: 0,
    spin: -1, // a barrel roll in progress, 0..1, or −1
    spinDir: 1,
  }
  const input = { x: 0, y: 0, pointing: false, idle: 99, held: false, heldFor: 0, turn: 0, climb: 0, boost: false, byKeys: false }
  const focus = { x: craft.x, y: craft.y, alt: craft.z } // what the camera looks at
  const pose = { x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, scale: 1, spread: 1, thrust: 0, solid: 1 }
  const caster = {
    x: 0, y: 0, z: 0, cos: 1, sin: 0, across: 1, along: 1,
    footprint: model.footprint, width: model.width, length: model.length, pivotK: model.pivotK,
  }
  const hud = { level: 0, name: '', door: null, doorX: 0, doorY: 0, over: false, time: 0, fight }
  const trails = [new Float32Array(TRAIL_POINTS * 4), new Float32Array(TRAIL_POINTS * 4)]
  const tip = { x: 0, y: 0, z: 0 }
  let trailHead = 0
  let trailCount = 0
  let trailX = craft.x
  let trailY = craft.y

  let time = 0
  let boost = 0 // 0..1: how far the thrusters are open
  let speed = tune.speed
  let altGoal = tune.altitude
  let floor = 0 // the lowest the ship may fly right now
  let climbRate = 0
  let handsOn = false // somebody is steering
  // The view is one number: how much of the chase pose the camera has. 0 is the overhead view.
  let goal = Math.max(0, VIEWS.indexOf(options.view))
  const inChase = { at: goal === 1 ? 1 : 0, speed: 0 }
  let overheadHeading = craft.yaw * tune.cameraFollow
  let chaseHeading = craft.yaw
  let headingGap = wrap(chaseHeading - overheadHeading)
  let heading = overheadHeading
  let eyeLift = 0 // how far the eye is raised or lowered to stay clear of hills and clouds
  let tilt = 1
  // A change of level: which way (1 is down, −1 is up), how far through it is, and whether
  // the map has been swapped yet. The swap happens half-way, while the picture is covered.
  let shiftWay = 0
  let shiftAt = 0
  let swapped = false
  let cover = 0 // 0..1: how much of the picture the haze between levels hides

  const spinAngle = () => (craft.spin < 0 ? 0 : craft.spinDir * Math.PI * 2 * inOut(craft.spin))

  /** How far the ship is from this level's marked place, the short way round on the Earth. */
  function doorGap(axis) {
    const door = doors[level]
    let gap = axis === 0 ? door.x - craft.x : door.y - craft.y
    if (level === 0 && axis === 0) gap -= WORLD_SIZE * Math.round(gap / WORLD_SIZE)
    return gap
  }
  const overDoor = () => level < doors.length && Math.max(Math.abs(doorGap(0)), Math.abs(doorGap(1))) < doors[level].reach

  /** The tallest ground the ship will pass over in the next moment, across its width. */
  function groundAhead() {
    const fx = Math.sin(craft.yaw)
    const fy = -Math.cos(craft.yaw)
    let top = 0
    for (let along = 0; along <= speed * 0.7; along += 12) {
      for (let across = -8; across <= 8; across += 8) {
        const h = groundAt(world, craft.x + fx * along - fy * across, craft.y + fy * along + fx * across)
        if (h > top) top = h
      }
    }
    return top
  }

  function wingtip(side) {
    const at = model.wingtips[side]
    const s = pose.scale
    tip.x = craft.x + (at.a * axes.rx + at.b * axes.fx + at.z * axes.ux) * s
    tip.y = craft.y + (at.a * axes.ry + at.b * axes.fy + at.z * axes.uy) * s
    tip.z = craft.z + (at.a * axes.rz + at.b * axes.fz + at.z * axes.uz) * s
  }

  /** Moves the ship to the same spot on the Earth, on another level's map. */
  function swap(to) {
    const from = world
    const down = to > level
    if (LEVELS[level].city) fight.end()
    level = to
    world = levels[to]
    if (LEVELS[level].city) fight.begin()
    let x = acrossX(from.map, world.map, craft.x)
    let y = acrossY(from.map, world.map, craft.y)
    if (level === 0) x = ((x % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE
    else {
      const room = down ? ARRIVE : EDGE * 2
      x = clamp(x, room, WORLD_SIZE - room)
      y = clamp(y, room, WORLD_SIZE - room)
    }
    focus.x += x - craft.x
    focus.y += y - craft.y
    craft.x = x
    craft.y = y
    if (down) craft.z = Math.max(craft.z, tune.ceiling * 0.6) // arrive high, and sink to cruising height
    altGoal = tune.altitude
    focus.alt = craft.z
    floor = 0
    trailCount = 0
    trailX = x
    trailY = y
  }

  /** Works out what the camera looks at, which way, and how steeply. */
  function frameCamera(dt, vx, vy) {
    const chase = inChase.at
    const top = 1 - chase // how much of the overhead pose is left

    // The camera looks at a point that trails the ship, and that sits a little ahead of it
    // when seen from above.
    // … but never so far ahead that a small picture loses the ship off its edge
    const lead = Math.min(20 + 14 * boost, Math.min(fb.width, fb.height) * 0.2) * top
    const goalX = craft.x + Math.sin(craft.yaw) * lead
    const goalY = craft.y - Math.cos(craft.yaw) * lead
    const catchUp = ease(dt, 3.5)
    focus.x += vx * dt + (goalX - (focus.x + vx * dt)) * catchUp
    focus.y += vy * dt + (goalY - (focus.y + vy * dt)) * catchUp
    focus.alt += (craft.z - focus.alt) * ease(dt, 3)
    overheadHeading += (craft.yaw * tune.cameraFollow - overheadHeading) * ease(dt, 1.6)
    chaseHeading += (craft.yaw - chaseHeading) * ease(dt, 3.2)
    // The two headings drift apart by whole turns over time. Only the short way between them
    // matters, and it must not jump while the camera is between views.
    const gap = chaseHeading - overheadHeading
    if (chase === 0) headingGap = wrap(gap)
    else headingGap += wrap(gap - headingGap)
    heading = overheadHeading + headingGap * chase

    // How steeply the eye looks down: 45° overhead, the chase angle from behind.
    const lean = Math.tan(((45 * top + tune.chaseAngle * chase) * Math.PI) / 180)
    const persp = chase / tune.chaseDistance
    let lift = 0
    if (chase > 0.3) {
      // Keep the eye above the ground it is over and out of the cloud layer.
      const back = 1 / persp
      const ground = groundAt(world, focus.x - Math.sin(heading) * back, focus.y + Math.cos(heading) * back) + 6
      const plain = focus.alt + lean * back
      let eye = Math.max(plain, ground)
      if (eye > CLOUD_BASE - 3 && eye < TOP_Z + 3) eye = craft.z < CLOUD_BASE - 6 ? Math.max(ground, CLOUD_BASE - 3) : TOP_Z + 3
      lift = eye - plain
    }
    eyeLift += (lift - eyeLift) * ease(dt, 6)
    tilt = lean + eyeLift * persp
  }

  function settle() {
    pose.x = craft.x
    pose.y = craft.y
    pose.z = craft.z
    pose.yaw = craft.yaw
    pose.roll = craft.roll + spinAngle()
    pose.pitch = craft.pitch
    pose.thrust = 0.35 + 0.65 * boost
    stackAxes(pose.yaw, pose.roll, pose.pitch, axes)
    aimCamera(cam, inChase.at, focus, heading, tilt, fb.width, fb.height, tune)
    // A change of level closes in on the place below, swaps the map, and draws back.
    if (shiftWay !== 0) {
      const u = shiftAt < 0.5 ? shiftAt * 2 : (1 - shiftAt) * 2 // 0 → 1 → 0
      const closing = shiftAt < 0.5 && shiftWay < 0 ? 0 : u * u // going up, the old map does not zoom
      cam.zoom *= 1 + (tune.shiftZoom - 1) * closing
      cover = clamp((u - 0.3) / 0.6, 0, 1)
    } else cover = 0
    // The ship dissolves as the eye comes up to it, and is gone before the eye is inside it.
    const away = project(cam, craft.x, craft.y, craft.z) ? eyeDistance(cam) : 0
    pose.solid = clamp((away - fadeNear) / (fadeFar - fadeNear), 0, 1)
  }

  function update(seconds) {
    const dt = clamp(seconds, 0, 0.05)
    if (dt <= 0) return
    time += dt
    input.idle += dt
    if (input.held) input.heldFor += dt

    // ── a change of level in progress
    if (shiftWay !== 0) {
      shiftAt += dt / tune.shiftSeconds
      if (!swapped && shiftAt >= 0.5) {
        swap(level + shiftWay)
        swapped = true
      }
      if (shiftAt >= 1) shiftWay = 0
    } else if (level > 0 && (craft.x < EDGE || craft.y < EDGE || craft.x > WORLD_SIZE - EDGE || craft.y > WORLD_SIZE - EDGE)) {
      ascend() // flown out of the side of a country or a city
    }

    // thrusters
    const pushing = (input.held && input.heldFor >= tune.holdSeconds) || input.boost
    boost += ((pushing ? 1 : 0) - boost) * ease(dt, pushing ? 5 : 2.5)
    // the ship slows to a crawl while the level changes, so it arrives where it left
    speed = tune.speed * tune.levelSpeed[level] * (1 + (tune.boost - 1) * boost) * (shiftWay !== 0 ? 0.2 : 1)
    const climbMax = tune.speed * 0.5

    // ── what the player is asking for
    const behind = inChase.at > 0.5 // steering from behind the ship
    const pointing = input.pointing && input.idle < 6 && !input.byKeys
    let craftX = cam.cx
    let craftY = cam.cy
    if (project(cam, craft.x, craft.y, craft.z)) {
      craftX = cam.sx
      craftY = cam.sy
    }
    let want = 0
    handsOn = true
    if (input.turn !== 0) {
      want = input.turn * tune.turnRate
    } else if (pointing && behind) {
      // from behind: point left or right of the ship to turn
      const t = clamp((input.x - cam.cx) / (fb.width * 0.28), -1, 1)
      if (Math.abs(t) > 0.06) want = t * tune.turnRate
    } else if (pointing) {
      // from above: the ship turns to face the pointer
      const px = input.x - craftX
      const py = input.y - craftY
      if (px * px + py * py > 14 * 14) {
        const wx = px * cam.cos - py * cam.sin // the same direction on the map
        const wy = px * cam.sin + py * cam.cos
        want = clamp(wrap(Math.atan2(wx, -wy) - craft.yaw) * 2.5, -tune.turnRate, tune.turnRate)
      }
    } else if (!input.byKeys) {
      // nobody at the controls: wander, so the scene is never still
      want = tune.turnRate * (0.55 * Math.sin(time * 0.37) + 0.35 * Math.sin(time * 0.83 + 2))
      handsOn = false
    }
    if (input.climb !== 0) {
      altGoal += input.climb * climbMax * dt
    } else if (pointing && behind) {
      // from behind: point above the ship to climb, below it to dive
      const raw = clamp((craftY - input.y) / (fb.height * 0.4), -1, 1)
      const up = (Math.sign(raw) * Math.max(0, Math.abs(raw) - 0.08)) / 0.92
      altGoal = up >= 0 ? tune.altitude + up * (tune.ceiling - tune.altitude) : tune.altitude + up * (tune.altitude - floor)
    } else if (!handsOn) {
      altGoal += (tune.altitude - altGoal) * ease(dt, 0.8)
    }

    // ── flight
    craft.yawRate += (want - craft.yawRate) * ease(dt, 2.8)
    craft.yaw += craft.yawRate * dt
    const bank = clamp(craft.yawRate / tune.turnRate, -1, 1) * tune.bank
    craft.roll += (bank - craft.roll) * ease(dt, 5)
    const vx = Math.sin(craft.yaw) * speed
    const vy = -Math.cos(craft.yaw) * speed
    craft.x += vx * dt
    craft.y += vy * dt
    if (level === 0) {
      // the Earth goes round: keep the ship's position on the map, and move the camera with it
      const lap = craft.x < 0 ? WORLD_SIZE : craft.x >= WORLD_SIZE ? -WORLD_SIZE : 0
      const turn = craft.y < 0 ? WORLD_SIZE : craft.y >= WORLD_SIZE ? -WORLD_SIZE : 0
      if (lap || turn) {
        craft.x += lap
        craft.y += turn
        focus.x += lap
        focus.y += turn
        trailCount = 0
      }
    }
    if (craft.spin >= 0) {
      craft.spin += dt / tune.rollSeconds
      if (craft.spin >= 1) craft.spin = -1
    }
    // It follows the ground ahead with room to spare, so it can skim a hill but never hit one.
    const floorNow = groundAhead() + tune.clearance
    floor += (floorNow - floor) * ease(dt, floorNow > floor ? 9 : 3)
    altGoal = clamp(altGoal, floor, Math.max(floor, tune.ceiling))
    const before = craft.z
    craft.z += clamp((altGoal - craft.z) * ease(dt, 3), -climbMax * dt, climbMax * dt)
    const hard = groundAt(world, craft.x, craft.y) + tune.clearance * 0.6
    if (craft.z < hard) craft.z += (hard - craft.z) * ease(dt, 20)
    climbRate += ((craft.z - before) / dt - climbRate) * ease(dt, 6)
    craft.pitch += (clamp(climbRate / Math.max(20, tune.speed), -0.5, 0.5) - craft.pitch) * ease(dt, 4)

    if (LEVELS[level].city && shiftWay === 0) fight.update(dt, world, craft, tune.speed)

    // ── the view: the chase pose's share glides to 1 or to 0, and the camera follows
    glide(inChase, goal === 1 ? 1 : 0, 4.6 / tune.viewSeconds, dt)
    frameCamera(dt, vx, vy)
    settle()

    // trails: drop a point every few pixels flown
    const moved = (craft.x - trailX) ** 2 + (craft.y - trailY) ** 2
    if (moved > TRAIL_GAP * TRAIL_GAP) {
      trailX = craft.x
      trailY = craft.y
      for (let side = 0; side < model.wingtips.length && side < 2; side++) {
        wingtip(side)
        const o = trailHead * 4
        trails[side][o] = tip.x
        trails[side][o + 1] = tip.y
        trails[side][o + 2] = tip.z
        trails[side][o + 3] = time
      }
      trailHead = (trailHead + 1) % TRAIL_POINTS
      if (trailCount < TRAIL_POINTS) trailCount++
    }
  }

  function drawTrails(to) {
    const W = to.width
    const H = to.height
    const color = to.color
    const zbuf = to.depth
    const tones = world.palette.trail
    for (let side = 0; side < model.wingtips.length && side < 2; side++) {
      const points = trails[side]
      wingtip(side)
      let joined = project(cam, tip.x, tip.y, tip.z) && eyeDistance(cam) >= fadeNear
      let fromX = cam.sx
      let fromY = cam.sy
      for (let n = 0; n < trailCount; n++) {
        const o = ((trailHead - 1 - n + TRAIL_POINTS) % TRAIL_POINTS) * 4
        const age = (time - points[o + 3]) / tune.trailSeconds
        if (age >= 1) break
        // a point behind the eye, or so close in front of it that it would be drawn huge
        if (!project(cam, points[o], points[o + 1], points[o + 2]) || eyeDistance(cam) < fadeNear) {
          joined = false
          continue
        }
        const toX = cam.sx
        const toY = cam.sy
        const steps = Math.ceil(Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY)))
        if (joined && steps < 400) {
          const tone = tones[age < 0.3 ? 0 : age < 0.65 ? 1 : 2]
          const strength = (1 - age) * 16 // older trail is drawn with fewer pixels: it thins, it does not blend
          const thick = cam.scale > 2.2 ? 2 : 1
          const near = cam.depth - 1
          for (let i = 0; i <= steps; i++) {
            const x0 = Math.round(fromX + ((toX - fromX) * i) / (steps || 1))
            const y0 = Math.round(fromY + ((toY - fromY) * i) / (steps || 1))
            for (let y = y0; y < y0 + thick; y++) {
              for (let x = x0; x < x0 + thick; x++) {
                if (x < 0 || y < 0 || x >= W || y >= H) continue
                const at = y * W + x
                if (zbuf[at] < near) continue // behind a hill or a cloud
                if (strength > BAYER4[((y & 3) << 2) | (x & 3)]) color[at] = tone
              }
            }
          }
        }
        fromX = toX
        fromY = toY
        joined = true
      }
    }
  }

  /** The enemies, their wrecks and every shot in the air. */
  function drawFight(to) {
    for (let n = 0; n < fight.pilots.length; n++) {
      const pilot = fight.pilots[n]
      if (pilot.hull > 0) {
        foe.x = pilot.x
        foe.y = pilot.y
        foe.z = pilot.z
        foe.yaw = pilot.yaw
        foe.roll = pilot.roll
        drawStack(to, cam, rival, foe, time + n)
      } else if (pilot.boom > 0 && project(cam, pilot.x, pilot.y, pilot.z)) {
        // a burst that grows and thins out
        const age = 1 - pilot.boom / FIGHT.boomSeconds
        const radius = (3 + age * 13) * cam.scale
        const ink = (1 - age) * 18
        const cx = Math.round(cam.sx)
        const cy = Math.round(cam.sy)
        for (let y = Math.max(0, Math.ceil(cy - radius)); y <= Math.min(to.height - 1, cy + radius); y++) {
          for (let x = Math.max(0, Math.ceil(cx - radius)); x <= Math.min(to.width - 1, cx + radius); x++) {
            const far = Math.hypot(x - cx, y - cy) / radius
            if (far <= 1 && ink > BAYER4[((y & 3) << 2) | (x & 3)]) to.color[y * to.width + x] = rival.flame[Math.min(4, (far * 3 + age * 2) | 0)]
          }
        }
      }
    }
    for (let n = 0; n < fight.shotCount; n++) {
      const o = n * 6
      if (fight.shots[o + 5] <= 0 || !project(cam, fight.shots[o], fight.shots[o + 1], fight.shots[o + 2])) continue
      const size = cam.scale > 1.6 ? 3 : 2
      const x0 = Math.round(cam.sx) - (size >> 1)
      const y0 = Math.round(cam.sy) - (size >> 1)
      const col = fight.owner[n] === 0 ? SHOT_OURS : SHOT_THEIRS
      for (let y = y0; y < y0 + size; y++) {
        for (let x = x0; x < x0 + size; x++) {
          if (x < 0 || y < 0 || x >= to.width || y >= to.height) continue
          const at = y * to.width + x
          if (to.depth[at] >= cam.depth - 1) to.color[at] = col // not behind a tower
        }
      }
    }
  }
  /** Draws one frame and returns the framebuffer (see framebuffer.js). */
  function render() {
    fb.clear()
    caster.x = craft.x
    caster.y = craft.y
    caster.z = craft.z
    caster.cos = Math.cos(craft.yaw)
    caster.sin = Math.sin(craft.yaw)
    caster.across = 1 / (Math.max(0.3, Math.abs(Math.cos(pose.roll))) * pose.scale)
    caster.along = 1 / pose.scale
    drawWorld(fb, cam, world, time, caster)
    drawSky(fb, cam, world, fb.height * 0.7)
    drawTrails(fb)
    if (LEVELS[level].city) drawFight(fb)
    drawStack(fb, cam, model, pose, time)

    // The haze between levels: more and more pixels of it, in a dither pattern, then fewer.
    if (cover > 0) {
      const haze = world.palette.haze
      const ink = cover * 17
      const W = fb.width
      for (let y = 0; y < fb.height; y++) {
        for (let x = 0, o = y * W; x < W; x++, o++) {
          if (ink > BAYER4[((y & 3) << 2) | (x & 3)]) fb.color[o] = haze
        }
      }
    }

    hud.level = level
    hud.name = LEVELS[level].name
    hud.door = shiftWay === 0 && level < doors.length ? doors[level] : null
    if (hud.door) {
      hud.doorX = craft.x + doorGap(0)
      hud.doorY = craft.y + doorGap(1)
      hud.over = overDoor()
    }
    hud.time = time
    drawHud(fb, cam, world, hud)
    return fb
  }

  /** Starts the way down to the next level. Only over a marked place; says whether it did. */
  function descend() {
    if (shiftWay !== 0 || !overDoor()) return false
    shiftWay = 1
    shiftAt = 0
    swapped = false
    return true
  }

  /** Starts the way up a level. Says whether it did. */
  function ascend() {
    if (shiftWay !== 0 || level === 0) return false
    shiftWay = -1
    shiftAt = 0
    swapped = false
    return true
  }

  if (LEVELS[level].city) fight.begin()
  frameCamera(0, 0, 0)

  return {
    model,
    craft,
    camera: cam,
    frame: fb,
    doors,
    fight,
    update,
    render,
    descend,
    ascend,
    resize(width, height) {
      fb.resize(width, height)
      settle()
    },
    /** pointer position in game pixels (screen pixels ÷ the pixel size) */
    pointerMove(x, y) {
      input.x = x
      input.y = y
      input.pointing = true
      input.idle = 0
      input.byKeys = false
    },
    pointerLeave() {
      input.pointing = false
      input.held = false
    },
    press() {
      input.held = true
      input.heldFor = 0
    },
    release() {
      // a click, not a hold: it fires in the city and rolls anywhere else
      if (input.held && input.heldFor < tune.holdSeconds && !this.fire()) this.roll()
      input.held = false
    },
    /** turn and climb are −1..1 */
    setKeys(turn, climb, boostHeld) {
      input.turn = clamp(turn, -1, 1)
      input.climb = clamp(climb, -1, 1)
      input.boost = !!boostHeld
      if (turn !== 0 || climb !== 0) input.byKeys = true
    },
    /** Fires a shot, in the city. Says whether it could. */
    fire() {
      if (!LEVELS[level].city || shiftWay !== 0) return false
      fight.fire(craft)
      return true
    },
    roll() {
      if (craft.spin >= 0) return
      craft.spin = 0
      craft.spinDir = craft.yawRate >= 0 ? 1 : -1
    },
    /** steps to the next view: overhead → chase → overhead */
    nextView() {
      goal = (goal + 1) % VIEWS.length
    },
    /** 'top' or 'chase' */
    setView(name) {
      goal = Math.max(0, VIEWS.indexOf(name))
    },
    /** the map of the level the ship is on */
    get world() {
      return world
    },
    /** 0 is the Earth, 1 the country, 2 the city */
    get level() {
      return level
    },
    /** 'none', or 'down' or 'up' while the level is changing */
    get shift() {
      return shiftWay > 0 ? 'down' : shiftWay < 0 ? 'up' : 'none'
    },
    /** true once a change of level has swapped the map and is drawing back */
    get arrived() {
      return shiftWay !== 0 && swapped
    },
    /** true when DOWN would work: the ship is over this level's marked place */
    get canDescend() {
      return shiftWay === 0 && overDoor()
    },
    /** the view the camera is in, or is on its way to */
    get view() {
      return VIEWS[goal]
    },
    /** 0..1: how much of the chase pose the camera has right now */
    get chaseAmount() {
      return inChase.at
    },
    get time() {
      return time
    },
    get boost() {
      return boost
    },
  }
}

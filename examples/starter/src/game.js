// The game: how the craft flies, where the camera sits, and the order things are drawn in.
// It knows nothing about the page. main.js feeds it input and shows its picture, and
// scripts/snapshot.mjs runs it with no browser at all.

import { createFramebuffer, BAYER4 } from './framebuffer.js'
import { createCamera, project, aimCamera } from './camera.js'
import { buildWorld, groundAt, CLOUD_BASE, TOP_Z } from './world.js'
import { drawWorld, drawSky } from './terrain.js'
import { buildCraft } from './model.js'
import { drawStack, stackAxes } from './stack.js'

export const TUNING = {
  speed: 84, // world px per second
  boost: 1.7, // × speed while the thrusters are open
  turnRate: 1.4, // radians per second at full deflection
  bank: 0.8, // radians of bank at full turn rate
  altitude: 58, // cruising height
  ceiling: 230,
  clearance: 9, // the closest the craft comes to the ground
  viewSeconds: 1.2, // a view change is nearly done after this long, then settles gently
  cameraFollow: 0.5, // overhead: how much of the craft's turn the camera makes with it
  chaseDistance: 130, // world px from the eye to the craft
  chaseAngle: 15, // degrees the chase eye looks down
  chaseWidth: 0.21, // how wide the craft is in the chase view, as a share of the frame
  holdSeconds: 0.22, // a shorter press is a click (roll); a longer one opens the thrusters
  rollSeconds: 0.75,
  trailSeconds: 2,
}

const TRAIL_POINTS = 120
const TRAIL_GAP = 3 // world px between trail points

// "Move this share of the way to the goal." Smooths anything, at any frame rate.
const ease = (dt, rate) => 1 - Math.exp(-dt * rate)
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const wrap = (angle) => angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2))
const inOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t))

export function createGame(options = {}) {
  const world = buildWorld(options.seed ?? 7, options.world)
  const model = buildCraft()
  const tune = { ...TUNING, ...options.tuning, craftWidth: model.width }
  const fb = createFramebuffer()
  const cam = createCamera()
  const axes = {}

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
  const focus = { x: craft.x, y: craft.y, alt: craft.z }
  const pose = { x: 0, y: 0, z: 0, yaw: 0, roll: 0, pitch: 0, scale: 1, spread: 1, thrust: 0 }
  const caster = {
    x: 0, y: 0, z: 0, cos: 1, sin: 0, across: 1, along: 1,
    footprint: model.footprint, width: model.width, length: model.length, pivotK: model.pivotK,
  }
  const trails = [new Float32Array(TRAIL_POINTS * 4), new Float32Array(TRAIL_POINTS * 4)]
  const tip = { x: 0, y: 0, z: 0 }
  let trailHead = 0
  let trailCount = 0
  let trailX = craft.x
  let trailY = craft.y

  let time = 0
  let boost = 0 // 0..1: how far the thrusters are open
  let altGoal = tune.altitude
  let floor = 0 // the lowest the craft may fly right now
  let climbRate = 0
  // The view is one number: 0 is overhead, 1 is the chase view, and anything between is the
  // camera on its way from one to the other.
  let viewGoal = options.view === 'chase' ? 1 : 0
  let view = viewGoal
  let viewSpeed = 0
  let overheadHeading = craft.yaw * tune.cameraFollow
  let chaseHeading = craft.yaw
  let headingGap = wrap(chaseHeading - overheadHeading)
  let eyeLift = 0 // how far the chase eye is raised or lowered to stay clear of hills and clouds
  let tilt = 1
  let spread = 1
  let spreadGoal = 1

  const spinAngle = () => (craft.spin < 0 ? 0 : craft.spinDir * Math.PI * 2 * inOut(craft.spin))

  /** The tallest ground the craft will pass over in the next moment, across its wingspan. */
  function groundAhead(speed) {
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

  function settle() {
    pose.x = craft.x
    pose.y = craft.y
    pose.z = craft.z
    pose.yaw = craft.yaw
    pose.roll = craft.roll + spinAngle()
    pose.pitch = craft.pitch
    pose.spread = spread
    pose.thrust = 0.35 + 0.65 * boost
    stackAxes(pose.yaw, pose.roll, pose.pitch, axes)
    aimCamera(cam, view, focus, overheadHeading + headingGap * view, tilt, fb.width, fb.height, tune)
  }

  function update(seconds) {
    const dt = clamp(seconds, 0, 0.05)
    if (dt <= 0) return
    time += dt
    input.idle += dt
    if (input.held) input.heldFor += dt

    // thrusters
    const pushing = (input.held && input.heldFor >= tune.holdSeconds) || input.boost
    boost += ((pushing ? 1 : 0) - boost) * ease(dt, pushing ? 5 : 2.5)
    const speed = tune.speed * (1 + (tune.boost - 1) * boost)
    const climbMax = speed * 0.5

    // ── what the player is asking for
    const chase = view > 0.5
    const pointer = input.pointing && input.idle < 6 && !input.byKeys && project(cam, craft.x, craft.y, craft.z)
    const craftX = cam.sx
    const craftY = cam.sy
    let want = 0
    let handsOn = true
    if (input.turn !== 0) {
      want = input.turn * tune.turnRate
    } else if (pointer && chase) {
      // from behind: point left or right of the craft to turn
      const t = clamp((input.x - cam.cx) / (fb.width * 0.28), -1, 1)
      if (Math.abs(t) > 0.06) want = t * tune.turnRate
    } else if (pointer) {
      // from above: the craft turns to face the pointer
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
    } else if (pointer && chase) {
      // from behind: point above the craft to climb, below it to dive
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
    if (craft.spin >= 0) {
      craft.spin += dt / tune.rollSeconds
      if (craft.spin >= 1) craft.spin = -1
    }
    // It follows the ground ahead with room to spare, so it can skim a hill but never hit one.
    const floorNow = groundAhead(speed) + tune.clearance
    floor += (floorNow - floor) * ease(dt, floorNow > floor ? 9 : 3)
    altGoal = clamp(altGoal, floor, Math.max(floor, tune.ceiling))
    const before = craft.z
    craft.z += clamp((altGoal - craft.z) * ease(dt, 3), -climbMax * dt, climbMax * dt)
    const hard = groundAt(world, craft.x, craft.y) + tune.clearance * 0.6
    if (craft.z < hard) craft.z += (hard - craft.z) * ease(dt, 20)
    climbRate += ((craft.z - before) / dt - climbRate) * ease(dt, 6)
    craft.pitch += (clamp(climbRate / Math.max(20, speed), -0.5, 0.5) - craft.pitch) * ease(dt, 4)

    spread += (spreadGoal - spread) * ease(dt, 7)

    // ── the view: a spring from where it is to where it is going, so a change starts gently,
    // ends gently, and can be turned round half-way
    const pull = 4.6 / tune.viewSeconds
    viewSpeed += (pull * pull * (viewGoal - view) - 2 * pull * viewSpeed) * dt
    view = clamp(view + viewSpeed * dt, 0, 1)
    if (Math.abs(view - viewGoal) < 0.0005 && Math.abs(viewSpeed) < 0.005) {
      view = viewGoal
      viewSpeed = 0
    }

    // ── camera: it trails the craft, looking a little ahead of it in the overhead view
    const lead = (20 + 14 * boost) * (1 - view)
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
    if (view === 0) headingGap = wrap(gap)
    else headingGap += wrap(gap - headingGap)

    // how steeply the eye looks down: 45° overhead, the chase angle from behind
    const lean = Math.tan(((45 * (1 - view) + tune.chaseAngle * view) * Math.PI) / 180)
    let lift = 0
    if (view > 0.3) {
      // Keep the chase eye above the ground behind the craft and out of the cloud layer.
      const back = tune.chaseDistance / view
      const heading = overheadHeading + headingGap * view
      const ground = groundAt(world, focus.x - Math.sin(heading) * back, focus.y + Math.cos(heading) * back) + 6
      const plain = focus.alt + lean * back
      let eye = Math.max(plain, ground)
      if (eye > CLOUD_BASE - 3 && eye < TOP_Z + 3) eye = craft.z < CLOUD_BASE - 6 ? Math.max(ground, CLOUD_BASE - 3) : TOP_Z + 3
      lift = eye - plain
    }
    eyeLift += (lift - eyeLift) * ease(dt, 6)
    tilt = view > 0.01 ? lean + (eyeLift * view) / tune.chaseDistance : lean

    settle()

    // wingtip trails: drop a point every few pixels flown
    const moved = (craft.x - trailX) ** 2 + (craft.y - trailY) ** 2
    if (moved > TRAIL_GAP * TRAIL_GAP) {
      trailX = craft.x
      trailY = craft.y
      for (let side = 0; side < 2; side++) {
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

  function drawTrails() {
    if (spread > 1.5) return
    const W = fb.width
    const H = fb.height
    const color = fb.color
    const zbuf = fb.depth
    const tones = world.palette.trail
    for (let side = 0; side < 2; side++) {
      const points = trails[side]
      wingtip(side)
      let joined = project(cam, tip.x, tip.y, tip.z)
      let fromX = cam.sx
      let fromY = cam.sy
      for (let n = 0; n < trailCount; n++) {
        const o = ((trailHead - 1 - n + TRAIL_POINTS) % TRAIL_POINTS) * 4
        const age = (time - points[o + 3]) / tune.trailSeconds
        if (age >= 1) break
        if (!project(cam, points[o], points[o + 1], points[o + 2])) {
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
    drawWorld(fb, cam, world, time, spread < 1.5 ? caster : null)
    drawSky(fb, cam, world)
    drawTrails()
    drawStack(fb, cam, model, pose, time)
    return fb
  }

  return {
    world,
    model,
    craft,
    camera: cam,
    frame: fb,
    update,
    render,
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
      if (input.held && input.heldFor < tune.holdSeconds) this.roll() // a click, not a hold
      input.held = false
    },
    /** turn and climb are −1..1 */
    setKeys(turn, climb, boostHeld) {
      input.turn = clamp(turn, -1, 1)
      input.climb = clamp(climb, -1, 1)
      input.boost = !!boostHeld
      if (turn !== 0 || climb !== 0) input.byKeys = true
    },
    roll() {
      if (craft.spin >= 0) return
      craft.spin = 0
      craft.spinDir = craft.yawRate >= 0 ? 1 : -1
    },
    toggleView() {
      viewGoal = viewGoal === 1 ? 0 : 1
    },
    setView(name) {
      viewGoal = name === 'chase' ? 1 : 0
    },
    /** pulls the slices of the stack apart, or puts them back */
    toggleSpread() {
      spreadGoal = spreadGoal === 1 ? 4 : 1
    },
    get view() {
      return viewGoal === 1 ? 'chase' : 'top'
    },
    /** 0 overhead … 1 chase: where the camera is right now */
    get viewAmount() {
      return view
    },
    get time() {
      return time
    },
    get boost() {
      return boost
    },
  }
}

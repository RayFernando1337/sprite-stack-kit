// The game's state map: the states it can be in, the steps that move it between them, and
// the rules that must hold in every one. `bun run states --game examples/worldfight` walks
// all of it. The rules come from "Always true" in GAME.md.

import { EMPTY } from './src/framebuffer.js'
import { groundAt, WORLD_SIZE } from './src/world.js'
import { placeX, placeY } from './src/atlas.js'
import { rgb } from './src/framebuffer.js'
import { VIEWS } from './src/game.js'

// the hull bar's two colours, as hud.js draws them
const HULL_INK = rgb(120, 236, 140)
const HULL_GONE = rgb(96, 44, 60)
// an enemy on the cockpit's radar, and the gunsight
const RADAR_FOE = rgb(255, 86, 96)
const SIGHT = rgb(130, 255, 160)
// the dashboard's own slate, as cockpit.js paints it
const DASH = [rgb(54, 62, 82), rgb(43, 50, 68), rgb(17, 21, 33), rgb(66, 78, 104), rgb(122, 138, 168)]
// A roll throws a missile off while it is no further through than this share. The game has
// its own copy of the number; this one is from the brief.
const PARRY = 0.6
const MISSILE_COST = 3

// Going down twice and back up twice is a long chain of steps, so the walk looks further.
// It flies at 20 steps a second, the slowest the game allows, to keep the walk short.
export const start = { seed: 7, width: 96, height: 60, framesPerSecond: 20, depth: 40 }
const STEP = 1 / start.framesPerSecond

const LEVEL = ['Earth', 'country', 'city']

/** Is the ship over this level's marked place? Worked out here, not asked of the game. */
function overPlace(game) {
  const door = game.doors[game.level]
  if (!door) return false
  let dx = door.x - game.craft.x
  if (game.level === 0) dx -= WORLD_SIZE * Math.round(dx / WORLD_SIZE)
  return Math.max(Math.abs(dx), Math.abs(door.y - game.craft.y)) < door.reach
}

/** Is there a fight the ship can take part in right now? */
const fighting = (game) => game.level === 2 && game.shift === 'none' && game.form === 'plane' && game.fight?.outcome === 'playing'
const flying = (game) => game.fight?.pilots.filter((pilot) => pilot.hull > 0).length ?? 0
/** Everything the page has been told to play as sound, added up. */
const heardSoFar = (game) => (game.heard ? Object.values(game.heard).reduce((sum, n) => sum + n, 0) : 0)

/** Puts an enemy at a spot beside the ship, flying the same way: a walk is too short for a real chase. */
function hold(game, foe, ahead, right = 0) {
  const { craft } = game
  foe.x = craft.x + Math.sin(craft.yaw) * ahead + Math.cos(craft.yaw) * right
  foe.y = craft.y - Math.cos(craft.yaw) * ahead + Math.sin(craft.yaw) * right
  foe.z = craft.z
  foe.yaw = craft.yaw
}

/** Runs before every step: what the rules compare the game with afterwards. */
export function before(game, notes) {
  const fight = game.fight
  notes.levelWas = game.level
  notes.shiftWas = game.shift
  notes.overWas = overPlace(game)
  notes.scoreWas = fight?.score ?? 0
  notes.bestWas = fight?.best ?? 0
  notes.hullWas = fight?.hull ?? 0
  notes.roundWas = fight?.round ?? 0
  notes.waveWas = fight?.wave ?? 0
  notes.leftWas = fight?.enemiesLeft ?? 0
  notes.outcomeWas = fight?.outcome ?? 'playing'
  notes.couldRestart = game.canRestart === true
  notes.couldFight = fighting(game)
  notes.rollingWas = game.craft.spin >= 0
  notes.roundsWas = fight?.rounds ?? 0
  notes.boostWas = game.boost
  notes.heardWas = heardSoFar(game)
  notes.clicked = false
  notes.held = false
  notes.launched = false
  notes.gunned = null
  notes.missiled = null
  notes.fired = null
}

export const events = {
  'you press VIEW': (game) => game.nextView(),
  'you click': (game, notes) => {
    notes.clicked = true
    game.press()
    game.release()
  },
  // Really flown, with the keys and the thrusters, until the ship is over the place.
  'you fly to the marked place': (game) => {
    const door = game.doors[game.level]
    if (!door || game.shift !== 'none') return
    for (let n = 0; n < 900 && !overPlace(game); n++) {
      let dx = door.x - game.craft.x
      if (game.level === 0) dx -= WORLD_SIZE * Math.round(dx / WORLD_SIZE)
      const off = Math.atan2(dx, -(door.y - game.craft.y)) - game.craft.yaw
      const turn = off - Math.PI * 2 * Math.round(off / (Math.PI * 2))
      game.setKeys(Math.max(-1, Math.min(1, turn * 2)) || 0.01, 0, true)
      game.update(STEP)
    }
    game.setKeys(0, 0, false)
  },
  'you press DOWN': (game) => game.descend(),
  'you press UP': (game) => game.ascend(),
  // The button held for most of a second, and the missile button pressed with it.
  'you hold the button down and press the missile button': (game, notes) => {
    notes.held = true
    game.press()
    notes.launched = game.missile ? game.missile() === true : false
    for (let n = 0; n < 14; n++) game.update(STEP)
    game.release()
  },
  // The ship's own cannon, held on an enemy that is kept in front of it.
  'your cannon is held on an enemy': (game, notes) => {
    const foe = game.fight?.pilots.find((pilot) => pilot.hull > 0)
    if (!foe || !fighting(game) || !game.setTrigger) return
    const gunned = { least: 99, most: 0, left: 0 }
    game.setTrigger(true)
    for (let n = 0; n < 60 && foe.hull > 0 && game.fight.outcome === 'playing'; n++) {
      hold(game, foe, 90)
      const was = foe.hull
      game.update(STEP)
      if (foe.hull < was) {
        gunned.least = Math.min(gunned.least, was - foe.hull)
        gunned.most = Math.max(gunned.most, was - foe.hull)
      }
    }
    game.setTrigger(false)
    gunned.left = foe.hull
    notes.gunned = gunned
  },
  // The ship's own missile: the enemy is kept in the sights until the lock is made, and then it is let go.
  'your missile is locked on to an enemy and let go': (game, notes) => {
    const fight = game.fight
    const foe = fight?.pilots.find((pilot) => pilot.hull > 0)
    if (!foe || !fighting(game) || !game.missile) return
    const missiled = { left: 0, away: false }
    // The lock goes to whichever enemy is best in the sights, which may be another one that
    // happens to be there: that one is then the one to follow.
    let target = foe
    for (let n = 0; n < 160 && target.hull > 0 && fight.outcome === 'playing'; n++) {
      hold(game, target, 150, 45) // off to one side: a missile that flew straight would miss
      if (!missiled.away && fight.locked) {
        target = fight.pilots[fight.lockOn]
        missiled.away = game.missile() === true
      }
      game.update(STEP)
    }
    missiled.left = target.hull
    notes.missiled = missiled
  },
  // An enemy's round right behind the ship, and then an enemy's missile from close behind.
  'their fire reaches you': (game, notes) => {
    const fight = game.fight
    const at = fight?.pilots.findIndex((pilot) => pilot.hull > 0) ?? -1
    if (at < 0 || !fighting(game) || !fight.enemyLaunch) return
    const { craft } = game
    const fired = { spinAtShot: craft.spin, graceAtShot: fight.hurt, shotTook: 0, spinAtEnd: -1, missileTook: 0, thrown: 0, flew: false, slowAfter: 0, shakeAfter: 0 }
    const east = Math.sin(craft.yaw)
    const south = -Math.cos(craft.yaw)
    fight.shoot(craft.x - east * 4, craft.y - south * 4, craft.z, east * 300, south * 300, 0, 1)
    let hull = fight.hull
    game.update(STEP)
    fired.shotTook = hull - fight.hull
    if (fight.outcome === 'playing') {
      const foe = fight.pilots[at]
      hold(game, foe, -24) // close behind, so it arrives before a roll that has just begun is over
      const evades = fight.evades
      hull = fight.hull
      fired.flew = fight.enemyLaunch(at, craft) === true
      // until it has hit, or been thrown off
      for (let n = 0; n < 100 && fired.flew && fight.inbound.some((missile) => missile.on && !missile.lost); n++) {
        fired.spinAtEnd = craft.spin
        game.update(STEP)
      }
      fired.missileTook = hull - fight.hull
      fired.thrown = fight.evades - evades
      fired.shakeAfter = game.shake
      game.update(STEP) // time slows from the frame after
      fired.slowAfter = game.slow
    }
    notes.fired = fired
  },
}

export const waits = {
  'a moment passes': 5,
  'everything settles': 70,
}

export function state(game, notes) {
  return {
    level: LEVEL[game.level],
    change: game.shift === 'none' ? 'steady' : `going ${game.shift}`,
    place: overPlace(game) ? 'over the marked place' : 'elsewhere',
    view: game.view,
    camera: game.chaseAmount === (game.view === 'chase' ? 1 : 0) && (game.cockpitAmount ?? 0) === (game.view === 'cockpit' ? 1 : 0) ? 'arrived' : 'moving',
    ship: game.craft.spin >= 0 ? 'rolling' : 'level',
    shape: game.form ?? 'one shape',
    // Exact numbers, not groups: two games with different hulls go different ways, and the
    // walk only goes on from one game in each state.
    hull: `${game.fight?.hull ?? 0} hull`,
    enemies: `${game.fight?.enemiesLeft ?? 0} enemies`,
    // a fight that is over offers a new one only once its end has played out, and a click then means something else
    fight: `${game.fight?.outcome ?? 'playing'}${game.canRestart ? ', and a new fight is on offer' : ''}`,
  }
}
export function label(name) {
  const [level, change] = name.split(' · ')
  return change === 'steady' ? level : `${change} from the ${level}`
}

const count = (frame, colour) => {
  let n = 0
  for (let i = 0; i < frame.width * frame.height; i++) if (frame.color[i] === colour) n++
  return n
}

export const rules = [
  {
    name: 'every pixel of every frame is drawn, on every level and between levels',
    check: (game, frame) => {
      const empty = count(frame, EMPTY)
      return empty ? `${empty} pixels were left empty` : ''
    },
  },
  {
    name: 'the camera and the ship only ever hold real numbers',
    check: (game) => {
      const { camera: cam, craft } = game
      const values = [cam.x, cam.y, cam.alt, cam.persp, cam.tilt, cam.zoom, craft.x, craft.y, craft.z, craft.yaw, craft.roll, craft.pitch]
      return values.every(Number.isFinite) ? '' : `one of them is ${values.find((v) => !Number.isFinite(v))}`
    },
  },
  {
    name: 'the ship never touches the ground or a building',
    check: (game) => {
      const clear = game.craft.z - groundAt(game.world, game.craft.x, game.craft.y)
      return clear > 2 ? '' : `it is ${clear.toFixed(1)} px above the ground`
    },
  },
  {
    name: 'the ship is always on its map',
    check: (game) => {
      const { x, y } = game.craft
      return x >= 0 && y >= 0 && x < WORLD_SIZE && y < WORLD_SIZE ? '' : `it is at ${x.toFixed(0)}, ${y.toFixed(0)}`
    },
  },
  {
    name: 'a way down only starts over a marked place',
    check: (game, frame, s, notes) => (game.shift === 'down' && notes.shiftWas === 'none' && !notes.overWas ? 'it started with the ship somewhere else' : ''),
  },
  {
    name: 'the level only changes one at a time, and only goes down on a way down',
    check: (game, frame, s, notes) => {
      const moved = game.level - notes.levelWas
      if (moved > 1 || moved < -2) return `it went from the ${LEVEL[notes.levelWas]} to the ${LEVEL[game.level]} in one step`
      if (moved === 1 && notes.shiftWas !== 'down' && game.shift !== 'down') return 'it went down with no way down in progress'
      return ''
    },
  },
  {
    name: 'coming up a level, the ship is over the place it went down from',
    check: (game) => (game.shift === 'up' && game.arrived && !overPlace(game) ? `it came up at ${game.craft.x.toFixed(0)}, ${game.craft.y.toFixed(0)}, away from the marked place` : ''),
  },
  {
    name: 'once the camera has arrived and the level is steady, the ship is in sight unless it has been shot down; from the cockpit it is out of sight',
    check: (game, frame, s) => {
      if (!VIEWS.includes('cockpit')) return 'the game has no cockpit view'
      if (s.camera !== 'arrived' || s.change !== 'steady' || game.fight?.outcome === 'lost') return '' // shot down, it falls and is gone
      const outline = count(frame, game.model.outline)
      if (s.view === 'cockpit') return outline === 0 ? '' : `${outline} pixels of the ship's outline show from inside it`
      // a plane half-way through a roll is seen edge on, and a stack seen edge on is a thin line
      const least = s.ship === 'rolling' ? 3 : 8
      return outline > least ? '' : `only ${outline} pixels of the ship's outline show`
    },
  },
  {
    name: 'left alone, the ship is a fighter plane in the city and a rocket everywhere else',
    after: 'everything settles',
    check: (game, frame, s) => {
      if (!game.form) return 'the ship has only one shape'
      if (s.change !== 'steady') return ''
      const want = game.level === 2 ? 'plane' : 'rocket'
      return game.form === want ? '' : `over the ${LEVEL[game.level]} it is ${game.form === 'changing' ? 'still changing' : `a ${game.form}`}`
    },
  },
  {
    name: 'the ship changes shape in plain sight, never while it is hidden',
    check: (game, frame, s) => {
      if (!game.form) return 'the ship has only one shape'
      if (game.form !== 'changing' || s.camera !== 'arrived' || s.view === 'cockpit') return ''
      const outline = count(frame, game.model.outline)
      return outline > 8 ? '' : `only ${outline} pixels of its outline show while it changes`
    },
  },
  {
    name: 'the fighter plane has wingtips for trails and nozzles for flames, and the enemies fly a plane of their own',
    check: (game) => {
      const { rocket, plane, rival } = game.models ?? {}
      if (!plane || !rival) return 'the game has no plane'
      if (plane === rocket || rival === plane || rival === rocket) return 'two of the three are the same model'
      if (plane.wingtips.length < 2 || plane.nozzles.length < 1) return `the plane has ${plane.wingtips.length} wingtips and ${plane.nozzles.length} nozzles`
      if (rival.outline === plane.outline) return 'the enemy is outlined in the ship\'s own colour'
      return game.model === (game.form === 'plane' ? plane : game.form === 'rocket' ? rocket : game.model) ? '' : `as a ${game.form} it is drawn with the other model`
    },
  },  {
    name: 'the picture banks only in the cockpit, and there it banks with the ship',
    check: (game, frame, s) => {
      if (!VIEWS.includes('cockpit') || game.viewRoll === undefined) return 'the game has no cockpit view'
      if (game.cockpitAmount === 0) return game.viewRoll === 0 ? '' : `outside the cockpit the picture is banked ${game.viewRoll.toFixed(2)} rad`
      if (s.view !== 'cockpit' || s.camera !== 'arrived') return ''
      // a banked ship banks the picture the same way
      const bank = game.craft.roll
      // a roll, or the tumble of a plane that is shot down, turns the picture right round
      return Math.abs(bank) < 0.05 || s.ship === 'rolling' || game.fight.outcome === 'lost' || Math.sign(game.viewRoll) === Math.sign(bank) ? '' : `the ship banks ${bank.toFixed(2)} rad and the picture ${game.viewRoll.toFixed(2)}`
    },
  },
  {
    name: 'in the cockpit the dashboard is under the view and the sky or the ground is over it',
    check: (game, frame, s) => {
      if (!VIEWS.includes('cockpit')) return 'the game has no cockpit view'
      if (s.view !== 'cockpit' || s.camera !== 'arrived') return ''
      // the bottom corners are dashboard; a row a third of the way down is the world, in more than one colour
      const { width, height, color } = frame
      for (const x of [0, width - 1]) {
        if (!DASH.includes(color[(height - 1) * width + x])) return `the bottom ${x ? 'right' : 'left'} corner is not the dashboard's colour`
      }
      const seen = new Set()
      for (let x = 0; x < width; x++) seen.add(color[((height * 0.3) | 0) * width + x])
      return seen.size >= 2 ? '' : 'the view over the dashboard is one flat colour'
    },
  },
  {
    name: 'from the cockpit over the city, the radar shows that there are enemies in the air',
    check: (game, frame, s) => {
      if (!VIEWS.includes('cockpit')) return 'the game has no cockpit view'
      if (s.view !== 'cockpit' || s.camera !== 'arrived' || game.level !== 2 || game.shift !== 'none' || game.form !== 'plane') return ''
      const inAir = flying(game)
      const blips = count(frame, RADAR_FOE)
      if (inAir > 0 && blips === 0) return `${inAir} enemies are flying and the radar shows none`
      return inAir === 0 && blips > 0 ? 'the radar shows an enemy and none is flying' : ''
    },
  },
  {
    name: 'while there is a fight a gunsight shows, in every view',
    check: (game, frame, s) => {
      if (!VIEWS.includes('cockpit')) return 'the game has no cockpit view'
      if (s.camera !== 'arrived' || game.level !== 2 || game.shift !== 'none' || game.form !== 'plane' || game.fight.outcome !== 'playing') return ''
      const sight = count(frame, SIGHT)
      return sight >= 4 ? '' : `only ${sight} pixels of the gunsight show in the ${s.view} view`
    },
  },  {
    name: 'San Francisco has its landmarks: towers downtown, low blocks in the Sunset, and both bridges standing in the water',
    check: (game) => {
      const city = game.world.levels[2]
      // the tallest thing within a pixel of a place: a bridge is one pixel wide
      const at = (lon, lat) => {
        let tall = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tall = Math.max(tall, groundAt(city, placeX(city.map, lon) + dx, placeY(city.map, lat) + dy))
        return tall
      }
      if (at(-122.3972, 37.7897) < 24) return `downtown is ${at(-122.3972, 37.7897)} layers tall where Salesforce Tower should be`
      if (at(-122.4778, 37.8136) < 18) return 'the Golden Gate Bridge has no south tower'
      if (at(-122.3745, 37.8015) < 2) return 'the Bay Bridge does not cross the water'
      const sunset = at(-122.4945, 37.7535)
      return sunset > 0 && sunset < 14 ? '' : `the Sunset is ${sunset} layers tall`
    },
  },
  {
    name: 'enemies exist only in the city',
    check: (game) => {
      if (!game.fight) return 'the game has no dogfight'
      return game.level === 2 || game.fight.enemiesLeft === 0 ? '' : `${game.fight.enemiesLeft} enemies are flying on the ${LEVEL[game.level]} level`
    },
  },
  {
    name: 'in the city there is a fight: enemies in the air, or the next wave on its way, or a fight that is over',
    check: (game) => {
      if (!game.fight) return 'the game has no dogfight'
      if (game.level !== 2 || game.shift !== 'none') return ''
      return flying(game) > 0 || game.fight.waveDue > 0 || game.fight.outcome !== 'playing' ? '' : 'the city is empty, no wave is on its way and nobody has won'
    },
  },
  {
    name: 'during a fight the hull never gets stronger, and never falls below nothing',
    check: (game, frame, s, notes) => {
      if (!game.fight) return 'the game has no hull strength'
      if (game.fight.hull < 0) return `it is ${game.fight.hull}`
      return game.fight.round !== notes.roundWas || game.fight.hull <= notes.hullWas ? '' : `it rose from ${notes.hullWas} to ${game.fight.hull}`
    },
  },
  {
    name: 'during a fight the score never goes down, and the best score is never less than the score and never goes down at all',
    check: (game, frame, s, notes) => {
      const fight = game.fight
      if (!fight) return 'the game has no score'
      if (fight.best === undefined) return 'the game keeps no best score'
      if (fight.round === notes.roundWas && fight.score < notes.scoreWas) return `the score fell from ${notes.scoreWas} to ${fight.score}`
      if (fight.best < fight.score) return `the best score is ${fight.best} and the score is ${fight.score}`
      return fight.best >= notes.bestWas ? '' : `the best score fell from ${notes.bestWas} to ${fight.best}`
    },
  },
  {
    name: 'holding the button fires a stream of rounds as a plane in a fight, and opens the thrusters anywhere else',
    check: (game, frame, s, notes) => {
      if (!notes.held) return ''
      const fight = game.fight
      if (!fight || fight.rounds === undefined) return 'the game has no cannon to hold down'
      const rounds = fight.rounds - notes.roundsWas
      if (notes.couldFight && fighting(game)) {
        // a rolling ship holds its fire until it is level again, which can take the whole hold
        if (notes.rollingWas || s.ship === 'rolling') return ''
        return rounds >= 4 ? '' : `${rounds} rounds left the guns in most of a second`
      }
      if (rounds > 0 && !notes.couldFight) return `${rounds} rounds were fired with no fight to fire them in`
      if (notes.levelWas !== 2 && game.level !== 2 && game.boost < 0.6) return `away from the city the thrusters are only ${game.boost.toFixed(2)} open`
      return ''
    },
  },
  {
    name: 'a missile only leaves its rail in a fight, and the rails never hold fewer than none or more than they have room for',
    check: (game, frame, s, notes) => {
      const fight = game.fight
      if (!fight || fight.rails === undefined) return 'the ship has no missiles'
      if (fight.rails < 0 || fight.rails > fight.railsMax) return `${fight.rails} missiles are on ${fight.railsMax} rails`
      return notes.launched && !notes.couldFight ? 'a missile left with no fight to fire it in' : ''
    },
  },
  {
    name: 'the cannon, held on an enemy, takes one from its hull with every round, shoots it down and scores',
    check: (game, frame, s, notes) => {
      if (!game.setTrigger) return 'the game has no cannon to hold down'
      const gunned = notes.gunned
      if (!gunned || game.fight.round !== notes.roundWas || game.fight.outcome === 'lost') return ''
      if (gunned.least !== 1 || gunned.most > 2) return gunned.least === 99 ? 'no round reached the enemy in three seconds' : `one frame took ${gunned.most} from its hull`
      if (gunned.left > 0) return `after three seconds of fire the enemy still has ${gunned.left} hull`
      if (game.fight.enemiesLeft !== notes.leftWas - 1) return `${notes.leftWas} enemies were left, and now ${game.fight.enemiesLeft} are`
      return game.fight.score > notes.scoreWas ? '' : 'the enemy went down and the score stayed the same'
    },
  },
  {
    name: 'a missile let go with a lock follows its enemy and shoots it down',
    check: (game, frame, s, notes) => {
      if (!game.missile) return 'the ship has no missiles'
      const missiled = notes.missiled
      if (!missiled || game.fight.round !== notes.roundWas || game.fight.outcome === 'lost') return ''
      if (!missiled.away) return 'in eight seconds with the enemy in the sights, no missile left'
      if (missiled.left > 0) return `the missile left and the enemy still has ${missiled.left} hull`
      return game.fight.enemiesLeft === notes.leftWas - 1 ? '' : `${notes.leftWas} enemies were left, and now ${game.fight.enemiesLeft} are`
    },
  },
  {
    name: 'an enemy round that reaches the ship takes one from the hull, unless the ship is rolling',
    check: (game, frame, s, notes) => {
      if (!game.fight?.enemyLaunch) return 'the enemies have nothing to fire'
      const fired = notes.fired
      if (!fired) return ''
      if (fired.spinAtShot >= 0) return fired.shotTook === 0 ? '' : `the ship was rolling and lost ${fired.shotTook} hull`
      if (fired.graceAtShot < 0.2) return '' // two rounds of one burst do not both land
      return fired.shotTook >= 1 ? '' : 'the round reached a level ship and the hull stayed the same'
    },
  },
  {
    name: 'an enemy missile that arrives early in a roll is thrown off and time slows; one that arrives on a level ship takes hull and shakes the picture',
    check: (game, frame, s, notes) => {
      if (!game.fight?.enemyLaunch) return 'the enemies have nothing to fire'
      const fired = notes.fired
      if (!fired || !fired.flew) return ''
      // the spin a frame before it arrived, so the roll was a little further on when it did
      const spin = fired.spinAtEnd
      const turned = spin >= 0 ? spin + STEP / 0.75 : -1
      if (spin >= 0 && turned <= PARRY) {
        if (fired.thrown !== 1) return `the ship was ${Math.round(turned * 100)}% through a roll and the missile was not thrown off`
        return fired.slowAfter > 0 ? '' : 'the missile was thrown off and time did not slow'
      }
      if (spin < 0 && game.craft.spin < 0) {
        if (fired.thrown !== 0) return 'a level ship threw the missile off'
        if (fired.missileTook < Math.min(MISSILE_COST, notes.hullWas - fired.shotTook)) return `the missile reached a level ship and took ${fired.missileTook} hull`
        return fired.shakeAfter > 0 ? '' : 'the missile hit and the picture did not shake'
      }
      return ''
    },
  },
  {
    name: 'enemies fly above the ground, no more of them than the wave has, and the wave only moves on',
    check: (game, frame, s, notes) => {
      const fight = game.fight
      if (!fight || fight.wave === undefined) return 'the enemies do not come in waves'
      for (const pilot of fight.pilots) {
        if (pilot.hull <= 0) continue
        const clear = pilot.z - groundAt(game.world, pilot.x, pilot.y)
        if (clear <= 2) return `an enemy is ${clear.toFixed(1)} px above the ground`
      }
      if (flying(game) > fight.waveSize) return `${flying(game)} enemies are flying in a wave of ${fight.waveSize}`
      return fight.round !== notes.roundWas || fight.wave >= notes.waveWas ? '' : `the wave went back from ${notes.waveWas + 1} to ${fight.wave + 1}`
    },
  },
  {
    name: 'once a fight is over and its end has played out, a click starts a new one with a full hull and no score',
    check: (game, frame, s, notes) => {
      if (game.canRestart === undefined) return 'a fight that is over stays over'
      if (!notes.clicked || !notes.couldRestart) return ''
      const fight = game.fight
      if (fight.round !== notes.roundWas + 1) return 'the click did not start a new fight'
      return fight.outcome === 'playing' && fight.hull === fight.hullMax && fight.score === 0 ? '' : `the new fight starts ${fight.outcome}, with ${fight.hull} hull and a score of ${fight.score}`
    },
  },
  {
    name: 'what the page plays as sound is only ever counted up',
    check: (game, frame, s, notes) => {
      if (!game.heard) return 'the game tells the page nothing to play'
      return heardSoFar(game) >= notes.heardWas ? '' : 'a count of sounds went down'
    },
  },
  {
    name: 'left alone with nothing hit, time runs at full speed, the picture is still and no flash is left',
    after: 'everything settles',
    check: (game, frame, s, notes) => {
      if (game.slow === undefined) return 'the game has no slow motion'
      // something blew up or was hit during the wait: it may still be dying away
      if (heardSoFar(game) !== notes.heardWas) return ''
      return game.slow === 0 && game.shake === 0 && game.flash === 0 ? '' : `after three quiet seconds time is slowed by ${game.slow.toFixed(2)}, the shake is ${game.shake.toFixed(2)} and the flash ${game.flash.toFixed(2)}`
    },
  },
  {
    name: 'left alone after a fight is over, a new fight is on offer',
    after: 'everything settles',
    check: (game, frame, s, notes) => {
      if (game.canRestart === undefined) return 'a fight that is over stays over'
      if (notes.outcomeWas === 'playing' || game.level !== 2 || game.shift !== 'none' || notes.levelWas !== 2) return ''
      return game.canRestart ? '' : `three seconds after the fight was ${notes.outcomeWas}, no new fight is on offer`
    },
  },  {
    name: 'the fight is lost exactly when the hull is gone, won exactly when the last enemy is, and never both',
    check: (game) => {
      if (!game.fight) return 'the game has no fight to win'
      const { hull, enemiesLeft, outcome } = game.fight
      // away from the city there is no fight to win or lose
      if (game.level !== 2) return outcome === 'playing' ? '' : `it is ${outcome} on the ${LEVEL[game.level]} level`
      if (outcome === 'lost') return hull === 0 ? '' : `lost with ${hull} hull left`
      if (outcome === 'won') return enemiesLeft === 0 && hull > 0 ? '' : `won with ${enemiesLeft} enemies left and ${hull} hull`
      return hull > 0 && enemiesLeft > 0 ? '' : `still playing with ${hull} hull and ${enemiesLeft} enemies`
    },
  },
  {
    name: 'in the city the hull and the score are shown in the picture',
    check: (game, frame) => {
      if (!game.fight) return 'the game draws no hull or score'
      if (game.level !== 2 || game.shift !== 'none') return ''
      const pips = count(frame, HULL_INK) + count(frame, HULL_GONE)
      return pips >= 4 ? '' : `only ${pips} pixels of the hull bar show`
    },
  },
  {
    name: 'left alone, a change of level finishes, the camera arrives and a roll finishes',
    after: 'everything settles',
    // a change that starts during the wait, by flying out of the side of a map, may still be going
    check: (game, frame, s, notes) => ((notes.shiftWas === 'none' || game.shift !== notes.shiftWas || game.level !== notes.levelWas) && s.camera === 'arrived' && s.ship === 'level' ? '' : `after more than three seconds the level is ${s.change}, the camera is ${s.camera} and the ship is ${s.ship}`),
  },
]

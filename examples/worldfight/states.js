// The game's state map: the states it can be in, the steps that move it between them, and
// the rules that must hold in every one. `bun run states --game examples/worldfight` walks
// all of it. The rules come from "Always true" in GAME.md.

import { EMPTY } from './src/framebuffer.js'
import { groundAt, WORLD_SIZE } from './src/world.js'
import { placeX, placeY } from './src/atlas.js'
import { rgb } from './src/framebuffer.js'

// the hull bar's two colours, as hud.js draws them
const HULL_INK = rgb(120, 236, 140)
const HULL_GONE = rgb(96, 44, 60)

// Going down twice and back up twice is a long chain of steps, so the walk looks further.
export const start = { seed: 7, width: 96, height: 60, framesPerSecond: 30, depth: 40 }

const LEVEL = ['Earth', 'country', 'city']

/** Is the ship over this level's marked place? Worked out here, not asked of the game. */
function overPlace(game) {
  const door = game.doors[game.level]
  if (!door) return false
  let dx = door.x - game.craft.x
  if (game.level === 0) dx -= WORLD_SIZE * Math.round(dx / WORLD_SIZE)
  return Math.max(Math.abs(dx), Math.abs(door.y - game.craft.y)) < door.reach
}

/** Runs before every step: what the rules compare the game with afterwards. */
export function before(game, notes) {
  notes.levelWas = game.level
  notes.shiftWas = game.shift
  notes.overWas = overPlace(game)
  notes.scoreWas = game.fight?.score ?? 0
  notes.hullWas = game.fight?.hull ?? 0
  notes.roundWas = game.fight?.round ?? 0
  notes.struck = false
  notes.wasHit = false
}

export const events = {
  'you press VIEW': (game) => game.nextView(),
  'you click': (game) => {
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
      game.update(1 / start.framesPerSecond)
    }
    game.setKeys(0, 0, false)
  },  'you press DOWN': (game) => game.descend(),
  'you press UP': (game) => game.ascend(),
  // The game's own shots, started right beside their target: a walk is too short for a real chase.
  'your shot reaches an enemy': (game, notes) => {
    const fight = game.fight
    const foe = fight?.pilots.find((pilot) => pilot.hull > 0)
    if (!foe || game.level !== 2 || game.shift !== 'none' || fight.outcome !== 'playing') return
    fight.shoot(foe.x - 6, foe.y, foe.z, 1, 0, 0) // a frame later it is in the middle of the enemy
    notes.struck = true
  },
  'their shot reaches you': (game, notes) => {
    const fight = game.fight
    if (!fight || game.level !== 2 || game.shift !== 'none' || fight.outcome !== 'playing') return
    fight.shoot(game.craft.x - 2, game.craft.y, game.craft.z, 1, 0, 1)
    notes.wasHit = true
  },
}

export const waits = {
  'a moment passes': 7,
  'everything settles': 100,
}

export function state(game, notes) {
  return {
    level: LEVEL[game.level],
    change: game.shift === 'none' ? 'steady' : `going ${game.shift}`,
    place: overPlace(game) ? 'over the marked place' : 'elsewhere',
    view: game.view,
    camera: game.chaseAmount === (game.view === 'chase' ? 1 : 0) ? 'arrived' : 'moving',
    ship: game.craft.spin >= 0 ? 'rolling' : 'level',
    // Exact numbers, not groups: two games with different hulls go different ways, and the
    // walk only goes on from one game in each state.
    hull: `${game.fight?.hull ?? 0} hull`,
    enemies: `${game.fight?.enemiesLeft ?? 0} enemies`,
    nearest: `${game.fight?.pilots.find((pilot) => pilot.hull > 0)?.hull ?? 0} hits to down the next`,
    fight: game.fight?.outcome ?? 'playing',
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
    name: 'once the camera has arrived and the level is steady, the ship is in sight',
    check: (game, frame, s) => {
      if (s.camera !== 'arrived' || s.change !== 'steady') return ''
      const outline = count(frame, game.model.outline)
      return outline > 8 ? '' : `only ${outline} pixels of the ship's outline show`
    },
  },
  {
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
    name: 'in the city there is a fight: enemies in the air, or a fight that is over',
    check: (game) => {
      if (!game.fight) return 'the game has no dogfight'
      if (game.level !== 2 || game.shift !== 'none') return ''
      return game.fight.enemiesLeft > 0 || game.fight.outcome !== 'playing' ? '' : 'the city is empty and nobody has won'
    },
  },
  {
    name: 'the score never goes down',
    check: (game, frame, s, notes) => {
      if (!game.fight) return 'the game has no score'
      return game.fight.score >= notes.scoreWas ? '' : `it fell from ${notes.scoreWas} to ${game.fight.score}`
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
    name: 'a shot of yours that reaches an enemy hurts it and scores',
    check: (game, frame, s, notes) => {
      if (!game.fight) return 'the game has no shots'
      if (!notes.struck) return ''
      return game.fight.score > notes.scoreWas ? '' : 'the shot reached the enemy and the score stayed the same'
    },
  },
  {
    name: 'a shot of theirs that reaches you takes one from the hull',
    check: (game, frame, s, notes) => {
      if (!game.fight) return 'the game has no shots'
      if (!notes.wasHit) return ''
      return game.fight.hull < notes.hullWas || notes.hullWas === 0 ? '' : `the hull stayed at ${game.fight.hull}`
    },
  },
  {
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
  },  {
    name: 'left alone, a change of level finishes, the camera arrives and a roll finishes',
    after: 'everything settles',
    // a change that starts during the wait, by flying out of the side of a map, may still be going
    check: (game, frame, s, notes) => ((notes.shiftWas === 'none' || game.shift !== notes.shiftWas || game.level !== notes.levelWas) && s.camera === 'arrived' && s.ship === 'level' ? '' : `after more than three seconds the level is ${s.change}, the camera is ${s.camera} and the ship is ${s.ship}`),
  },
]

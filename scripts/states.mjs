#!/usr/bin/env bun
// Walks a game through every state its state map can reach, and checks the map's rules on
// the way.
//
//   bun run states                              # the starter
//   bun run states --game examples/my-game      # a copy with its own states.js
//   bun run states --chart                      # also print the states as a Mermaid chart
//   bun run states --depth 3                    # stop after paths of three steps
//
// A normal check tries the cases somebody thought of. This tries every order of the steps
// in `<game>/states.js`: it starts a fresh game, takes one step, notes which state the game
// is in, and goes on from every state it has not seen before until there are no new ones.
// The game is repeatable, so a path can always be replayed, and a broken rule is reported
// with the shortest list of steps that breaks it.
//
// What a pass covers: the steps and rules in the map, in every order, at the map's two
// timings. It does not cover a step the map leaves out, or a timing between the two.

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Explores the game in `game` (a folder, relative to the kit). Returns what it found. */
export async function runStates({ game: folder = 'examples/starter', depth } = {}) {
  const dir = resolve(root, folder)
  const { createGame } = await import(pathToFileURL(join(dir, 'src/game.js')).href)
  const map = await import(pathToFileURL(join(dir, 'states.js')).href)
  depth ??= map.start.depth ?? 12 // a map with long chains of steps says so itself
  const steps = [...Object.keys(map.events), ...Object.keys(map.waits)]
  const broken = new Map() // rule name → { path, detail }: the first, so the shortest, path that breaks it
  let frames = 0
  const world = createGame({ seed: map.start.seed }).world // built once; every walk flies over the same one

  const judge = (game, notes, path, step, settled) => {
    const frame = game.render()
    const state = map.state(game, notes)
    for (const rule of map.rules) {
      if (broken.has(rule.name)) continue
      if (rule.after && (!settled || rule.after !== step)) continue
      const detail = rule.check(game, frame, state, notes)
      if (detail) broken.set(rule.name, { path: [...path], detail, state })
    }
    return state
  }

  /** Plays a path on a fresh game, checking the rules as it goes, and returns the state it ends in. */
  const play = (path) => {
    const game = createGame({ seed: map.start.seed, world })
    game.resize(map.start.width, map.start.height)
    const notes = {} // what the map wants to remember about the player: a button held, a key down
    const dt = 1 / (map.start.framesPerSecond ?? 60)
    let state = map.state(game, notes)
    for (let n = 0; n < path.length; n++) {
      const step = path[n]
      const last = n === path.length - 1
      const count = map.waits[step] ?? 1
      if (map.before) map.before(game, notes) // lets a rule compare the game with how it was before the step
      if (map.events[step]) map.events[step](game, notes)
      for (let i = 0; i < count; i++) {
        game.update(dt)
        frames++
        // only the newest step needs judging: the steps before it were judged on an earlier path
        if (last && (i === count - 1 || i % 3 === 0)) state = judge(game, notes, path, step, i === count - 1)
      }
      if (!last) state = map.state(game, notes)
    }
    return state
  }

  const name = (state) => Object.values(state).join(' · ')
  const played = new Map() // path → the state it ends in, so no path is flown twice
  const end = (path) => {
    const key = path.join(' | ')
    if (!played.has(key)) played.set(key, name(play(path)))
    return played.get(key)
  }
  const seen = new Map([[end([]), []]]) // state → the shortest path to it
  const arrows = new Map() // "from → to" → the steps that make that move
  let frontier = [[]]
  let tried = 0
  let longest = 0
  while (frontier.length && longest < depth) {
    const next = []
    for (const path of frontier) {
      const from = end(path)
      for (const step of steps) {
        const to = end([...path, step])
        tried++
        if (from !== to) {
          const key = `${from} → ${to}`
          if (!arrows.has(key)) arrows.set(key, { from, to, steps: new Set() })
          arrows.get(key).steps.add(step)
        }
        if (!seen.has(to)) {
          seen.set(to, [...path, step])
          next.push([...path, step])
        }
      }
    }
    frontier = next
    if (next.length) longest++
  }
  return { folder, map, seen, arrows, broken, tried, frames, longest, complete: frontier.length === 0 }
}

/** The moves between states as a Mermaid chart, with the map's `label` naming each state. */
export function chart({ map, arrows }) {
  const label = map.label ?? ((state) => state)
  const ids = new Map()
  const id = (text) => ids.get(text) ?? ids.set(text, `s${ids.size}`).get(text)
  const lines = new Map()
  for (const { from, to, steps } of arrows.values()) {
    const a = label(from)
    const b = label(to)
    if (a === b) continue
    const key = `${id(a)} --> ${id(b)}`
    if (!lines.has(key)) lines.set(key, new Set())
    for (const step of steps) lines.get(key).add(step)
  }
  const out = ['stateDiagram-v2']
  for (const [text, key] of ids) out.push(`  ${key}: ${text}`)
  for (const [key, steps] of lines) out.push(`  ${key}: ${[...steps].join(' / ')}`)
  return out.join('\n')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flag = (name) => {
    const at = process.argv.indexOf(`--${name}`)
    return at < 0 ? undefined : process.argv[at + 1]
  }
  const began = performance.now()
  const found = await runStates({ game: flag('game'), depth: flag('depth') ? Number(flag('depth')) : undefined })
  const { map, seen, arrows, broken, tried, frames, longest, complete } = found
  console.log(`${found.folder}: ${seen.size} states, ${arrows.size} moves between them`)
  console.log(`${tried} paths tried, up to ${longest} steps long, ${frames} frames flown, ${((performance.now() - began) / 1000).toFixed(1)} s`)
  console.log(complete ? 'every state the map can reach was visited' : `stopped at ${longest} steps: there may be states further out (raise --depth)`)
  console.log()
  for (const rule of map.rules) {
    const fail = broken.get(rule.name)
    console.log(`${fail ? 'FAIL' : 'ok  '}  ${rule.name}`)
    if (!fail) continue
    console.log(`      ${fail.detail}`)
    console.log(`      the shortest way to get there, from a fresh game:`)
    fail.path.forEach((step, n) => console.log(`        ${n + 1}. ${step}`))
    console.log(`      which leaves the game in: ${Object.entries(fail.state).map(([k, v]) => `${k} ${v}`).join(', ')}`)
  }
  if (process.argv.includes('--chart')) console.log(`\n${chart(found)}`)
  console.log(broken.size ? `\n${broken.size} of ${map.rules.length} rules broken` : `\nall ${map.rules.length} rules hold in every state`)
  process.exit(broken.size ? 1 : 0)
}

#!/usr/bin/env bun
// Runs the starter game with no browser and saves frames as PNG files, so a person or a
// coding agent can look at what the game draws.
//
//   bun run snapshot                                  # every view → snapshots/
//   bun run snapshot --view cockpit --seed 3
//   bun run snapshot --seconds 6 --width 480 --height 270 --scale 3
//   bun run snapshot --turn 1 --boost                 # hold a right turn with the thrusters open
//   bun run snapshot --game examples/boats            # a copy of the starter
//
// Views: top, chase, cockpit, between (half-way from overhead to chase), entering (half-way
// from chase into the cockpit), apart (slices pulled apart).

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { encodePng } from './lib/png.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i < 0 ? fallback : args[i + 1]
}
const width = Number(flag('width', 384))
const height = Number(flag('height', 240))
const scale = Number(flag('scale', 2))
const seed = Number(flag('seed', 7))
const seconds = Number(flag('seconds', 3))
const turn = Number(flag('turn', 0))
const climb = Number(flag('climb', 0))
const boost = args.includes('--boost')
const out = resolve(root, flag('out', 'snapshots'))
const views = flag('view', 'top,chase,cockpit,between,entering,apart').split(',')
const { createGame } = await import(pathToFileURL(resolve(root, flag('game', 'examples/starter'), 'src/game.js')).href)

// the view each picture starts in
const START = { chase: 'chase', cockpit: 'cockpit', entering: 'chase' }

mkdirSync(out, { recursive: true })
for (const view of views) {
  const game = createGame({ seed, view: START[view] ?? 'top' })
  game.resize(width, height)
  if (turn || climb || boost) game.setKeys(turn, climb, boost)
  const frames = Math.round(seconds * 60)
  for (let i = 0; i < frames; i++) {
    // these start the camera move late, so the last frame catches it half-way
    if ((view === 'between' || view === 'entering') && i === frames - 24) game.nextView()
    if (view === 'apart' && i === frames - 40) game.toggleSpread()
    game.update(1 / 60)
  }
  const frame = game.render()
  const file = join(out, `${view}-seed${seed}.png`)
  writeFileSync(file, encodePng(frame.bytes, frame.width, frame.height, scale))
  console.log(file)
}

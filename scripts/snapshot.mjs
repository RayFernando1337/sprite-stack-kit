#!/usr/bin/env bun
// Runs the starter game with no browser and saves frames as PNG files, so a person or a
// coding agent can look at what the game draws.
//
//   bun run snapshot                                  # every view → snapshots/
//   bun run snapshot --view cockpit --seed 3
//   bun run snapshot --seconds 6 --width 480 --height 270 --scale 3
//   bun run snapshot --turn 1 --boost                 # hold a right turn with the thrusters open
//   bun run snapshot --game examples/boats            # a copy: the views it has, as boats-<view>-seed7.png
//   bun run snapshot --game examples/boats --option level=2   # passed to the game's createGame()
//
// Views: top, chase, cockpit, between (half-way from the first view to the next), entering (half-way
// from chase into the cockpit), apart (slices pulled apart).

import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
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
// --option name=value, as often as needed: extra options for the game's createGame()
const extra = {}
args.forEach((arg, i) => {
  if (arg !== '--option') return
  const [name, value] = (args[i + 1] ?? '').split('=')
  extra[name] = value === '' || Number.isNaN(Number(value)) ? value : Number(value)
})
const tag = Object.entries(extra).map(([name, value]) => `${name}${value}-`).join('')
const out = resolve(root, flag('out', 'snapshots'))
const folder = flag('game', 'examples/starter')
const { createGame, VIEWS } = await import(pathToFileURL(resolve(root, folder, 'src/game.js')).href)

// the view each picture starts in, and what the game must have for the picture to exist
const START = { chase: 'chase', cockpit: 'cockpit', entering: 'chase' }
const has = {
  top: true,
  chase: VIEWS.includes('chase'),
  cockpit: VIEWS.includes('cockpit'),
  between: VIEWS.length > 1,
  entering: VIEWS.includes('chase') && VIEWS.includes('cockpit'),
  apart: typeof createGame({ seed }).toggleSpread === 'function',
}
const views = flag('view', Object.keys(has).filter((name) => has[name]).join(',')).split(',')
const missing = views.filter((name) => !has[name])
if (missing.length) {
  console.error(`${folder} has no ${missing.join(' or ')} picture. It has: ${Object.keys(has).filter((name) => has[name]).join(', ')}`)
  process.exit(1)
}
// a copy's frames get the copy's name, so they do not replace the starter's
const prefix = folder.replace(/\/+$/, '').endsWith('examples/starter') ? '' : `${basename(resolve(root, folder))}-`

mkdirSync(out, { recursive: true })
for (const view of views) {
  const game = createGame({ ...extra, seed, view: START[view] ?? 'top' })
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
  const file = join(out, `${prefix}${tag}${view}-seed${seed}.png`)
  writeFileSync(file, encodePng(frame.bytes, frame.width, frame.height, scale))
  console.log(file)
}

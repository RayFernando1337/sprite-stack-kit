// Scripted pilots: whole fights with no browser, to see whether the fight is fair.
// Run with `bun examples/worldfight/playtest.js`. A careful pilot should win hurt,
// a careless one should often lose, and a ship left alone should always lose.

import { createGame } from './src/game.js'

const RUNS = 12
const wrap = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2))
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const world = createGame({ seed: 7 }).world

// kind: 'careful' chases, shoots and rolls on a warning; 'careless' never rolls; 'idle' touches nothing
function fight(kind, run) {
  const game = createGame({ seed: 7, world, level: 2, view: 'top' })
  game.resize(384, 240)
  const f = game.fight
  const dt = 1 / 60
  // each run reacts, aims and turns a little differently, so twelve runs are twelve pilots
  const react = 0.2 + (run % 3) * 0.08
  const aim = 0.1 + (run % 4) * 0.04
  const gain = 1.3 + (run % 5) * 0.4
  let t = 0
  while (t < 300 && f.outcome === 'playing') {
    const c = game.craft
    if (kind !== 'idle') {
      let best = null
      let bestFar = 1e9
      for (const p of f.pilots) {
        if (p.state !== 1) continue
        const far = Math.hypot(p.x - c.x, p.y - c.y) * (p.attacking ? 0.7 : 1)
        if (far < bestFar) {
          bestFar = far
          best = p
        }
      }
      const home = wrap(Math.atan2(512 - c.x, -(512 - c.y)) - c.yaw)
      if (best) {
        const far = Math.hypot(best.x - c.x, best.y - c.y)
        const lead = far / 430
        const off = wrap(Math.atan2(best.x + best.vx * lead - c.x, -(best.y + best.vy * lead - c.y)) - c.yaw)
        const edge = Math.min(c.x, c.y, 1024 - c.x, 1024 - c.y)
        const turn = edge < 110 ? clamp(home * 2, -1, 1) : clamp(off * gain, -1, 1)
        game.setKeys(turn || 0.001, clamp((best.z - c.z) / 15, -1, 1), far > 260)
        game.setTrigger(Math.abs(off) < aim + 0.1 && far < 340)
        if (f.locked || f.counterFor > 0) game.missile()
      } else game.setKeys(clamp(home * 2, -1, 1) || 0.2, 0, false)
      if (kind === 'careful' && game.threat < react && c.spin < 0) game.roll()
    }
    game.update(dt)
    t += dt
  }
  return { outcome: f.outcome, seconds: Math.round(t), hull: f.hull, score: f.score, downed: f.downed, evades: f.evades }
}

for (const kind of ['careful', 'careless', 'idle']) {
  const runs = []
  for (let run = 0; run < RUNS; run++) runs.push(fight(kind, run))
  const count = (outcome) => runs.filter((r) => r.outcome === outcome).length
  const mean = (key) => (runs.reduce((sum, r) => sum + r[key], 0) / RUNS).toFixed(1)
  console.log(`${kind}: ${count('won')} won, ${count('lost')} lost of ${RUNS} · ${mean('seconds')} s · hull left ${mean('hull')} · downed ${mean('downed')} · missiles dodged ${mean('evades')}`)
}

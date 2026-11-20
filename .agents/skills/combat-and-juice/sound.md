# Sound made in code

Dash's game plays recordings. This kit allows no sound files, so every sound here is made with Web Audio by the page. What is his: the shape of the mix, and what the game tells the sound. The recipes are this kit's own. They were written without being heard, so tune them by ear in a browser.

## The split

- `sound.js` sits beside `main.js`. It reads the game. The game never calls it, and runs the same with no sound at all.
- The game exposes **levels**, read every frame, on one object that it reuses: `boost`, `speed` (as a share of cruise), `cockpit` (0 to 1), `gun` (1 while the player's cannon fires, less for an enemy's, by distance), `spray`, `cloud`, `slow`, `lock` (0 to 1), `threat` (0 for none, rising toward 1 as a missile closes, 1 in the dodge window).
- The game exposes **counts** that only go up: `rounds`, `hits`, `kills`, `launches`, `blasts`, `struck`, `evades`, `counters`. Each frame the page compares each with the value it saw last and plays a sound for the difference.
- His game hands the page a list of event names instead. A list would allocate in the frame loop, which this kit forbids.
- `bun run check` fails on `Math.random(` in any file under `src/`. Fill the noise buffer with `makeRng` from `rng.js`.
- Browsers allow sound only after a click or a key. Create the `AudioContext` inside the first input event, and `resume()` it if it is suspended.

## The mix (his design)

```
voices → out (gain) → deep (low-pass) → limit (compressor) → speakers
        the slow-motion whoosh ───────────↑  (skips the low-pass)
```

- **Beds** never stop: engine, afterburner, wind, gun, water. Each is a looping source with a gain. Every frame, glide each gain toward a value worked out from the levels, with `setTargetAtTime`. About 0.1 seconds for most. 0.01 for the gun, which must start and stop with the trigger.
- **One-shots** are made when a count goes up, play once and are dropped.
- **The gun is the loudest thing.** While the player fires, every other bed drops to half.
- **The gun's tail.** When the trigger is let go after more than 0.2 seconds, play a short decaying echo. It makes a burst sound finished.
- **Slow motion.** The `deep` filter's cutoff follows `slow`, from 20 kHz down to about 400 Hz. Everything sinks to a murmur and rises again. The whoosh that announces it goes round the filter.
- **The cockpit.** A second low-pass on the engine and wind beds only, down to about 900 Hz as `cockpit` reaches 1.
- **The limiter.** A `DynamicsCompressorNode` with a high threshold and a slow release, so it catches only a crash over a roaring engine.
- **One tone for the sights.** A single square oscillator through a low-pass, switched on and off in pips. Locking: pips at about 1 kHz, from 4 to 10 a second as `lock` fills. Locked: higher, about 1.5 kHz, a steady warble. A missile on its way takes the tone over: low pips at about 650 Hz that quicken with `threat`, then a rapid high one near 2 kHz in the dodge window. The player learns to dodge by ear.

## Starting it

```js
import { makeRng } from './rng.js'

export function createSound(game) {
  let ctx = null
  let out = null
  let deep = null
  let noise = null

  function start() {
    ctx = new AudioContext()
    const limit = ctx.createDynamicsCompressor()
    limit.threshold.value = -6
    limit.release.value = 0.4
    deep = ctx.createBiquadFilter()
    deep.type = 'lowpass'
    deep.frequency.value = 20000
    out = ctx.createGain()
    out.gain.value = 0.6
    out.connect(deep).connect(limit).connect(ctx.destination)
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = noise.getChannelData(0)
    const rng = makeRng(1)
    for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1
  }

  /** Filtered noise that dies away: the body of every bang, hiss and splash. */
  function burst(seconds, from, to, level, type = 'lowpass') {
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = noise
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(from, t)
    filter.frequency.exponentialRampToValueAtTime(to, t + seconds)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(level, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
    src.connect(filter).connect(gain).connect(out)
    src.start(t, (t * 7) % 1.5) // a different part of the noise each time
    src.stop(t + seconds)
  }

  /** A pitched note that slides and dies away. */
  function note(seconds, from, to, level, shape = 'sine') {
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = shape
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(to, t + seconds)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(level, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + seconds)
  }

  return {
    /** Call from the first click, touch or key. */
    unlock() {
      if (!ctx) start()
      else if (ctx.state === 'suspended') ctx.resume()
    },
    /** Call once a frame, after game.update(). */
    update() {
      if (!ctx) return
      // compare game's counts with the last ones seen, and play; then set the beds from its levels
    },
  }
}
```

The page may create these small objects as it goes. The rule against creating things is for the game's frame loop. Still, play at most one of each kind of one-shot per frame.

## Recipes

| Sound | Make it from |
| --- | --- |
| Engine | Two sawtooth oscillators a fraction of a hertz apart, near 55 Hz, through a low-pass at 300 to 900 Hz. Speed raises the pitch a little and opens the filter |
| Afterburner | Looping noise through a band-pass near 250 Hz. Gain follows `boost`, a little faster than linear |
| Wind | Looping noise through a band-pass near 700 Hz. Gain follows speed, and jumps inside a cloud |
| Gun bed | Looping noise through a band-pass near 1.5 kHz, with its gain chopped by a square oscillator at the rate of fire. Add a 90 Hz square under it for weight |
| Gun tail | `burst(0.5, 1800, 300, 0.5)` |
| Round hits an enemy | `note(0.05, 1400, 900, 0.08, 'square')`. At most one every 0.05 seconds |
| The player is hit | `note(0.09, 190, 120, 0.4, 'square')` and `burst(0.08, 4000, 1500, 0.4, 'highpass')` |
| Explosion | `burst(1.0, 1400, 70, 0.9)` and `note(0.35, 95, 35, 0.8)`. Scale the length by the blast's size |
| Splash | `burst(0.8, 3500, 900, 0.5, 'bandpass')` |
| Missile motor | `burst(0.9, 500, 2600, 0.45, 'bandpass')`: it rises as it leaves |
| Missile release | `note(0.06, 140, 70, 0.3, 'square')` |
| Roll | `burst(0.5, 500, 1800, 0.2, 'bandpass')` |
| Dodge whoosh | A sine falling from 320 to 60 Hz over a second, joined after `deep` so the low-pass does not swallow it |
| Empty trigger | `note(0.03, 900, 700, 0.15, 'square')` |
| Step done (tutorial) | Two triangle notes, the second a fifth higher and 0.09 seconds later. Three for the whole tutorial |

## Check it

- `bun run check` still passes with `sound.js` present. It reads the file but cannot hear it.
- In a browser: no sound before the first click, no errors in the console, and nothing clips when a kill lands while the gun is firing.
- Say in your report that the sound was not heard by a person, if it was not.

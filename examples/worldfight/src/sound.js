// Sound, made in code with Web Audio: there are no sound files. The game never plays
// anything. It counts what happens (game.heard) and exposes a few plain numbers, and this
// file turns the changes in those into sound, once per frame. Browsers allow sound only
// after the player has clicked or pressed a key, so nothing exists before start() is called.

const ONE_SHOTS = ['shot', 'foeShot', 'hit', 'hurt', 'blast', 'splash', 'launch', 'inbound', 'lock', 'evade', 'down', 'wave', 'clear', 'win', 'lose', 'morph', 'roll', 'empty', 'reload', 'restart']

export function createSound() {
  let ctx = null
  let out = null // everything goes through this: it is muffled while time is slowed
  let muffle = null
  let noise = null
  let engine = null
  let engineTone = null
  let engineGain = null
  let wind = null
  let windGain = null
  let alarmIn = 0
  let muted = false
  const seen = {}
  for (const name of ONE_SHOTS) seen[name] = 0

  /** A tone that slides from one pitch to another and dies away. */
  function tone(type, from, to, seconds, loud, delay = 0) {
    const at = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, at)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + seconds)
    gain.gain.setValueAtTime(loud, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
    osc.connect(gain).connect(out)
    osc.start(at)
    osc.stop(at + seconds + 0.02)
  }

  /** A burst of noise through a filter that slides, dying away. */
  function hiss(kind, from, to, seconds, loud, delay = 0) {
    const at = ctx.currentTime + delay
    const source = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    source.buffer = noise
    source.loop = true
    filter.type = kind
    filter.frequency.setValueAtTime(from, at)
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, to), at + seconds)
    gain.gain.setValueAtTime(loud, at)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
    source.connect(filter).connect(gain).connect(out)
    source.start(at, (at * 0.37) % 1.5)
    source.stop(at + seconds + 0.02)
  }

  const play = {
    shot() {
      hiss('highpass', 2400, 900, 0.06, 0.11)
      tone('square', 210, 70, 0.07, 0.07)
    },
    foeShot() {
      tone('sawtooth', 520, 180, 0.08, 0.035)
    },
    hit() {
      tone('triangle', 1250, 420, 0.07, 0.12)
    },
    hurt() {
      tone('sine', 150, 42, 0.3, 0.5)
      hiss('lowpass', 1800, 200, 0.25, 0.3)
    },
    blast() {
      hiss('lowpass', 1500, 60, 0.9, 0.55)
      tone('sine', 110, 28, 0.6, 0.55)
    },
    splash() {
      hiss('bandpass', 900, 2600, 0.7, 0.3)
      tone('sine', 90, 34, 0.4, 0.3)
    },
    launch() {
      hiss('bandpass', 500, 3200, 0.55, 0.26)
      tone('sawtooth', 120, 300, 0.4, 0.05)
    },
    inbound() {
      tone('square', 980, 980, 0.09, 0.08)
      tone('square', 740, 740, 0.09, 0.08, 0.11)
    },
    lock() {
      tone('square', 1320, 1320, 0.06, 0.07)
      tone('square', 1760, 1760, 0.1, 0.07, 0.08)
    },
    evade() {
      hiss('bandpass', 3200, 300, 0.7, 0.3)
      tone('sine', 420, 60, 0.9, 0.3)
    },
    down() {
      tone('triangle', 660, 990, 0.12, 0.12, 0.05)
    },
    wave() {
      tone('triangle', 392, 392, 0.14, 0.12)
      tone('triangle', 523, 523, 0.22, 0.12, 0.15)
    },
    clear() {
      for (let n = 0; n < 3; n++) tone('triangle', [523, 659, 784][n], [523, 659, 784][n], 0.16, 0.12, n * 0.1)
    },
    win() {
      for (let n = 0; n < 5; n++) tone('triangle', [523, 659, 784, 1047, 1319][n], [523, 659, 784, 1047, 1319][n], 0.3, 0.14, n * 0.13)
    },
    lose() {
      for (let n = 0; n < 4; n++) tone('sawtooth', [392, 330, 262, 196][n], [370, 311, 247, 98][n], 0.34, 0.09, n * 0.22)
    },
    morph() {
      for (let n = 0; n < 6; n++) tone('square', 220 * 2 ** (n / 3), 220 * 2 ** ((n + 1) / 3), 0.12, 0.05, n * 0.09)
      hiss('bandpass', 400, 4000, 0.8, 0.12)
    },
    roll() {
      hiss('bandpass', 700, 2200, 0.35, 0.12)
    },
    empty() {
      tone('square', 160, 150, 0.05, 0.06)
    },
    reload() {
      tone('triangle', 880, 1100, 0.07, 0.05)
    },
    restart() {
      tone('triangle', 330, 660, 0.25, 0.1)
    },
  }

  return {
    /** Call from the first click or key press. Safe to call again. */
    start() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume()
        return
      }
      const Audio = window.AudioContext ?? window.webkitAudioContext
      if (!Audio) return
      ctx = new Audio()
      const squash = ctx.createDynamicsCompressor()
      muffle = ctx.createBiquadFilter()
      muffle.type = 'lowpass'
      muffle.frequency.value = 18000
      out = ctx.createGain()
      out.gain.value = 0.5
      out.connect(muffle).connect(squash).connect(ctx.destination)

      // a second and a half of noise, from a small generator of its own so nothing here is left to chance
      noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 1.5), ctx.sampleRate)
      const data = noise.getChannelData(0)
      let state = 12345
      for (let i = 0; i < data.length; i++) {
        state = (Math.imul(state, 1664525) + 1013904223) | 0
        data[i] = (state >>> 8) / 8388608 - 1
      }

      // the engine: two saws a little apart, through a filter that opens with the thrusters
      engineTone = ctx.createBiquadFilter()
      engineTone.type = 'lowpass'
      engineGain = ctx.createGain()
      engineGain.gain.value = 0
      engine = [ctx.createOscillator(), ctx.createOscillator()]
      for (const osc of engine) {
        osc.type = 'sawtooth'
        osc.connect(engineTone)
        osc.start()
      }
      engineTone.connect(engineGain).connect(out)
      // the wind: noise through a band that climbs with speed
      const air = ctx.createBufferSource()
      air.buffer = noise
      air.loop = true
      wind = ctx.createBiquadFilter()
      wind.type = 'bandpass'
      wind.Q.value = 0.7
      windGain = ctx.createGain()
      windGain.gain.value = 0
      air.connect(wind).connect(windGain).connect(out)
      air.start()
    },

    /** M turns the sound off and on. Says whether it is now on. */
    toggle() {
      muted = !muted
      if (out) out.gain.value = muted ? 0 : 0.5
      return !muted
    },

    /** Once per frame: plays whatever the game has counted since the last one. */
    update(game, seconds) {
      const heard = game.heard
      if (!ctx || ctx.state !== 'running') {
        // nothing can be heard yet: do not save it all up for the first click
        for (const name of ONE_SHOTS) seen[name] = heard[name]
        return
      }
      for (const name of ONE_SHOTS) {
        const fresh = heard[name] - seen[name]
        seen[name] = heard[name]
        if (fresh > 0 && !muted) play[name]()
      }
      const now = ctx.currentTime
      const boost = game.boost
      const plane = game.form === 'plane'
      const pitch = (plane ? 62 : 48) + boost * 46 - game.slow * 20
      engine[0].frequency.setTargetAtTime(pitch, now, 0.08)
      engine[1].frequency.setTargetAtTime(pitch * 1.51, now, 0.08)
      engineTone.frequency.setTargetAtTime(260 + boost * 1500, now, 0.1)
      engineGain.gain.setTargetAtTime(0.045 + boost * 0.075, now, 0.1)
      wind.frequency.setTargetAtTime(500 + boost * 1700, now, 0.15)
      windGain.gain.setTargetAtTime(0.03 + boost * 0.12, now, 0.15)
      // while time is slowed, everything is heard as if through a wall
      muffle.frequency.setTargetAtTime(18000 - game.slow * 17300, now, 0.05)
      // a missile on its way: a beep that quickens as it closes
      const threat = game.threat
      if (threat < 90) {
        alarmIn -= seconds
        if (alarmIn <= 0) {
          alarmIn = Math.max(0.07, Math.min(0.45, threat * 0.22))
          if (!muted) tone('square', threat < 0.6 ? 1568 : 1175, threat < 0.6 ? 1568 : 1175, 0.045, 0.09)
        }
      } else alarmIn = 0
    },
  }
}

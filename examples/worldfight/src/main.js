// The page: fits the canvas, passes input to the game, shows each frame, and plays the sound.

import { createGame } from './game.js'
import { createSound } from './sound.js'

// ?seed=3 moves the fine detail, ?view=chase starts from behind, ?level=2 starts in the city
const query = new URLSearchParams(location.search)
const touch = matchMedia('(pointer: coarse)').matches
const game = createGame({
  seed: Number(query.get('seed')) || 7,
  view: query.get('view') ?? 'top',
  level: Number(query.get('level')) || 0,
  // on a touch screen a missile leaves by itself once it has a lock, so one finger can play
  assist: touch || query.has('assist'),
})
const sound = createSound()
const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const hint = document.getElementById('hint')
const downButton = document.getElementById('down')
const upButton = document.getElementById('up')
const missileButton = document.getElementById('missile')
const boostButton = document.getElementById('boost')

const STEER = touch ? 'DRAG TO STEER · HOLD FOR THRUSTERS · TAP TO ROLL' : 'POINT OR A/D TO STEER · W/S TO CLIMB · HOLD OR SHIFT FOR THRUSTERS · CLICK OR R TO ROLL · SPACE FOR VIEW'
const HINTS = [
  `${STEER} · FLY TO THE USA BEAM, THEN ${touch ? 'DOWN' : 'ENTER'}`,
  `${STEER} · FLY TO THE SF BEAM, THEN ${touch ? 'DOWN' : 'ENTER'} · ${touch ? 'UP' : 'BACKSPACE'} FOR THE EARTH`,
  touch
    ? 'DRAG TO STEER · HOLD TO FIRE · TAP TO ROLL OUT OF A MISSILE\'S WAY · MISSILES FIRE WHEN LOCKED · UP TO LEAVE'
    : 'POINT OR A/D TO STEER · HOLD OR F: CANNON · E OR RIGHT CLICK: MISSILE ONCE LOCKED · CLICK OR R: ROLL OUT OF A MISSILE\'S WAY · SHIFT: THRUSTERS · SPACE: VIEW · M: SOUND · BACKSPACE: LEAVE',
]

let pixel = 3 // screen pixels per game pixel
let image = null
let shown = ''
let boostHeld = false

function fit() {
  // A whole number of screen pixels per game pixel, chosen so the picture is about 400 wide.
  pixel = Math.max(2, Math.min(8, Math.round(Math.min(innerWidth / 400, innerHeight / 250))))
  const width = Math.ceil(innerWidth / pixel)
  const height = Math.ceil(innerHeight / pixel)
  canvas.width = width
  canvas.height = height
  canvas.style.width = width * pixel + 'px'
  canvas.style.height = height * pixel + 'px'
  game.resize(width, height)
  // The ImageData wraps the game's own memory, so showing a frame copies nothing extra.
  image = new ImageData(game.frame.bytes, game.frame.width, game.frame.height)
}

let last = 0
function tick(now) {
  const dt = last ? (now - last) / 1000 : 0
  last = now
  game.update(dt)
  game.render()
  ctx.putImageData(image, 0, 0)
  sound.update(game, dt)
  // the page only changes when what it shows does
  const now_ = `${game.level}${game.canDescend ? 'd' : ''}${game.shift}${game.view}`
  if (now_ !== shown) {
    shown = now_
    const city = game.level === 2
    hint.textContent = HINTS[game.level]
    hint.hidden = game.view === 'cockpit' // the bottom of the screen is the dashboard there
    downButton.disabled = !game.canDescend
    upButton.disabled = game.level === 0 || game.shift !== 'none'
    downButton.hidden = city
    missileButton.hidden = !city
    boostButton.hidden = !city || !touch // away from the city a hold is the thrusters, and a keyboard has Shift
  }
  requestAnimationFrame(tick)
}

// ── pointer: mouse, pen and touch all arrive as pointer events
canvas.addEventListener('pointermove', (e) => game.pointerMove(e.clientX / pixel, e.clientY / pixel))
canvas.addEventListener('pointerdown', (e) => {
  sound.start()
  if (e.button === 2) game.missile()
  if (e.button !== 0) return
  canvas.setPointerCapture(e.pointerId)
  game.pointerMove(e.clientX / pixel, e.clientY / pixel)
  game.press()
})
canvas.addEventListener('pointerup', (e) => {
  if (e.button === 0) game.release()
})
canvas.addEventListener('pointercancel', () => game.pointerLeave())
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') game.pointerLeave()
})
canvas.addEventListener('contextmenu', (e) => e.preventDefault())
const button = (id, act) => {
  document.getElementById(id).addEventListener('click', () => {
    sound.start()
    act()
  })
}
button('view', () => game.nextView())
button('down', () => game.descend())
button('up', () => game.ascend())
button('missile', () => game.missile())
// BOOST is held, not clicked
boostButton.addEventListener('pointerdown', (e) => {
  sound.start()
  boostButton.setPointerCapture(e.pointerId)
  boostHeld = true
  sendKeys()
})
for (const end of ['pointerup', 'pointercancel']) {
  boostButton.addEventListener(end, () => {
    boostHeld = false
    sendKeys()
  })
}

// ── keys
const held = new Set()
const down = (...codes) => codes.some((code) => held.has(code))
function sendKeys() {
  game.setKeys(
    (down('ArrowRight', 'KeyD') ? 1 : 0) - (down('ArrowLeft', 'KeyA') ? 1 : 0),
    (down('ArrowUp', 'KeyW') ? 1 : 0) - (down('ArrowDown', 'KeyS') ? 1 : 0),
    boostHeld || down('ShiftLeft', 'ShiftRight'),
  )
  game.setTrigger(down('KeyF'))
}
const ONCE = {
  Space: () => game.nextView(),
  Enter: () => game.descend(),
  Backspace: () => game.ascend(),
  KeyR: () => game.roll(),
  KeyQ: () => game.roll(),
  KeyE: () => game.missile(),
  KeyM: () => sound.toggle(),
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  sound.start()
  if (ONCE[e.code]) {
    e.preventDefault()
    if (!e.repeat) ONCE[e.code]()
  } else {
    if (e.code.startsWith('Arrow')) e.preventDefault()
    held.add(e.code)
    sendKeys()
  }
})
addEventListener('keyup', (e) => {
  held.delete(e.code)
  sendKeys()
})
addEventListener('blur', () => {
  held.clear()
  boostHeld = false
  sendKeys()
  game.pointerLeave()
})
addEventListener('resize', fit)

fit()
requestAnimationFrame(tick)

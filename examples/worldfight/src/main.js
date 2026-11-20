// The page: fits the canvas, passes input to the game, and shows each frame.

import { createGame } from './game.js'

// ?seed=3 moves the fine detail, ?view=chase starts from behind, ?level=2 starts in the city
const query = new URLSearchParams(location.search)
const game = createGame({
  seed: Number(query.get('seed')) || 7,
  view: query.get('view') ?? 'top',
  level: Number(query.get('level')) || 0,
})
const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const hint = document.getElementById('hint')
const downButton = document.getElementById('down')
const upButton = document.getElementById('up')

const touch = matchMedia('(pointer: coarse)').matches
const STEER = touch ? 'DRAG TO STEER · HOLD FOR THRUSTERS' : 'POINT OR A/D TO STEER · W/S TO CLIMB · HOLD OR SHIFT FOR THRUSTERS · SPACE FOR VIEW'
const HINTS = [
  `${STEER} · FLY TO THE USA BEAM, THEN ${touch ? 'DOWN' : 'ENTER'}`,
  `${STEER} · FLY TO THE SF BEAM, THEN ${touch ? 'DOWN' : 'ENTER'} · ${touch ? 'UP' : 'BACKSPACE'} FOR THE EARTH`,
  `${STEER} · ${touch ? 'TAP' : 'CLICK OR F'} TO FIRE · ${touch ? 'UP' : 'BACKSPACE'} TO LEAVE`,
]

let pixel = 3 // screen pixels per game pixel
let image = null
let shown = ''

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
  // the page only changes when what it shows does
  const now_ = `${game.level}${game.canDescend ? 'd' : ''}${game.shift}`
  if (now_ !== shown) {
    shown = now_
    hint.textContent = HINTS[game.level]
    downButton.disabled = !game.canDescend
    upButton.disabled = game.level === 0 || game.shift !== 'none'
  }
  requestAnimationFrame(tick)
}

// ── pointer: mouse, pen and touch all arrive as pointer events
canvas.addEventListener('pointermove', (e) => game.pointerMove(e.clientX / pixel, e.clientY / pixel))
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return
  canvas.setPointerCapture(e.pointerId)
  game.pointerMove(e.clientX / pixel, e.clientY / pixel)
  game.press()
})
canvas.addEventListener('pointerup', () => game.release())
canvas.addEventListener('pointercancel', () => game.pointerLeave())
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') game.pointerLeave()
})
canvas.addEventListener('contextmenu', (e) => e.preventDefault())
document.getElementById('view').addEventListener('click', () => game.nextView())
downButton.addEventListener('click', () => game.descend())
upButton.addEventListener('click', () => game.ascend())

// ── keys
const held = new Set()
const down = (...codes) => codes.some((code) => held.has(code))
function sendKeys() {
  game.setKeys(
    (down('ArrowRight', 'KeyD') ? 1 : 0) - (down('ArrowLeft', 'KeyA') ? 1 : 0),
    (down('ArrowUp', 'KeyW') ? 1 : 0) - (down('ArrowDown', 'KeyS') ? 1 : 0),
    down('ShiftLeft', 'ShiftRight'),
  )
}
const ONCE = {
  Space: () => game.nextView(),
  Enter: () => game.descend(),
  Backspace: () => game.ascend(),
  KeyR: () => game.roll(),
  KeyF: () => game.fire(),
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
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
  sendKeys()
  game.pointerLeave()
})
addEventListener('resize', fit)

fit()
requestAnimationFrame(tick)

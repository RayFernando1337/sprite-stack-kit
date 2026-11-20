// Small tools for drawing marks into a picture: dots, boxes, lines, and a 3 × 5 pixel font.
// The game's score, labels and radar are made of them.
//
// `to` is anything with { width, height, color }: the framebuffer, or a layer painted once and
// copied in every frame. Everything is clipped, so a mark may run off the edge.

export function dot(to, x, y, col) {
  if (x >= 0 && y >= 0 && x < to.width && y < to.height) to.color[y * to.width + x] = col
}

export function box(to, x, y, w, h, col) {
  const x0 = x < 0 ? 0 : x
  const y0 = y < 0 ? 0 : y
  const x1 = x + w > to.width ? to.width : x + w
  const y1 = y + h > to.height ? to.height : y + h
  for (let row = y0; row < y1; row++) to.color.fill(col, row * to.width + x0, row * to.width + (x1 > x0 ? x1 : x0))
}

export function line(to, x0, y0, x1, y1, col) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
  for (let i = 0; i <= steps; i++) {
    dot(to, Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), col)
  }
}

/** A filled circle. `col` may be a function (dx, dy) → colour, for shading. */
export function disc(to, cx, cy, radius, col) {
  const shade = typeof col === 'function'
  for (let dy = -Math.ceil(radius); dy <= radius; dy++) {
    for (let dx = -Math.ceil(radius); dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) dot(to, cx + dx, cy + dy, shade ? col(dx, dy) : col)
    }
  }
}

// Fifteen bits per glyph: three across, five down, top row first.
const GLYPHS = new Uint16Array(128)
const SHAPES = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '111101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', ':': '000010000010000', '-': '000000111000000', '!': '010010010000010', '.': '000000000000010',
}
for (const char in SHAPES) GLYPHS[char.charCodeAt(0)] = parseInt(SHAPES[char], 2)

/** How wide `count` characters are at this size, without the gap after the last one. */
export const textWidth = (count, size = 1) => (count * 4 - 1) * size

function glyph(to, x, y, code, col, size) {
  const bits = GLYPHS[code]
  for (let n = 0; n < 15; n++) {
    if ((bits >> (14 - n)) & 1) box(to, x + (n % 3) * size, y + ((n / 3) | 0) * size, size, size, col)
  }
}

/** Draws a word in capitals. A character with no shape in SHAPES is left blank. */
export function text(to, x, y, word, col, size = 1) {
  for (let i = 0; i < word.length; i++) glyph(to, x + i * 4 * size, y, word.charCodeAt(i), col, size)
}

/** Draws a whole number with leading zeros. It builds no string, so it is safe every frame. */
export function number(to, x, y, value, digits, col, size = 1) {
  let rest = Math.max(0, Math.round(value))
  for (let i = digits - 1; i >= 0; i--) {
    glyph(to, x + i * 4 * size, y, 48 + (rest % 10), col, size)
    rest = (rest / 10) | 0
  }
}

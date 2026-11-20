// San Francisco's streets, buildings and landmarks, laid over the real ground. The ground
// comes from real elevation data. The buildings do not come from data: blocks are placed by
// rule where the city really is, and a handful of landmarks stand at their real positions.

import { hash2 } from './rng.js'
import { placeX, placeY, lonAt, latAt } from './atlas.js'
import { MAT, WORLD_SIZE, WORLD_SHIFT, GROUND_MAX } from './world.js'

// Where there are buildings: [west, south, east, north, the highest ground they climb, in metres]
const BUILT = [
  [-122.517, 37.708, -122.355, 37.812, 190], // San Francisco
  [-122.5, 37.6, -122.38, 37.708, 110], // Daly City and South San Francisco
  [-122.335, 37.7, -122.14, 37.93, 60], // Oakland and Berkeley, on the flat by the bay
  [-122.335, 37.765, -122.225, 37.8, 30], // Alameda
]
// Parks stay green: [west, south, east, north]
const PARKS = [
  [-122.511, 37.7645, -122.453, 37.7745], // Golden Gate Park
  [-122.487, 37.787, -122.447, 37.807], // the Presidio
  [-122.444, 37.728, -122.428, 37.7345], // Glen Park canyon
]
// Where the towers are: [longitude, latitude, how far they spread in degrees, the tallest, in layers]
const DOWNTOWNS = [[-122.3995, 37.7915, 0.011, 15], [-122.4155, 37.7805, 0.007, 6], [-122.2715, 37.8045, 0.006, 9]]

const within = (boxes, lon, lat) => boxes.find((b) => lon > b[0] && lon < b[2] && lat > b[1] && lat < b[3])

export function buildCity(map, heights, materials, lift) {
  const top = (v) => Math.min(GROUND_MAX, v)
  const metresAt = (o) => Math.max(0, (lift[o] - 0.5) / 14.5) ** 2 * map.top

  // ── streets and blocks. A block is 3 pixels of building with a 1 pixel street round it:
  // about 120 metres, close to a real block here.
  for (let y = 0; y < WORLD_SIZE; y++) {
    const lat = latAt(map, y)
    for (let x = 0; x < WORLD_SIZE; x++) {
      const o = (y << WORLD_SHIFT) | x
      if (materials[o] < MAT.SAND) continue
      const lon = lonAt(map, x)
      const area = within(BUILT, lon, lat)
      if (!area || metresAt(o) > area[4]) continue
      if (within(PARKS, lon, lat)) {
        if (hash2(x, y) < 70) {
          materials[o] = MAT.TREE
          heights[o] = top(heights[o] + 1)
        }
        continue
      }
      if ((x & 3) === 0 || (y & 3) === 0) {
        materials[o] = MAT.STREET
        continue
      }
      const block = hash2(x >> 2, y >> 2)
      let tall = 1 + (block & 1)
      for (const d of DOWNTOWNS) {
        const near = Math.exp(-(((lon - d[0]) / d[2]) ** 2 + ((lat - d[1]) / (d[2] * 0.8)) ** 2))
        // not every downtown block is a tower: the hash picks which, and how tall
        if (near > 0.08) tall = Math.max(tall, Math.round(2 + near * d[3] * (0.35 + (0.65 * block) / 255)))
      }
      heights[o] = top(heights[o] + tall)
      materials[o] = tall >= 6 ? (block & 2 ? MAT.TOWER : MAT.TOWER_DARK) : block < 90 ? MAT.BLOCK_WARM : block < 150 ? MAT.BLOCK_COOL : MAT.BLOCK
    }
  }

  // ── landmarks, at their real longitude and latitude
  const stamp = (lon, lat, half, tall, mat, { onGround = true } = {}) => {
    const cx = Math.floor(placeX(map, lon))
    const cy = Math.floor(placeY(map, lat))
    const base = onGround ? heights[(cy << WORLD_SHIFT) | cx] : 0
    for (let y = cy - half; y <= cy + half; y++) {
      for (let x = cx - half; x <= cx + half; x++) {
        const o = (y << WORLD_SHIFT) | x
        heights[o] = top(Math.max(heights[o], base + tall))
        materials[o] = mat
      }
    }
  }
  // A bridge is a low line across the water with tall towers on it. The ground has one
  // height per pixel, so there is no flying under it.
  const bridge = (from, to, deck, towers, towerMat, tall) => {
    const ax = placeX(map, from[0])
    const ay = placeY(map, from[1])
    const bx = placeX(map, to[0])
    const by = placeY(map, to[1])
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay))
    for (let s = 0; s <= steps; s++) {
      const o = (Math.round(ay + ((by - ay) * s) / steps) << WORLD_SHIFT) | Math.round(ax + ((bx - ax) * s) / steps)
      if (materials[o] >= MAT.SAND && materials[o] !== MAT.STREET) continue // only over water, and over its own road
      heights[o] = Math.max(heights[o], 3)
      materials[o] = deck
    }
    for (const tower of towers) stamp(tower[0], tower[1], 0, tall, towerMat, { onGround: false })
  }

  bridge([-122.4772, 37.8083], [-122.4802, 37.8325], MAT.STEEL, [[-122.4778, 37.8136], [-122.4795, 37.8249]], MAT.STEEL, 22)
  bridge([-122.3884, 37.7876], [-122.3668, 37.8092], MAT.STREET, [[-122.3832, 37.7928], [-122.3777, 37.7983], [-122.3722, 37.8038]], MAT.BLOCK_COOL, 16)
  bridge([-122.3585, 37.8145], [-122.3208, 37.8224], MAT.STREET, [[-122.3535, 37.8155]], MAT.BLOCK, 16)

  stamp(-122.3972, 37.7897, 1, 24, MAT.TOWER) // Salesforce Tower
  for (let n = 0; n < 3; n++) stamp(-122.4028, 37.7952, 2 - n, 6 + n * 6, MAT.BLOCK) // the Transamerica Pyramid, in three steps
  stamp(-122.4058, 37.8024, 0, 7, MAT.BLOCK) // Coit Tower
  stamp(-122.4528, 37.7552, 0, 18, MAT.STEEL) // Sutro Tower
}

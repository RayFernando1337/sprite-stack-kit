// The places `bun run maps --game examples/worldfight` makes a map of. See scripts/maps.mjs.
// To add a place, add a line here, run the tool, and add a level in src/levels.js.

export const maps = [
  { name: 'earth', zoom: 2, lon: 0, lat: 0, tiles: 4, size: 256, top: 6000, lines: ['ne_110m_admin_0_boundary_lines_land'], lineSize: 512 },
  {
    name: 'usa', zoom: 5, lon: -95.5, lat: 38.5, tiles: 5.42, size: 256, top: 4000,
    lines: ['ne_50m_admin_1_states_provinces_lines', 'ne_50m_admin_0_boundary_lines_land'], lineSize: 512,
  },
  { name: 'sf', zoom: 12, lon: -122.44, lat: 37.79, tiles: 4, size: 320, top: 400 },
]

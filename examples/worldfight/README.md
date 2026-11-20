# Worldfight

Fly a rocket ship over the whole Earth, drop down to the United States and then to San Francisco, and dogfight computer pilots over the city. Built with sprite-stack-kit by following its `new-game` playbook.

```sh
bun scripts/serve.mjs examples/worldfight
```

Add `?level=2` to the address to start in the city, and `?view=chase` to start from behind.

| Do | Mouse or touch | Keys |
| --- | --- | --- |
| Steer | Point | A / D or arrows; W / S to climb and dive |
| Thrusters | Hold | Shift |
| Fire (in the city), roll (elsewhere) | Click | F fires, R rolls |
| Change view | VIEW | Space |
| Go down a level, over a beam of light | DOWN | Enter |
| Go up a level | UP | Backspace |

Flying out of the side of a country or a city also takes you up a level.

## How the real maps get in

The game uses no network and no data files. `bun run maps --game examples/worldfight` is run once, by whoever changes the maps:

1. It reads the places in `maps.js`: the whole Earth, the lower 48 states, San Francisco.
2. It downloads open elevation tiles and border lines for each, and shrinks each place to a grid of 256 or 320 cells a side. A cell holds one number: 0 for water, or 1 to 15 for how high the land is.
3. It packs each grid as text and writes `src/map-<name>.js`. The three come to 75 KB.

When the game starts, `src/world.js` unpacks each grid, smooths between its cells, and adds fine detail from seeded noise. So the coasts and mountains are real, and the last few pixels of detail are made up. The same seed always gives the same maps.

Not from data: the deserts and plains (ovals drawn by hand in `world.js`) and San Francisco's buildings (`src/city.js`). Blocks are placed by rule where the city is. The bridges, Salesforce Tower, the Transamerica Pyramid, Coit Tower and Sutro Tower stand at their real positions.

To add a place, add a line to `maps.js`, run the tool, and add a level to `LEVELS` in `src/world.js`.

## Files

| File | Holds |
| --- | --- |
| `GAME.md` | The brief: what the game is, what must always be true, what is left for later |
| `maps.js` | The places the maps tool makes maps of |
| `states.js` | The state map: 18 rules, checked in every state by `bun run states --game examples/worldfight` |
| `src/atlas.js` | Unpacks a map; turns longitude and latitude into map pixels |
| `src/world.js` | Rebuilds the three maps; the materials and their colours |
| `src/city.js` | San Francisco's streets, blocks and landmarks |
| `src/game.js` | Flight, the levels, the camera, the draw order |
| `src/dogfight.js` | The computer pilots, shots, hull, score, who won |
| `src/hud.js` | What is written over the picture |

## Credit

Elevation: Mapzen terrain tiles, hosted by AWS Open Data. Borders: Natural Earth, public domain. See `CREDITS.md` at the top of the kit.

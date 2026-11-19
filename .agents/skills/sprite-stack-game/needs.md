# What the tools need from a game

`bun run check`, `bun run states` and `bun run snapshot` drive a copy through the starter's file names and the names below. Keep them, with whatever meaning suits the game. A balloon's hold can light a burner; its click can be a slow twirl.

| File | Keep |
| --- | --- |
| `game.js` | `createGame`, `VIEWS`, `TUNING`. On the game: `update`, `render`, `resize`, `setKeys`, `pointerMove`, `press`, `release`, `roll`, `nextView`, `view`, `chaseAmount`, `boost`, `world`, `model`, `camera`, and `craft` with `x`, `y`, `z`, `yaw`, `spin` |
| `world.js` | `buildWorld`, `groundAt`, `GROUND_MAX`, `CLOUD_LAYERS`, `MAT` |
| `model.js` | `sculptGrid`, `encodeGrid`, `decodeGrid`, `buildCraft`, `CRAFT_W`, `CRAFT_L`, `CRAFT_H`. The model is the same left and right, and has an `outline` colour |
| `camera.js`, `framebuffer.js` | As they are |

The checks also expect this behaviour: the right key turns the craft clockwise, pointing up climbs, a click sets `craft.spin` to 0, a hold lifts `boost` above 0.6, and a held dive never reaches the ground. How fast any of it happens is the game's own tuning.

## What a game may delete

- **The cockpit.** Take `'cockpit'` out of `VIEWS`. Then `cockpit.js`, `roll.js`, `cockpitAmount`, `viewRoll` and the code that uses them can go. So can the rules in `states.js` that name the cockpit.
- **The sea.** Take `LAND_SHARE` out of `world.js`, and the check on it is skipped. `terrain.js` and the spawn code in `world.js` use `MAT.SEA`, `MAT.SHALLOW`, `MAT.SURF` and `WATER_BELOW` by name, so change those lines too.
- **Trails or flames.** Leave `wingtips` or `nozzles` out of the model.
- **Pulling the stack apart.** Delete `toggleSpread`, its key, and its step in `states.js`.

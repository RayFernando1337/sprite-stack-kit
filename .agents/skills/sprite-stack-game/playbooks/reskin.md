# Reskin

The game plays the same and looks new. You own the look once the user has described it.

1. If the craft, the world, the colours or the mood are unclear, ask for all of them in one message. Otherwise start.
2. Work in a copy unless the user wants the starter itself changed: copy `examples/starter` to `examples/<name>`.
3. **The craft.** The shape in `sculpt()` and the colours in `CRAFT_PALETTE`, in `model.js` (`sprite-stack-models`).
4. **The world.** `MATERIALS` and the land rules in `buildWorld()`, in `world.js` (`stacked-terrain`).
5. **The cockpit.** Its colours and its map tones, to suit the new craft and world (`cockpit-and-hud`). Every view stays.
6. **The motion.** `TUNING` in `game.js`, until it moves like the new craft should (`game-feel`).
7. Run the three checks in the entry skill. Look at every view at two seeds, and once with `--turn 1`.

If the user wants a part gone, such as the sea or the wings, `needs.md` beside the entry skill lists what to change.

**Report:** what changed in the look, the snapshots to open, the last line of each check, and what you could not check.

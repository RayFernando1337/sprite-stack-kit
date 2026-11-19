# Feature

You own the feature from the first rule to the last check.

1. Read the skill for the part of the code it touches (the table in the entry skill). If Dash's game has the feature, `study-the-reference` says where to read how he did it.
2. Say what the feature promises as plain "always true" sentences. Add its steps, states and rules to the game's `states.js` and run `bun run states`. A game's own rules go there; `scripts/check.mjs` is only for promises every game makes. The new rules should fail and say the feature is missing (`verify-states`).
3. Build the smallest version the player can see, in its own file, called from `game.js`.
4. Run the three checks in the entry skill. Then break the feature once on purpose for each new rule, and see the walk report it.
5. Update what describes the game: its `README.md`, and `GAME.md` if it has one. If you changed the starter, also the matching skill, the documents that describe that part, and the file count in the top `README.md`. Then run `bun run figures` and look at what it redrew before you keep it.

A feature the user did not ask for goes in a note to the user, not into the build.

**Report:** what the player can now do, the rules you added, the last line of each check, and what you could not check.

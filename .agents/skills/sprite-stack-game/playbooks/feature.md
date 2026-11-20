# Feature

You own the feature from the first rule to the last check, and how good it is to play.

1. Read the skill for the part of the code it touches (the table in the entry skill). If Dash's game has the feature, play it there and read how he did it (`study-the-reference`). Write down the details that make his version land.
2. Say what the feature promises as plain "always true" sentences. Add its steps, states and rules to the game's `states.js` and run `bun run states`. A game's own rules go there; `scripts/check.mjs` is only for promises every game makes. The new rules should fail and say the feature is missing (`verify-states`).
3. Build the smallest version the player can see, in its own file, called from `game.js`. A feature that changes the update loop itself, such as slow motion or a change of shape, cannot be kept apart: write it into `update`. Make it work in every view the game has, the cockpit included.
4. Give it its answers. Anything the player does, and anything done to the player, should be seen and felt at once (`game-feel`; for fights, `combat-and-juice`).
5. Run the three checks in the entry skill, and see each new rule catch a break made on purpose. Then play it, or run the scripted pilots, and compare with your notes from step 1.
6. Update what describes the game: its `README.md`, and `GAME.md` if it has one. If you changed the starter, also the matching skill, the documents that describe that part, and the file count in the top `README.md`. Then run `bun run figures` and look at what it redrew before you keep it.

A feature the user did not ask for goes in a note to the user, not into the build.

**Report:** what the player can now do and how it feels to do it, the rules you added, the last line of each check, and what you could not check.

# Bug fix

Every line you change traces back to something you saw go wrong.

1. **See it yourself.** Run `bun run check` first. If a check or a rule already fails because of the bug, that is your failing rule: go to step 3. Otherwise pick the tool that fits:
   - It needs a certain order of actions: add any missing steps to the game's `states.js` and run `bun run states` (`verify-states`).
   - The picture is wrong: `bun run snapshot` with the view, seed, `--turn`, `--climb` and `--seconds` that show it.
   - It is about input, the page or timing: run the game in a browser (`check-your-work`).
   - It is slow: `bun run check` prints milliseconds per frame for each view.

   If you cannot make it happen, say so. Do not fix a guess.
2. **Write the rule or check that fails because of it**, in `states.js`, or in `scripts/check.mjs` for a promise every game makes. See it fail.
3. **Find where the game first goes wrong** and fix it there. Do not add a special case for the one path that showed it.
4. The new rule passes. Run the three checks in the entry skill.

**Report:** what was broken, the cause, the fix, and the failing then passing output.

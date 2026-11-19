# Contributing

Contributions are welcome. The most useful ones are:

- **A prompt** that built a game like this. Add a file to `prompts/` and a row to `prompts/README.md`.
- **A game** built on the starter. Add a folder to `examples/`.
- **A skill** that teaches a technique the kit does not cover yet. Add a folder to `.agents/skills/`.
- **A fix** to the starter, the docs or the scripts.

## Rules

1. **Credit people.** If your change uses someone's idea, prompt or explanation, add them to `CREDITS.md` with a link to where they shared it.
2. **Only share prompts you may share.** Add your own prompts, or prompts whose authors posted them publicly for others to use. Keep the original text unchanged, say who wrote it, and link to the post. Put translations and notes in separate sections.
3. **Never commit `reference/`.** Do not copy code, artwork, model data or sound from Dash's game, or from any other game without a license, into this repository.
4. **Keep the starter self-contained.** No libraries, no network requests, no image or sound files, and no WebGL. `npm test` checks this.
5. **Run `npm test`** before you open a pull request. If you changed what the game draws, run `npm run snapshot` and look at the frames.

## License of contributions

By contributing code or documents you agree that they are released under the [MIT License](LICENSE). Prompts stay the property of whoever wrote them.

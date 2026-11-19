# AGENTS.md

Guidance for coding agents working in this repository.

## What this repository is

sprite-stack-kit helps people build pixel-art games that look 3D without a 3D engine. It contains a small game to fork (`examples/starter`), skills that explain the techniques (`.agents/skills`), documents that teach them (`docs`) and a prompt library (`prompts`).

The approach comes from "fighter", a game by Dash (@creativedash). His code is not in this repository. See `CREDITS.md`.

## Commands

This project uses [Bun](https://bun.sh). Do not use npm, npx, yarn or pnpm, and do not add a lockfile or dependencies.

| Command | What it does |
| --- | --- |
| `bun start` | Serves `examples/starter` at `http://localhost:5173` (or the next free port) |
| `bun run check` | Runs the starter with no browser and checks what the kit promises. Takes a few seconds |
| `bun test` | The same checks, through Bun's test runner (`tests/kit.test.js`) |
| `bun run snapshot` | Saves frames as PNG files in `snapshots/` so you can look at what the game draws |
| `bun run figures` | Redraws the pictures in `docs/images/` from the game's own code |
| `bun run fetch-reference` | Downloads Dash's published build into `reference/` (git-ignored). Needs the network |
| `bun run reference` | Serves that downloaded copy so it can be played locally |

Flags go straight after the command: `bun run check --game examples/my-game`, `bun run snapshot --view cockpit --turn 1`.

There is nothing to install and no build step.

## Layout

```
examples/starter/        the game to fork
  index.html             the page: one canvas, a VIEW button and a hint line
  src/main.js            fits the canvas, passes input to the game, shows each frame
  src/game.js            flight, camera motion, draw order; all tuning numbers
  src/framebuffer.js     the low-resolution picture: colours, depth, dithering
  src/camera.js          the one camera formula, project(), and the three poses
  src/world.js           islands, clouds and their palette, from a seed
  src/terrain.js         draws the world as stacked columns, near to far
  src/model.js           the craft as a grid of slices; encode and decode
  src/stack.js           draws a sprite stack at any heading, bank and pitch
  src/roll.js            turns the picture of the world, so the cockpit view can bank
  src/cockpit.js         the cockpit: painted layers, live instruments, head-up display
  src/paint.js           dots, boxes, lines, discs and a 3 × 5 pixel font
  src/rng.js             seeded random numbers and tileable noise
.agents/skills/          one folder per skill, each with a SKILL.md
docs/                    how it works, tutorial, deeper look, glossary, the original's source
docs/images/             figures, drawn by `bun run figures`; do not edit by hand
prompts/                 prompts for building games like this, with credit
scripts/                 serve, check, snapshot, figures, fetch-reference
tests/                   lets `bun test` run the checks
reference/               downloaded third-party code; git-ignored; may not exist
```

## Skills

Read the skill that matches the task before you change code.

| Skill | Use it when |
| --- | --- |
| `sprite-stack-game` | Starting any game or feature with this kit. Read this one first |
| `software-framebuffer` | Drawing pixels, colours, dithering, resizing, whole-picture effects, page overlays |
| `sprite-stack-models` | Making, changing or adding a stacked model |
| `stacked-terrain` | Changing the world: land, water, clouds, shadows, fog, sky |
| `one-camera-views` | Changing the camera, adding a view, banking the picture |
| `cockpit-and-hud` | Changing the cockpit, adding an instrument, a score or any display drawn in the picture |
| `game-feel` | Controls, motion, trails, flames, particles, sound |
| `study-the-reference` | Finding out how Dash's game does something |
| `check-your-work` | Before you say a change is done |

## Rules

1. **No 3D engine and no libraries in a game.** Games in `examples/` use Canvas 2D and plain JavaScript modules. No WebGL, no WebGPU, no packages, no network requests. `bun run check` fails if the starter breaks this.
2. **Everything is drawn into one low-resolution picture.** Do not draw game objects with canvas path calls or DOM elements. Hints and buttons are the exception: they are DOM elements over the canvas.
3. **Games are repeatable.** The same seed and the same input must draw the same frames. Do not use `Math.random()` or the clock inside game code. Use `makeRng` and `hash2` from `rng.js`.
4. **Do not allocate in the frame loop.** Create typed arrays and objects once, then reuse them. That includes strings: draw numbers with `number()` from `paint.js`.
5. **Never commit `reference/`, and never copy from it.** You may read it to learn how something is done. Write your own code, shapes, colours and sounds. If a technique comes from Dash's build, say so in `CREDITS.md`.
6. **Do not edit other people's prompts.** The original text in `prompts/` stays exactly as its author wrote it.
7. **Credit people.** If you add someone's idea or prompt, add them to `CREDITS.md` with a link.
8. **Check before you finish.** Run `bun run check`. If you changed what is drawn, run `bun run snapshot` and look at the frames, then run `bun run figures` so the documents' pictures match. Follow the `check-your-work` skill.

## Code style

- Plain JavaScript ES modules. Two-space indentation, single quotes, no semicolons.
- Comments explain why a line is the way it is, in plain words. They do not restate the code.
- Names say what a thing is: `skyline`, `rowsNow`, `groundAhead`.
- Keep files small and single-purpose. A new feature usually gets its own file.

## Documents

Documents and skills are written in plain language for people who are new to this. Use short sentences and define a term when you first use it. Add new terms to `docs/glossary.md`.

When behaviour changes, update what describes it: the README, the matching skill, `docs/how-it-works.md`, `docs/deep-dive.md`, and `docs/tutorial.md` if a step in it touches the code you changed. The tutorial quotes lines from the starter, so check that each quoted line still exists.

# AGENTS.md

Guidance for coding agents working in this repository.

## What this repository is

sprite-stack-kit helps people build pixel-art games that look 3D without a 3D engine. It contains a small game to fork (`examples/starter`), skills that explain the techniques (`.agents/skills`), a prompt library (`prompts`) and documents (`docs`).

The approach comes from "fighter", a game by Dash (@creativedash). His code is not in this repository. See `CREDITS.md`.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Serves `examples/starter` at `http://localhost:5173` (or the next free port) |
| `npm test` | Runs the starter with no browser and checks what the kit promises. Takes a few seconds |
| `npm run snapshot` | Saves frames as PNG files in `snapshots/` so you can look at what the game draws |
| `npm run fetch-reference` | Downloads Dash's published build into `reference/` (git-ignored). Needs the network |
| `npm run reference` | Serves that downloaded copy so it can be played locally |

There is nothing to install and no build step. Node.js 20 or newer is required.

## Layout

```
examples/starter/        the game to fork
  index.html             the page: one canvas and a hint line
  src/main.js            fits the canvas, passes input to the game, shows each frame
  src/game.js            flight, camera, draw order; all tuning numbers
  src/framebuffer.js     the low-resolution picture: colours, depth, dithering
  src/camera.js          the one camera formula and project()
  src/world.js           islands, clouds and their palette, from a seed
  src/terrain.js         draws the world as stacked columns, near to far
  src/model.js           the craft as a grid of slices; encode and decode
  src/stack.js           draws a sprite stack at any heading, bank and pitch
  src/rng.js             seeded random numbers and tileable noise
.agents/skills/          one folder per skill, each with a SKILL.md
prompts/                 prompts for building games like this, with credit
docs/                    how it works, getting the original's source, reference map
scripts/                 serve, check, snapshot, fetch-reference
reference/               downloaded third-party code; git-ignored; may not exist
```

## Skills

Read the skill that matches the task before you change code.

| Skill | Use it when |
| --- | --- |
| `sprite-stack-game` | Starting any game or feature with this kit. Read this one first |
| `software-framebuffer` | Drawing pixels, colours, dithering, resizing, text and overlays |
| `sprite-stack-models` | Making, changing or adding a stacked model |
| `stacked-terrain` | Changing the world: land, water, clouds, shadows, fog, sky |
| `one-camera-views` | Changing the camera or adding a view |
| `game-feel` | Controls, motion, trails, flames, particles, sound |
| `study-the-reference` | Finding out how Dash's game does something |
| `check-your-work` | Before you say a change is done |

## Rules

1. **No 3D engine and no libraries in a game.** Games in `examples/` use Canvas 2D and plain JavaScript modules. No WebGL, no WebGPU, no npm packages, no network requests. `npm test` fails if the starter breaks this.
2. **Everything is drawn into one low-resolution picture.** Do not draw game objects with canvas path calls or DOM elements. Text and buttons are the exception: they are DOM elements over the canvas.
3. **Games are repeatable.** The same seed and the same input must draw the same frames. Do not use `Math.random()` or the clock inside game code. Use `makeRng` and `hash2` from `rng.js`.
4. **Do not allocate in the frame loop.** Create typed arrays and objects once, then reuse them.
5. **Never commit `reference/`, and never copy from it.** You may read it to learn how something is done. Write your own code, shapes, colours and sounds. If a technique comes from Dash's build, say so in `CREDITS.md`.
6. **Do not edit other people's prompts.** The original text in `prompts/` stays exactly as its author wrote it.
7. **Credit people.** If you add someone's idea or prompt, add them to `CREDITS.md` with a link.
8. **Check before you finish.** Run `npm test`. If you changed what is drawn, run `npm run snapshot` and look at the frames. Follow the `check-your-work` skill.

## Code style

- Plain JavaScript ES modules. Two-space indentation, single quotes, no semicolons.
- Comments explain why a line is the way it is, in plain words. They do not restate the code.
- Names say what a thing is: `skyline`, `rowsNow`, `groundAhead`.
- Keep files small and single-purpose. A new feature usually gets its own file.

## Documents

Documents and skills are written in plain language for people who are new to this. Use short sentences and define a term when you first use it. When behaviour changes, update the README, the matching skill and `docs/how-it-works.md`.

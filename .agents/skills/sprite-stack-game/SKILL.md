---
name: sprite-stack-game
description: "The entry point for any work in sprite-stack-kit: pixel-art games that look 3D with no 3D engine, made of sprite stacks on a hand-written software renderer. Matches the request to a playbook (new game, feature, reskin, bug fix, learn) and names the skill for each part of the code. Use when the user wants a game like the pixel fighter jet demo, mentions sprite stacking or 'no 3D engine', wants to fork, reskin, extend or fix a game in examples/, or wants to understand how the technique works."
---

# sprite-stack-kit: start here

Say the user's goal back in one sentence. Match it to a playbook, read `playbooks/<name>.md` beside this file, and put its steps in your todo list, if you have one, before you do anything else.

| Playbook | The user wants |
| --- | --- |
| `new-game` | A whole new game: "make a boat game in this style" |
| `feature` | Something added to a game: enemies, a score, a radar, sound |
| `reskin` | The same game with a new look: "a dragon over a desert" |
| `bug-fix` | Something that is broken, looks wrong or is slow |
| `learn` | To understand how it works. Nothing is changed |

If nothing fits, do the smallest thing that meets the goal and keep to the rest of this page.

## The idea

Plain JavaScript draws the whole game into one small picture, about 400 × 240 pixels, shown scaled up with hard edges. Objects are sprite stacks: piles of flat pixel slices, one per layer of height. The ground is a height map drawn as columns from near to far. One camera formula gives the view from above, from behind and from the cockpit. `docs/how-it-works.md` shows all of it with pictures.

## What a game must keep

1. Every game object is written into the one low-resolution picture, pixel by pixel. Only hints and buttons are page elements.
2. No 3D engine library, no WebGL, no libraries, no network. The few lines of 3D maths are the game's own. No image or sound files unless the user asks.
3. The same seed and input draw the same frames. Use `makeRng` and `hash2` from `rng.js`, never `Math.random()` or the clock.
4. Nothing is created in the frame loop, strings included. Draw numbers with `number()` from `paint.js`.
5. Fades are dithered, not blended.
6. Bun runs everything. No npm, no dependencies.

Two limits of the technique. Say so early if a request runs into one:

- The ground has one height per pixel, so there are no caves, bridges or overhangs.
- A stack is flat slices. Seen exactly from the side it thins to lines.

## Every step ends with a check

```sh
bun run check --game examples/<name>      # the kit's promises still hold
bun run states --game examples/<name>     # every state the game can reach keeps its rules
bun run snapshot --game examples/<name>   # then look at the frames, if you can
```

Leave out `--game` for the starter. A frame can pass every check and still look wrong, so look. Fix the cause of a failure and never loosen a check or a rule to pass. If a rule was never true, change it and say so. If two fixes for one problem have failed, question what both assumed. Say plainly what you could not check. The `check-your-work` skill has the details.

## The skill for each part

Read the skill before you change its files. Each is at `.agents/skills/<name>/SKILL.md`.

| Skill | Covers |
| --- | --- |
| `software-framebuffer` | `framebuffer.js`, `main.js`: the picture, depth, dithering, the page |
| `sprite-stack-models` | `model.js`, `stack.js`: making and drawing stacked models |
| `stacked-terrain` | `world.js`, `terrain.js`: land, water, clouds, fog, sky |
| `one-camera-views` | `camera.js`, `roll.js`: the camera, views, banking the picture |
| `cockpit-and-hud` | `cockpit.js`, `paint.js`: instruments, a score, any display in the picture |
| `game-feel` | `game.js`: controls, motion, trails, flames, sound |
| `verify-states` | `states.js`: anything with states or modes; bugs that need a certain order of steps |
| `study-the-reference` | How Dash's original game does something |

`needs.md`, beside this file, lists the names the tools need from a copy of the starter and what a game may delete: the cockpit, the sea, trails.

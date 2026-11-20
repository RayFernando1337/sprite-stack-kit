---
name: sprite-stack-game
description: "The entry point for making or changing a sprite-stack-kit game: a pixel-art game that looks 3D with no 3D engine, made of sprite stacks on a hand-written software renderer. Finds the kit's tools, matches the request to a playbook (new game, feature, reskin, bug fix, learn) and names the skill for each part of the code. Use when the user wants to make a game like the pixel fighter jet demo (flying, dogfights, boats, dragons), mentions sprite stacking or 'no 3D engine', wants to add to, reskin, fix or make more fun a game built with the kit, or wants to understand how the technique works."
---

# sprite-stack-kit: start here

## Find the kit

The kit is the folder that holds `scripts/check.mjs` and `examples/starter`. If the project has no such folder, these skills were installed alone and the tools are missing. Get them, in the project (and add the folder to the project's `.gitignore`) or beside it:

```sh
git clone https://github.com/RayFernando1337/sprite-stack-kit
bun --version    # the tools need Bun. If it is missing, ask the user to install it from bun.sh
```

- Run every `bun` command from the kit's folder. Paths such as `scripts/`, `docs/` and `examples/starter` are inside it.
- A game can live anywhere. The tools take a path inside the kit, `--game examples/<name>`, or an absolute path, `--game /path/to/<name>`. In someone else's project, put the game in their project, not in the clone.
- The other skills are the folders beside this one.

## Pick a playbook

Say the user's goal back in one sentence. Match it to a playbook, read `playbooks/<name>.md` beside this file, and put its steps in your todo list, if you have one, before you do anything else.

| Playbook | The user wants |
| --- | --- |
| `new-game` | A whole new game: "make a boat game in this style" |
| `feature` | Something added or made better: enemies, a score, a radar, sound, "make it more fun" |
| `reskin` | The same game with a new look: "a dragon over a desert" |
| `bug-fix` | Something that is broken, looks wrong or is slow |
| `learn` | To understand how it works. Nothing is changed |

If nothing fits, do the smallest thing that meets the goal and keep to the rest of this page.

## The idea

Plain JavaScript draws the whole game into one small picture, about 400 × 240 pixels, shown scaled up with hard edges. Objects are sprite stacks: piles of flat pixel slices, one per layer of height. The ground is a height map drawn as columns from near to far. One camera formula gives the view from above, from behind and from the cockpit. `docs/how-it-works.md` shows all of it with pictures.

## The bar is fun

People come to this kit because Dash's original is a joy to play: three views with a cockpit you fly from, and a small answer to everything the player does. A game that keeps every rule below can still be dull. So:

- **Keep what the starter has.** The three views, the cockpit, the roll, the trails and the flames stay in every game unless the user says, in their own words, to drop one. Not needing a thing yet is no reason to delete it.
- **What the game is belongs to the user.** What you control, the views, the look, what is in and what is out. Ask. Do not settle these yourself.
- **Know the original before you design.** The `study-the-reference` skill says how to play it and what to look for.
- **Detail is the feature.** A cannon is also its tracers, the flash, the shake and the debris. The `combat-and-juice` skill has the recipes for fights and feedback, and a fun bar that scripted pilots can measure.

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

Read the skill before you change its files.

| Skill | Covers |
| --- | --- |
| `software-framebuffer` | `framebuffer.js`, `main.js`: the picture, depth, dithering, the page |
| `sprite-stack-models` | `model.js`, `stack.js`: making and drawing stacked models, or cutting one from four flat drawings (`bun run views`) |
| `stacked-terrain` | `world.js`, `terrain.js`: land, water, clouds, fog, sky |
| `one-camera-views` | `camera.js`, `roll.js`: the camera, views, banking the picture |
| `cockpit-and-hud` | `cockpit.js`, `paint.js`: instruments, a score, any display in the picture |
| `game-feel` | `game.js`: controls, motion, trails, flames |
| `combat-and-juice` | Enemies, weapons, hits and the feedback that makes them land |
| `verify-states` | `states.js`: anything with states or modes; bugs that need a certain order of steps |
| `study-the-reference` | Dash's original game: what makes it fun, and how it does each thing |

`needs.md`, beside this file, lists the names the tools need from a copy of the starter, and what to change when the user wants something taken out.

# New game

You own the build. The user owns what the game is and how it looks.

## 1. Look before you ask

Find out by yourself: is Bun installed (`bun --version`; if not, ask the user to install it from bun.sh), does `bun run check` pass, can you view the PNG from `bun run snapshot --view chase`, can you drive a browser. Note what you could not do. It goes in the brief and in your report.

## 2. Ask once

Ask these together, in one message, each with its default. Use your question tool if you have one. On "surprise me", take the defaults and say which you took.

| # | Ask | Default |
| --- | --- | --- |
| 1 | **The game in one sentence.** What do I control, where, and what am I trying to do? | A plane exploring islands, with nothing to win |
| 2 | **The look.** The craft, the world, the colours, the mood. Is there a picture, a game or a link to go by? | Bright daytime, the starter's palette |
| 3 | **Views and controls.** From above, from behind, from the cockpit? Mouse, keyboard, touch, gamepad? | All three views, mouse and keyboard, touch for steering |
| 4 | **The first playable.** What one thing must feel good first? Up to three features after that, and anything that is out for now | Flying feels good. No other features |
| 5 | **Limits.** The kit uses no libraries, no image or sound files and no network. Keep all of that? A phone? A size limit? | Keep every rule. Phone and laptop. No size limit |
| 6 | **How we work.** Show you each step, or run to the end and report? What is the game's folder called? | Run to the end. Folder named after the game |

Do not ask the user to choose between ways of building something. If trying it would settle a question, try it.

## 3. Write the brief and get a yes

```sh
cp -r examples/starter examples/<name>
```

Write `examples/<name>/GAME.md`, and replace the copy's `README.md` with a few lines on what the game is and how to run it.

```markdown
# <Name>

**In one sentence:** …
**The look:** …
**Views and controls:** …

## First playable
The one thing that must feel good first.

## Features, in order
1. …  (three at most)

## Later
Ideas that are out for now. New ideas go here, not into the build.

## Always true
Plain sentences that must hold whatever the player does. You write these from
the user's answers, and the user checks them with the rest of the brief.
For example: "The boat is always on water." "The score never goes down."

## Limits
Which kit rules apply, the devices, any size limit.

## What the agent could not check here
For example: no browser, cannot view images.
```

Show the brief and wait for a yes. This is the only stop for approval. `GAME.md` is your memory: read it first in a new session.

## 4. Build in small steps

One step is one change the player can see. Each ends with the three checks in the entry skill. If the folder is a git repository, commit after each passing step.

1. **Take out what the game does not use** (`needs.md` in the entry skill's folder).
2. **The look.** The craft (`sprite-stack-models`), then the world (`stacked-terrain`).
3. **The first playable.** Tune until it matches the brief (`game-feel`).
4. **Each feature**, in the brief's order, by the `feature` playbook.

For the first playable and each feature, write its rules in `states.js` from "Always true" before you build it, and see them fail (`verify-states`).

## 5. Keep it small

Build what the brief says. A new idea goes under "Later". No settings or menus nobody asked for. When a step is done, look for what you can now delete. Stop when the brief is done.

## Report

1. How to play: `bun scripts/serve.mjs examples/<name>`, and the controls.
2. What you built, against each line of the brief.
3. What you checked, with the last line of each command's output.
4. What you could not check, and what the user should try.
5. What is under "Later".

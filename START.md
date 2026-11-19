# START: make a game with your agent

**People:** open this folder in your coding agent and say:

> Read START.md and follow it. I want to make a game.

The agent will ask you a few questions, write down what you agreed, and build the game in small steps that it checks as it goes. It works with any agent that can read files and run commands.

**Agents:** the rest of this page is for you. Someone wants a game in this style. Follow the steps in order.

## 1. Look before you ask

Find out what you can by yourself. Do not ask the user for any of this.

| Find out | How |
| --- | --- |
| Is Bun installed? | `bun --version`. If not, ask the user to install it from bun.sh. Do not switch to npm |
| Does the kit work here? | `bun run check`. Every line should start with `ok` |
| The rules and the file map | Read `AGENTS.md`, then `.agents/skills/sprite-stack-game/SKILL.md` |
| Can you look at pictures? | `bun run snapshot --view chase`, then open the PNG it names |
| Can you drive a browser? | Only if your tools include one |
| Can you ask multiple-choice questions? | Only if your tools include one |

Your agent may not load the skills in `.agents/skills` by itself. They are plain files. When a step names a skill, read `.agents/skills/<name>/SKILL.md`.

Write down what you could not do. It goes in the brief and in your final report.

## 2. Ask the user, once

Ask these six questions together, in one message. Use your question tool if you have one, otherwise a numbered list. Offer the default with each. If the user says "surprise me", take the defaults and say which you took.

| # | Ask | Default |
| --- | --- | --- |
| 1 | **The game in one sentence.** What do I control, where, and what am I trying to do? | A plane exploring islands, with nothing to win |
| 2 | **The look.** The craft, the world, the colours, the mood. Is there a picture, a game or a link to go by? | Bright daytime, the starter's palette |
| 3 | **Views and controls.** Which views: from above, from behind, from the cockpit? Which devices: mouse, keyboard, touch, gamepad? | All three views, mouse and keyboard, touch for steering |
| 4 | **The first playable.** What is the one thing that must feel good first? Name up to three features after that, and anything that is out for now | Flying feels good. No other features |
| 5 | **Limits.** The kit uses no libraries, no image or sound files and no network. Keep all of that? Must it run on a phone? Is there a size limit? | Keep every rule. Phone and laptop. No size limit |
| 6 | **How we work.** Show you each step, or run to the end and report? What should the game's folder be called? | Run to the end. Folder named after the game |

What the game is and how it looks are the user's decisions. How to build it is yours. Do not ask the user to choose between ways of building something. If you can settle a question by trying it, try it.

## 3. Write the brief and get a yes

Copy the starter, then write the brief inside the copy:

```sh
cp -r examples/starter examples/<name>
```

`examples/<name>/GAME.md`:

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

## How we work
Step by step, or run to the end.

## What the agent could not check here
For example: no browser, cannot view images.
```

Replace the copy's `README.md` with a few lines about this game: what it is and how to run it.

Show the brief to the user and wait for a yes. This is the only time you stop for approval. After it, keep going. If the answer is no, change the brief, or delete the copy.

`GAME.md` is your memory. If you lose track, or start a new session, read it first.

## 4. Build in small steps

One step is one change the player can see. Do them in this order:

1. **Take out what the game does not use.** The `sprite-stack-game` skill lists what a game may delete and what the tools still need ("What the tools need from a game"). Build on the smaller base.
2. **The look.** The craft (`sprite-stack-models` skill), then the world (`stacked-terrain` skill).
3. **The first playable.** Tune it until it matches the brief (`game-feel` skill).
4. **Each feature**, in the brief's order. A feature usually gets its own file.

Every step ends the same way. Do not start the next step until this one passes:

```sh
bun run check --game examples/<name>      # the kit's promises still hold
bun run states --game examples/<name>     # every state the game can reach keeps its rules
bun run snapshot --game examples/<name>   # saves snapshots/<name>-<view>-seed7.png. Look at them, if you can
```

For the first playable and for each feature, work in this order (`verify-states` skill):

1. Add its steps, states and rules to `examples/<name>/states.js`. The rules come from "Always true" in the brief.
2. Run `bun run states`. The new rule should fail and say the feature is missing, or have nothing to check yet.
3. Build until it passes.

If the folder is a git repository, commit after each passing step. `bun run figures` redraws the starter's documents; a new game does not need it.

## 5. Keep it small

- Build what the brief says. A new idea goes under "Later" in `GAME.md`.
- No settings, menus or options the brief did not ask for.
- Fewer things that feel good beat more things that feel rough.
- When a step is done, look for what you can now delete.
- Stop when the brief is done.

## 6. When something goes wrong

- A check fails: fix the cause. Never loosen a check or a rule to get a pass. If the rule itself is wrong, say so and change it in the open.
- Two fixes for the same problem have failed: stop and question what both assumed. Read the matching skill again.
- `bun run states` prints the shortest list of steps that breaks a rule. Replay those steps before you change anything.
- You cannot check something here: say so. Do not report it as working.

## 7. Hand over

Tell the user, in this order:

1. How to play it: `bun scripts/serve.mjs examples/<name>`, and the controls.
2. What you built, against each line of the brief.
3. What you checked, with the last line of each command's output.
4. What you could not check, and what the user should try themselves. Name the files to look at.
5. What is under "Later".

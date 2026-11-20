# The documents

To have a coding agent build a game for you, start with [START.md](../START.md) at the top of the repository.

If you are new to this and want to understand it, read the first three in order. Each one goes a step deeper than the one before.

| | Document | What it gives you |
| --- | --- | --- |
| 1 | [How it works](how-it-works.md) | The six ideas behind the look, with pictures. One formula, explained |
| 2 | [Tutorial](tutorial.md) | Eight small changes to make with your own hands, from a tuning number to your own copy of the game |
| 3 | [A deeper look](deep-dive.md) | Each technique worked through: why the formulas are what they are, where the code is, and things to try |

Keep these two open while you read:

| Document | What it gives you |
| --- | --- |
| [Glossary](glossary.md) | Every term the kit uses, in one place |
| [The starter's README](../examples/starter/README.md) | What each file of the game does, and how to drive the game from your own code |

And these are about Dash's original game:

| Document | What it gives you |
| --- | --- |
| [Getting the source](getting-the-source.md) | What the Forge link is, why a saved page does not run, the two ways to get the code, and what you may do with it |
| [A map of Dash's code](reference-map.md) | Where each feature lives in his files, so you can read how he did it |

## The skills are how-to guides

The folders in [`.agents/skills`](../.agents/skills) are written for coding agents, but they are plain language and they work as how-to guides for people. When you have a particular job to do, read the matching one.

| When you want to | Read |
| --- | --- |
| Start a game or a feature, and see the rules and the file map | [sprite-stack-game](../.agents/skills/sprite-stack-game/SKILL.md) |
| Draw something new into the picture, add an effect, or fix blurry pixels | [software-framebuffer](../.agents/skills/software-framebuffer/SKILL.md) |
| Change the craft, or add another stacked object | [sprite-stack-models](../.agents/skills/sprite-stack-models/SKILL.md) |
| Change the land, the sea, the clouds or the sky | [stacked-terrain](../.agents/skills/stacked-terrain/SKILL.md) |
| Change the camera or add a view | [one-camera-views](../.agents/skills/one-camera-views/SKILL.md) |
| Change the cockpit, or add a dial, a screen, a score or a health bar | [cockpit-and-hud](../.agents/skills/cockpit-and-hud/SKILL.md) |
| Tune the controls, trails or flames | [game-feel](../.agents/skills/game-feel/SKILL.md) |
| Add enemies, weapons, explosions, screen shake or sound | [combat-and-juice](../.agents/skills/combat-and-juice/SKILL.md) |
| Find out how Dash's game does something | [study-the-reference](../.agents/skills/study-the-reference/SKILL.md) |
| Check a feature in every state the game can reach | [verify-states](../.agents/skills/verify-states/SKILL.md) |
| Make sure a change really works | [check-your-work](../.agents/skills/check-your-work/SKILL.md) |

## The pictures

Every picture in these documents is drawn by the game's own code:

```sh
bun run figures
```

That writes the files in `docs/images/`. The game is repeatable, so the pictures come out the same every time until the drawing changes. If you change how the starter draws, run it again and the documents catch up.

[`scripts/figures.mjs`](../scripts/figures.mjs) is short and worth reading. It shows how to draw the world with no craft in it, how to read the depth array, and how to stop the ground sweep half-way.

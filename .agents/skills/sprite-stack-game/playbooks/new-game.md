# New game

You own the build. The user owns what the game is: what they control, the views, the look, what is in and what is out. An answer the user did not give is not a "no". Only the user's own words take something out of the game.

## 1. Look before you ask

- **The tools.** `bun run check` passes. Can you view the PNG from `bun run snapshot --view chase`? Can you drive a browser? Note what you could not do. It goes in the brief and in your report.
- **The original.** It is the bar for fun, and you cannot design to a bar you have not seen. Follow "Before you design" in the `study-the-reference` skill and keep its notes. Do the same for any game, picture or link the user names.

## 2. Ask once

Ask every row, together, in one message, each with its default. Use your question tool if you have one. Where the request already answers a row, show that answer as the default for the user to confirm. Do not drop the row. On "surprise me", take the defaults and say which you took.

| Ask | Default |
| --- | --- |
| **The game in one sentence.** What do I control, where, and what am I trying to do? | A plane exploring islands, with nothing to win |
| **The fun.** What should the best ten seconds feel like? Which parts of the original, or of another game, must it have? Offer the list from your notes | The parts of your notes that this game's best ten seconds need. The rest go under "Later" |
| **The look.** The craft, the world, the colours, the mood. Does the craft change, for example a rocket that becomes a plane? Is there a picture, a game or a link to go by? | Bright daytime, the starter's palette |
| **Views and controls.** From above, from behind, from the cockpit? Mouse, keyboard, touch, gamepad? | All three views, with the cockpit. Mouse and keyboard, touch for steering |
| **The first playable.** What one thing must feel good first? Which features come after it, and is anything out? | Flying feels good. Nothing is out |
| **Limits.** The kit uses no libraries, no image or sound files and no network. Keep all of that? A phone? A size limit? | Keep every rule. Phone and laptop. No size limit |
| **How we work.** Show you each step, or run to the end and report? Where does the game's folder go, and what is it called? | Run to the end. `examples/<name>`, named after the game |

Do not ask the user to choose between ways of building something. If trying it would settle a question, try it.

## 3. Write the brief and get a yes

Copy `examples/starter` from the kit to the game's folder. Write `GAME.md` in it, and replace the copy's `README.md` with a few lines on what the game is and how to run it. Every detail the user named goes into the brief in their words. A detail left out of the brief is a detail left out of the game.

```markdown
# <Name>

**In one sentence:** …
**The look:** …
**Views and controls:** … (all three views unless the user said otherwise)

## What makes it fun
Three to six lines, from the user's answer and your notes on the original.
Each is something a player feels and you can see or count in play.
"Every hit answers with a flash, a shake and debris."
"A fight is never quiet for more than five seconds."

## First playable
The one thing that must feel good first.

## Features, in order
1. …  For each, the details that make it land, not only its name.
   Five at most: fewer things that feel great beat many that feel rough.

## Out, and who said so
Only what the user said to leave out, in their words. Empty is normal.

## Later
Ideas that came up and are not in this build.

## Always true
Plain sentences that must hold whatever the player does. You write these from
the user's answers, and the user checks them with the rest of the brief.
"The boat is always on water." "The score never goes down."

## Limits
Which kit rules apply, the devices, any size limit.

## What the agent could not check here
For example: no browser, cannot view images.
```

Show the brief and wait for a yes. This is the only stop for approval. `GAME.md` is your memory: read it first in a new session.

## 4. Build in small steps

One step is one change the player can see. Each ends with the three checks in the entry skill. If the folder is a git repository, commit after each passing step.

1. **The look.** The craft (`sprite-stack-models`), then the world (`stacked-terrain`). The cockpit and the other views come along: repaint them to match, do not drop them.
2. **The first playable.** Tune until it matches the brief (`game-feel`).
3. **Each feature**, in the brief's order, by the `feature` playbook.
4. **Take out** what "Out" names, if anything, as `needs.md` in the entry skill's folder says.

For the first playable and each feature, write its rules in `states.js` from "Always true" before you build it, and see them fail (`verify-states`).

Keep the scope small and the detail rich. A new feature idea goes under "Later". Detail inside a feature the brief names is not a new idea: it is the feature.

## 5. Hold it to the fun bar

Passing checks prove the rules hold. They do not prove the game is good to play. Before you hand over:

- [ ] Play it in a browser if you can, in every view. If the game has a fight, hold it to "The fun bar" in the `combat-and-juice` skill, measured with its scripted pilots.
- [ ] Go through "What makes it fun" line by line. For each, say what you saw or counted. A line you cannot show is not done.
- [ ] Put it beside the original (`bun run reference`), and beside your notes. List what the original does that this game does not. Build the ones that matter most to the brief. Name the rest in your report.

If the game misses the bar and you cannot close the gap, say so plainly. Do not report it as finished.

## Report

1. How to play: `bun scripts/serve.mjs <the game's folder>`, and the controls.
2. What you built, against each line of the brief.
3. The fun bar: each line of "What makes it fun" with what you saw or counted, and what the original still does better.
4. What you checked, with the last line of each command's output.
5. What you could not check, and what the user should try.
6. What is under "Later".

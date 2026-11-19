---
name: verify-states
description: "How to check a game in every state it can reach, not just the cases someone thought of: the per-game state map (states.js) of player steps, states and rules, and the walker (bun run states) that tries every order of steps on the real game and reports the shortest path to a broken rule. Use when adding any feature with states or modes (views, health, lives, score, enemies, menus, pause, weapons, pickups), when a bug only appears after a certain order of actions, or before saying a feature is done."
---

# Checking every state

Files: `examples/<game>/states.js` (the map, one per game) and `scripts/states.mjs` (the walker).

`bun run check` tries the cases someone wrote. `bun run states` tries every order of the player's steps, from a fresh game, until it has seen every state the map can tell apart. It runs the real game, so there is no separate model to keep in step with the code. It takes about two seconds.

```sh
bun run states                             # the starter
bun run states --game examples/my-game
bun run states --chart                     # also prints the states as a Mermaid chart
```

## The map has four parts

| Part | What it is | Write it as |
| --- | --- | --- |
| `events` | What the player can do | `'you press VIEW': (game, notes) => game.nextView()` |
| `waits` | Time going by, in frames: one short, one long | `'a moment passes': 7` |
| `state(game, notes)` | The state the game is in, as a few words | `{ view: 'chase', camera: 'moving', … }` |
| `rules` | What must always hold | `{ name: 'the craft never touches the ground', check }` |

Write every name the way a player would say it. A broken rule is reported in these words:

```
FAIL  left alone, the camera arrives and a roll finishes
      after more than three seconds the camera is still arrived and the craft is rolling
      the shortest way to get there, from a fresh game:
        1. you press VIEW
        2. you press VIEW
        3. you click
        4. everything settles
```

## Adding a feature to the map

Do this before you build the feature.

1. **Events.** Add each new thing the player can do. Also add what the world can do to the player, such as `'a shot hits you'`. Call the game's own functions. A walk is only a few steps long, so it will not fly to something far away. The event may put the craft there instead: set `game.craft.x` and `y` to the ring's. Do not add functions to the game that only the map calls.
2. **State.** Add a field for each new thing that can be true: `health: 'full' | 'hurt' | 'gone'`. Use a few named values, not numbers. Group numbers into the ranges that behave differently.
3. **Rules.** Turn each "always true" sentence into a rule. `check(game, frame, state, notes)` returns nothing when the rule holds, or a few words saying how it is broken. To compare with before, as in "the score never goes down", write the old value into `notes` in the event and read it in the rule.
4. Run `bun run states`. A new rule should fail, or have nothing to check, until the feature exists. Make it fail in plain words: "the game has no score", not "the score is undefined". Then build until it passes.

Kinds of rule that find real bugs:

- **Never.** "The score never goes down." "The boat is never on land."
- **Always, in a state.** "With no lives left, the game-over card is showing."
- **Left alone, it ends.** Give the rule `after: 'everything settles'`. "A roll finishes." "The camera arrives." "A hit flash goes away."
- **The picture.** "Every pixel is drawn." Count colours in `frame.color`, over `frame.width × frame.height`.

## Two things that make a map lie

**A state that hides something.** Two games count as the same state when `state()` gives the same words, and the walker goes on from only one of them. So anything that decides what happens next must be in the state. A held button is the classic case: the game looks the same for a moment, then the thrusters open. If the game cannot be asked, write it in `notes` from the event, as the starter does for `held`.

Signs of a hidden state: the walk reports far fewer states than you expect, or a state you know exists is never listed with `--chart`.

**A rule that cannot fail.** Break the feature on purpose and run the walk. It must report the break. Then put the feature back. Do this once for every new rule.

## Reading the result

```
examples/starter: 192 states, 931 moves between them
1536 paths tried, up to 8 steps long, 124016 frames flown, 1.7 s
every state the map can reach was visited
```

- **"every state the map can reach was visited"** means the walk finished. If it says it stopped, raise `--depth`, or the state has a field that takes too many values.
- **A pass covers** the steps in the map, in every order, at the map's two timings.
- **A pass does not cover** a step the map leaves out, a timing between the two waits, or how something looks. Say this when you report.

## When a rule breaks

1. Replay the listed steps by hand, or in a snapshot, and see it.
2. Decide which is wrong: the game, or the rule. A rule that was never true is fixed in the open, with a reason.
3. Fix the game where it first goes wrong. Do not add a special case for that one path.
4. Run the walk again.

Never weaken a rule to get a pass.

## Keep the map small

- Six to ten events. Leave out events that cannot change what happens next.
- State fields with two to four values each. The number of states is their product.
- Keep the walk under about ten seconds, so it gets run after every change.

## Where this comes from

The idea of writing down states and rules, checking every path, and reporting a break as the shortest path in the reader's words comes from model checking with TLA+, and from the formal verification and statechart skills in Lauren Tan's pstack. This kit keeps the idea and drops the separate model: the game is repeatable, so the walker can drive the real code. For a proof about a design before any code exists, TLA+ is still the right tool.

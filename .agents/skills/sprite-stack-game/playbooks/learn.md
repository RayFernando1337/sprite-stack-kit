# Learn

The user wants to understand, not to change anything. Leave the repository as you found it.

1. Work out what they are after from what they said, and start from the matching document:

   | They want | Start from |
   | --- | --- |
   | The idea, with pictures | `docs/how-it-works.md` |
   | To build it by hand, step by step | `docs/tutorial.md` |
   | Why a formula is the way it is | `docs/deep-dive.md` |
   | A word | `docs/glossary.md` |
   | How Dash's original does it | the `study-the-reference` skill |

2. Answer from the code. Name the file and the function, and quote the few lines that do the work.
3. Show it when a picture says more. Start with the figures already in `docs/images/`, such as `slices.png` and `pile.png`. For a live frame, `bun run snapshot --view top,apart --width 160 --height 100 --scale 6` saves the craft whole and with its slices pulled apart, in `snapshots/`, which git ignores. `bun run states --chart` draws the game's states. To play it, `bun start`, then press E to pull the stack apart in motion.

Nothing changes, so there are no checks to run.

**Report:** plain language and short sentences. Define a term the first time you use it. End with what to read or try next.

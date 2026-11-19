# Prompt library

Prompts that people have used, or can use, to build games like Dash's "fighter".

| Prompt | Author | What it is |
| --- | --- | --- |
| [Pixel Fighter in one conversation](leviwoyun-pixel-fighter.md) | Levi 卧云 ([@Leviwoyun](https://x.com/Leviwoyun)) | A short prompt with hard limits: one file, no bitmaps, under 40 KB |
| [Pixel Fighter: a full specification](axu-ai-pixel-fighter-spec.md) | 阿旭gogogo ([@axu_ai](https://x.com/axu_ai)) | Twelve sections covering the whole game, with exact numbers and an order of priorities |
| [Prompts written for this kit](kit-prompts.md) | sprite-stack-kit | Requests for an agent working in this repository, and a single-file prompt |

## About Dash's own prompt

Dash has not published the prompt he used. The prompts here were written by other people who looked at his game and described it.

## How to choose

- **You want your own game, and you have a coding agent.** Open this repository in the agent and use the requests in [kit-prompts.md](kit-prompts.md). The agent starts from working code and can check its work.
- **You want to see what a model can do in one go.** Use Levi's prompt for a small result, or axu's for the fullest one.
- **You want to write your own prompt.** Read axu's sections 2 and 12, then start from the single-file prompt in [kit-prompts.md](kit-prompts.md).

## What makes these prompts work

The three prompts agree on a few things:

1. **Name the technique.** "Sprite stacking" for objects, and a heightmap drawn "column by column, near to far" for the ground. Without these words a model reaches for a 3D library.
2. **Forbid the easy way out.** No 3D engine, no WebGL meshes, no libraries, no bitmaps.
3. **Fix the picture first.** A low-resolution buffer written pixel by pixel and scaled up by a whole number.
4. **Ask for a continuous camera.** One camera that slides between views and never cuts.
5. **Give numbers.** Sizes, speeds, times and colours.
6. **Rank the features.** Say what to protect when room runs out.
7. **Ask for the finished file.** No plan, no placeholders.

## Ownership

Levi's and axu's prompts are their own work. They posted them publicly for others to use, and they are reproduced here unchanged, with credit and links. If either author wants a prompt changed or removed, it will be.

The translations and the prompts in `kit-prompts.md` were written for this kit and are under its MIT license.

## Adding a prompt

Open a pull request with a new file here and a row in the table above. Keep the original text exactly as it was posted, say who wrote it, link to where it was posted, and say what result it gave and with which model. See [CONTRIBUTING.md](../CONTRIBUTING.md).

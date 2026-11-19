# Credits

This kit exists because of work that other people did and shared in public. This page says who did what, and links to where they said it.

If you are listed here and want the wording changed, a link changed, or your entry removed, open an issue and it will be done.

## The game this kit learns from

**Dash** · [@creativedash](https://x.com/creativedash) · builder and designer at [@ui8](https://x.com/ui8), building [@ui8forge](https://x.com/ui8forge)

Dash made **fighter**, the game that started all of this, and published it on [UI8 Forge](https://ui8.ai/forge) with remixing switched on.

- The game: [forge.ui8.ai/share/frag_1eb8944c…](https://forge.ui8.ai/share/frag_1eb8944c-57b1-42ca-a909-5c2d7e517c24)
- [The original post](https://x.com/creativedash/status/2122000830895386680), 15 November 2026: "No 3D engine, no polygons, 32 KB of code."
- [The update](https://x.com/creativedash/status/2122389375673913491), 16 November 2026: "dogfights, crashes, explosions, tutorials, gamepad support + a few other tricks". In the same post he says he has decided to build "the real game".

**What this kit takes from his work.** The starter in `examples/starter` was written for this kit after studying his published build, and it follows his approach closely. These are his design:

- the camera formula, and mixing three views by weights so the camera never cuts
- the near-to-far sweep that draws the ground as stacked columns
- the way the slices of a stack are ordered and outlined
- the cockpit view: an eye inside the craft that dissolves the craft on the way in, a banked picture made by drawing the world on a larger sheet and turning it, and a pixel-art cockpit painted once with live instruments and a head-up display drawn over it
- the flight feel

The documents in `docs/` and the skills describe how his code is organised.

**What this kit does not take.** None of his source text, artwork, model data or sound is in this repository. The starter's craft, world, cockpit, instruments, colours and code were made for this kit. His files were published without a license, so this kit downloads them to a git-ignored folder for private study and never redistributes them.

If you build something with this kit, please credit Dash too.

## Prompts

These people recreated the game with a single prompt and then shared the prompt. Their prompts are in [`prompts/`](prompts/README.md), in the original Chinese with an English translation.

**Levi 卧云** · [@Leviwoyun](https://x.com/Leviwoyun)

- [His post](https://x.com/Leviwoyun/status/2122879482327703861), 18 November 2026. He reports recreating the game in one conversation with GPT 6.2 Astra max: a 38 KB file in 42 minutes.
- [The prompt](https://x.com/Leviwoyun/status/2122879638603272234), in his reply. It is the source of the phrase "Comanche-style voxel terrain" for how the ground is drawn.
- In this kit: [`prompts/leviwoyun-pixel-fighter.md`](prompts/leviwoyun-pixel-fighter.md)

**阿旭gogogo** · [@axu_ai](https://x.com/axu_ai)

- [His post](https://x.com/axu_ai/status/2122971403368739242), 18 November 2026. He reports one prompt and one or two rounds of small fixes with GPT-6.2 Astra Ultra: a single 119 KB HTML file after 20 minutes. He adds that the result is still some way from the original.
- [The prompt](https://x.com/axu_ai/status/2122971569417068655), in his reply. It is a full specification in twelve sections, and it ends with an order of priorities that this kit's own prompts borrow.
- In this kit: [`prompts/axu-ai-pixel-fighter-spec.md`](prompts/axu-ai-pixel-fighter-spec.md)

## Explaining the technique

**/OVRFLW** · [@overflowyouknow](https://x.com/overflowyouknow) asked [the question](https://x.com/overflowyouknow/status/2122064423405986146) many people had: "Any game devs wanna explain why they keep saying no 3d models or polygons? How is this possible?"

**Del** · [@TheCartelDel](https://x.com/TheCartelDel) gave [the answer](https://x.com/TheCartelDel/status/2122077610821988537) most people saw: "Sprite Stacking. They used to do this in old SNES JRPG games for bosses that needed to look 3 dimensional".

Other replies shaped how [`docs/how-it-works.md`](docs/how-it-works.md) is written:

- **Benathon** · [@Benathon](https://x.com/Benathon/status/2122115789319033270): "This is awesome! But you did write your own 3D engine". The docs take this as the honest way to describe it: there is a 3D engine, and it is a small one written by hand.
- **Glothr** · [@Terrier909](https://x.com/Terrier909/status/2122105591724376475) asked whether 32 KB meant source code or a compiled build. [`docs/getting-the-source.md`](docs/getting-the-source.md) gives measured sizes for that reason.
- **Jody Hicks** · [@Uncle_Jody](https://x.com/Uncle_Jody/status/2122115901965394369) guessed voxels and pointed out that 32 KB of code is not the same as a 32 KB program.
- **[@WinslowJosiah](https://x.com/WinslowJosiah/status/2122109252865052747)** suggested a Mode 7-like trick for the ground. The docs explain how the real method differs.
- **The SI Maximalist** · [@thesimaximalist](https://x.com/thesimaximalist/status/2122116181985264014) described ray marching as another way to draw a scene with no polygon meshes. The docs explain how the real method differs.
- **Simon Nordon** · [@SimonNordon](https://x.com/SimonNordon/status/2122117409842827541) pointed out that the game does not ship with 3D model files: its shapes are generated when it runs.

## Ports

**Dilip** · [@dilip_ramirez](https://x.com/dilip_ramirez) [ported the game to an ESP32-S3](https://x.com/dilip_ramirez/status/2122108951521357895) microcontroller the day it was posted, and said a video would follow. When he publishes the port, a link belongs here.

## How agents work in this kit

**Lauren Tan** · [@poteto](https://x.com/poteto) · wrote [pstack](https://github.com/cursor/plugins/tree/main/pstack), the set of agent skills she uses at Cursor. This kit takes these ideas from it, and none of its text or code:

- one entry skill that matches the request to a short playbook (`.agents/skills/sprite-stack-game`)
- find out what you can from the repository, and ask the person only what you cannot observe
- write down states and rules, check every path, and report a broken rule as the shortest path in the reader's words (`scripts/states.mjs`, after pstack's formal verification and statechart skills, which use TLA+)
- a check must be seen to fail before it is trusted, and a rule is never weakened to get a pass
- work in small units that each end in a check, and prefer taking away to adding

**Anthropic** publishes guidance on writing for current models, which is why `AGENTS.md` is short and the detail sits in skills that are read when needed: [The new rules of context engineering for Claude 5 generation models](https://claude.dev/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models/) by Thariq Shihipar, and [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).

## Tools and older ideas

- [UI8 Forge](https://ui8.ai/forge) hosts Dash's game and serves the public build that `scripts/fetch-reference.mjs` downloads.
- **Sprite stacking** is a long-standing pixel-art technique. Nobody listed here invented it.
- Drawing a heightmap column by column from near to far is known as **Voxel Space**, after NovaLogic's *Comanche* (1992).
- The random number generator in `examples/starter/src/rng.js` is **mulberry32** by Tommy Ettinger, which is in the public domain.
- The dither pattern in `framebuffer.js` is the standard 4 × 4 **Bayer** matrix.

## This kit

Put together and maintained by [RayFernando1337](https://github.com/RayFernando1337).

## Adding yourself

If you share a prompt, a port, a tutorial or a game built with this kit, open a pull request that adds a line here with your name, your handle and a link. See [CONTRIBUTING.md](CONTRIBUTING.md).

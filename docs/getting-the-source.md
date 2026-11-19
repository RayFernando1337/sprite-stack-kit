# Getting the source of Dash's game

This page explains what the link is, why saving the page does not give you a working game, and the two ways to get the source.

The link: <https://forge.ui8.ai/share/frag_1eb8944c-57b1-42ca-a909-5c2d7e517c24>

Everything here was checked on 18 November 2026 against published revision 43. Forge can change how it serves projects at any time.

## What the link is

It is a public **project** on [UI8 Forge](https://ui8.ai/forge). Forge is a desktop app that gives coding agents such as Claude Code, Codex and Cursor a visual workspace. A Forge Cloud project is a small React app that an agent builds and Forge hosts.

Dash set this project's sharing to "Anyone can view and remix". The short address `remix.ui8.ai/fly` redirects to the same page.

The game itself is a React 19 component, plus a renderer written by hand in plain TypeScript.

## Why the saved HTML does not run

When you save the share page from your browser, you get Forge's own web app, not the game.

- The saved file contains no game code. It is a shell that loads about 60 script files.
- Those scripts are addressed as `/assets/index-….js` and so on. They only exist on `forge.ui8.ai`, so a copy opened from your disk cannot find them.
- Even with the scripts, the app would then ask Forge's servers for the project, and load the game from there.

So there is nothing to fix in the saved file. The game has to be fetched from where it is actually served.

## Route 1: Remix it in Forge (the official way)

1. Install Forge from <https://ui8.ai/forge> and sign in. Sign-in is a code sent by email.
2. Open the share link and press **Remix**.
3. Forge copies the project into your own workspace as a private, unpublished copy. Your agent can then pull it into your code.

This is what Dash invites people to do, and it is the only way to get the original TypeScript with its types. Use it if you want to build on his project itself.

Source: [Forge docs, Remix](https://ui8.ai/forge/docs#remix).

## Route 2: Read the public build

Dash also published the project to its own address: <https://fly.ui8.dev/>.

That page is about 1 KB of HTML. It loads React from `esm.sh`, loads a small host script from Forge, and then loads the game's modules from ordinary addresses such as `https://fly.ui8.dev/src/lib/jet-model.ts`. No sign-in is needed. Your browser downloads all of these when you play the game.

This kit has a script that downloads the same files:

```sh
npm run fetch-reference
```

It saves them in `reference/creativedash-fighter/`, which is git-ignored. On revision 43 that is 52 files, about 3 MB:

| What | Files |
| --- | --- |
| The game's modules, under `src/` | 13 |
| Build scripts Dash used, under `tools/` | 3 |
| Sound effects (MP3) | 30 |
| The artwork the models were made from (PNG) | 2 |
| `index.html`, `index.css`, `package.json`, `share-metadata.json` | 4 |

The script also writes `MANIFEST.json`, which records every file's address and checksum, and `NOTICE.md`, which says who owns the files.

Use `npm run fetch-reference -- --no-assets` to skip the sound and artwork (about 2.5 MB).

### What the files are

- The modules are **compiled**. Type annotations have been removed and JSX has been converted, so each file is plain JavaScript even though it is still named `.ts` or `.tsx`. Comments and names are intact, and the code is easy to read.
- `share-metadata.json` is Forge's description of the project: every control in its settings panel with its default value, and the list of assets.
- The two PNG files are the four-view drawings of the jet and the pilot that the voxel models were made from. The running game does not load them.

### Running the copy locally

```sh
npm run reference
```

Then open the address it prints. The copy runs unchanged. It still needs an internet connection, because the page loads React from `esm.sh` and Forge's host script from `forge.ui8.ai`.

`scripts/serve.mjs` does two things an ordinary file server would not: it serves `.ts` and `.tsx` files as JavaScript, and it answers Forge's `?module` asset addresses.

### Finding your way around

[reference-map.md](reference-map.md) lists each file, what it does, and where each feature starts.

## What you may do with the files

Dash's project has no license. That matters.

- "Remix" in Forge means "copy this project inside Forge". It is not a license to republish the code somewhere else.
- With no license, the default applies: the code, artwork and sound belong to Dash, and others may not redistribute them.
- Dash has said he is now building "the real game" from this project.

So:

- **Do** read the code and learn how it works.
- **Do** write your own code that uses the same ideas. Ideas and techniques are free to use.
- **Do not** commit his files to a public repository or put them on a website.
- **Do not** copy his code, his jet, his pilot, his cockpit art or his sounds into your own game.
- **Do** credit him when you build something inspired by his game.

If you want to ship his actual code, ask him: [@creativedash](https://x.com/creativedash).

## About "32 KB of code"

People asked whether 32 KB meant source or a compiled build. Dash has not said how he measured it. These are the sizes of the public build, measured on revision 43. The files are compiled but not minified, and they keep their comments.

| What | Size | Gzipped |
| --- | --- | --- |
| The first version's renderer and jet model (`lib/scene.ts`, `lib/jet-model.ts`) | 87.6 KB | 28.1 KB |
| The first version with its cockpit and component (4 files) | 154.7 KB | 48.8 KB |
| Everything the current game loads (10 files) | 365.6 KB | 113.7 KB |
| Sound and artwork (32 files) | 2.54 MB | |

The gzipped first-version renderer is the closest match to 32 KB, but that is a guess. A minified build would be smaller than every figure here.

For comparison, this kit's starter is about 66 KB with comments and about 25 KB gzipped. It does much less.

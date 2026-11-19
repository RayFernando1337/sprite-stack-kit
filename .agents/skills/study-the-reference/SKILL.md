---
name: study-the-reference
description: "How to download, run and read Dash's original 'fighter' game to learn how it does something, without copying it. Use when the user asks how the original works, wants a feature the original has and the starter lacks (enemies, cannon, missiles, dodge and slow motion, crash and ejection, parachute, clouds that part, wake on the sea, glow and film grain, sound, tutorial, touch or gamepad controls, a richer cockpit with radar and parallax), or asks how to get the game's source from the Forge share link."
---

# Studying Dash's game

Dash's "fighter" is the game this kit learns from. Its code is public but has no license. You may read it. You may not copy it.

## Get it

```sh
bun run fetch-reference
```

This downloads the published build into `reference/creativedash-fighter/`. It needs the network. The folder is git-ignored.

- If the folder is already there, read it. Run the command again only to pick up a newer revision.
- If the download fails, tell the user. The page may have moved or been unpublished. Do not look for copies elsewhere. Point the user at the share link in `docs/getting-the-source.md`.

To play it locally, run `bun run reference` and open the address it prints. It needs the network too, because the page loads React from a CDN.

## Find the part you need

Open `docs/reference-map.md` first. It lists every file, the function where each feature starts, and the constants worth reading. Search by function name if a line number is off.

Two renderers are in the download:

- `src/lib/scene.ts` is the first version: flight and three views. It is the easier read. Start here for anything about the camera, the world or the jet.
- `src/lib/eject/scene.ts` is the current version, with combat and ejection. Read it for those.

The files are compiled, so they are plain JavaScript under `.ts` names. The comments are intact and explain intent well. Read them.

`share-metadata.json` lists every setting in the game's control panel with its default. It is the quickest way to see what can be tuned.

The starter already has its own versions of the three views, the rolled cockpit picture and a cockpit with instruments. For those, read the starter first (`camera.js`, `roll.js`, `cockpit.js`). Go to Dash's code for what he does beyond them.

## How to use what you learn

1. Read until you can explain the technique in your own words.
2. Close the file.
3. Write the feature for the kit's code, with the kit's names and structure.

That order matters. Code written while looking at his tends to come out as a copy.

## What you must not do

- Do not commit anything under `reference/`.
- Do not paste his functions, even with names changed.
- Do not use his model data (the encoded jet and pilot), his cockpit art, his colour tables or his sound files.
- Do not move files out of `reference/` into `examples/`, `docs/` or anywhere else.

Constants that describe a technique, such as "eight sky bands", are ideas and are fine to use. Tables of art data are not.

## Give credit

If a feature you add follows a technique from his build, add a line to the entry for Dash in `CREDITS.md` saying which.

## If the user wants his actual code

Tell them the official route: sign in to Forge and press Remix on the share page. That gives them a private copy of his project to build on. `docs/getting-the-source.md` has the steps and explains the licensing.

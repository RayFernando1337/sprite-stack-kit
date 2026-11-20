---
name: study-the-reference
description: "How to download, play and read Dash's original 'fighter' game, without copying it: what makes it fun, and how it does each thing. Use before designing a new game or a fight, to see the bar the game is held to; when the user asks how the original works or says a game is less fun than the original; when the user wants a feature the original has and the starter lacks (enemies, cannon, missiles, dodge and slow motion, crash and ejection, parachute, clouds that part, wake on the sea, glow and film grain, sound, tutorial, touch or gamepad controls, a richer cockpit with radar and parallax); or asks how to get the game's source from the Forge share link."
---

# Studying Dash's game

Dash's "fighter" is the game this kit learns from, and the bar its games are held to. Its code is public but has no license. You may read it. You may not copy it.

## Get it

```sh
bun run fetch-reference   # downloads the published build into reference/creativedash-fighter/
bun run reference         # serves it, to play in a browser
```

Run both from the kit's folder (the `sprite-stack-game` skill says how to find it). Both need the network: the page loads React from a CDN. The folder is git-ignored. If it is already there, read it, and fetch again only for a newer revision.

If the download fails, tell the user. The page may have moved or been unpublished. Do not look for copies elsewhere. Point the user at the share link in `docs/getting-the-source.md`, and work from `docs/reference-map.md`, which describes the game in the kit's own words.

## Before you design: what makes it fun

Play it for a few minutes if you can drive a browser, in every view and through at least one fight. If you cannot, read "What the current renderer adds" in `docs/reference-map.md` and the functions it names. Then write notes in your own words:

- **Each thing the player does, and every answer the game gives to it.** What is drawn, what moves, what shakes, what sounds.
- **How a fight goes, moment by moment.** Finding an enemy, the cannon, the lock and the missile, a missile coming in, the dodge, slow motion, the counter-attack.
- **What each view is for.** What the cockpit gives that the others cannot: the instruments, the radar, the head-up display.
- **What losing looks like.** Damage, the crash, the ejection, the parachute, the rescue.
- **The small things nobody asked for.** Spent cases, clouds that part, a wake on the sea, glow.
- **The numbers behind the feel.** Shots a second, hull, how many enemies, how long a lock takes. The map lists the constants.

These notes are the bar. A new game's brief is written from them, and the finished game is compared with them. For the fight, check them against "Why his dogfight is fun" in the `combat-and-juice` skill.

## Find the part you need

Open `docs/reference-map.md` first. It lists every file, the function where each feature starts, and the constants worth reading. Search by function name if a line number is off.

Two renderers are in the download:

- `src/lib/scene.ts` is the first version: flight and three views. It is the easier read. Start here for anything about the camera, the world or the jet.
- `src/lib/eject/scene.ts` is the current version, with combat and ejection. Read it for those.

The files are compiled, so they are plain JavaScript under `.ts` names. The comments are intact and explain intent well. `share-metadata.json` lists every setting in the game's control panel with its default, which is the quickest way to see what can be tuned.

The starter already has its own versions of the three views, the rolled cockpit picture and a cockpit with instruments. For those, read the starter first (`camera.js`, `roll.js`, `cockpit.js`). Go to Dash's code for what he does beyond them.

## Learn it, then write your own

1. Read until you can explain the technique in your own words.
2. Close the file.
3. Write the feature for the kit's code, with the kit's names and structure.

That order matters. Code written while looking at his tends to come out as a copy.

- Do not commit anything under `reference/`, or move files out of it.
- Do not paste his functions, even with names changed.
- Do not use his model data (the encoded jet and pilot), his cockpit art, his colour tables or his sound files.

Constants that describe a technique, such as "eight sky bands", are ideas and are fine to use. Tables of art data are not.

If a feature you add follows a technique from his build, add a line to the entry for Dash in `CREDITS.md` saying which.

## If the user wants his actual code

Tell them the official route: sign in to Forge and press Remix on the share page. That gives them a private copy of his project to build on. `docs/getting-the-source.md` has the steps and explains the licensing.

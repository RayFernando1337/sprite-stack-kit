# START

**People:** open this folder in your coding agent and say what you want. For example:

> Read START.md and follow it. I want to make a game.

It works the same for "add enemies", "make it a dragon over a desert", "the plane clips through hills" and "teach me how this works". For a new game, the agent studies the original game, asks you a few questions, writes down what you agreed, and builds in small steps that it checks as it goes.

If your agent has skills (Claude Code, Droid, Cursor and others), you can type `/sprite-stack-game` and your request instead. To have that command in a project of your own, run `bunx skills add RayFernando1337/sprite-stack-kit` there. The skill fetches the kit's tools when it needs them.

**Agents:** read `.agents/skills/sprite-stack-game/SKILL.md` and follow it. It matches the request to a playbook. Skills here are plain files, so when one is named, read `.agents/skills/<name>/SKILL.md`.

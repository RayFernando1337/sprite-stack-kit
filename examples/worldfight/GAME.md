# Worldfight

**In one sentence:** Fly a rocket ship over the whole Earth, drop down to the United States and then to San Francisco, and dogfight computer pilots over the city.

**The look:** A chunky pixel rocket ship with a flame. The maps are the real Earth: real coastlines and real mountains, in the kit's stacked-pixel style. Bright daytime. San Francisco has its bay, its hills, a street grid, downtown towers and the towers of its two bridges.

**Views and controls:** From above and from behind. No cockpit. Mouse and keyboard, with touch for steering.

| Do | Mouse or touch | Keys |
| --- | --- | --- |
| Steer | Point | A / D or arrows; W / S to climb and dive |
| Thrusters | Hold | Shift |
| Fire (in the city), roll (elsewhere) | Click | F fires, R rolls |
| Change view | VIEW button | Space |
| Go down a level, over a marked place | DOWN button | Enter |
| Go up a level | UP button | Backspace |

## The three levels

| Level | The map | The marked place to go down |
| --- | --- | --- |
| World | The whole Earth, wrapping east to west | The United States |
| Country | The lower 48 states with their borders | San Francisco |
| City | San Francisco, about 24 km across | None: this is where the fight is |

## First playable

Flying over the world and dropping from world to country to city, and back up, feels good. The camera dives into the place you were over and you come out above it on the next map, heading the same way.

## Features, in order

1. **Real maps, packed small.** A tool (`bun run maps`) downloads open elevation tiles and border lines once, shrinks each level to a small grid, and saves it as packed text in the game's source. The game rebuilds each map when it starts and adds fine detail with seeded noise. The game itself uses no network and no data files.
2. **San Francisco as a city.** Buildings on the real ground: low blocks across the city, towers downtown, and landmarks placed at their real positions (the Golden Gate Bridge and Bay Bridge towers, Sutro Tower, the Transamerica Pyramid, Salesforce Tower, Coit Tower).
3. **The dogfight.** Computer pilots patrol the city, chase you and shoot. You shoot back. Hits, a score, your hull strength, and a win or a loss, all shown in the picture.

## Later

- Real players online. The fight is written so that a pilot is steered by inputs, whoever sends them.
- More cities and more countries. The maps tool takes a place and a size, so a new place is a new line.
- Real building footprints. This version places landmarks by hand and fills the rest by rule.
- A cockpit view, sound, a gamepad, a bridge roadway (the ground has one height per pixel, so only the towers stand).

## Always true

- Every pixel of every frame is drawn, on every level and half-way between levels.
- You can only go down over a marked place, and only up from the country or the city.
- Left alone, a change of level finishes, and you are then on exactly one level.
- After going down and up again you are over the place you went down from.
- The ship never touches the ground or a building.
- Enemies exist only in the city.
- The score never goes down. Hull strength never goes up, and never below zero.
- A shot that hits an enemy takes one from its hull; an enemy with none left is gone.
- With no hull left the game is lost; with no enemies left it is won; never both.
- The same seed and the same input draw the same frames.

## Limits

Every kit rule holds: no libraries, no WebGL, no network and no image or data files when the game runs. The maps tool uses the network when a map is rebuilt, and its output is committed as source. Laptop first; it must also run on a phone. Map data comes from the Mapzen terrain tiles on AWS Open Data and from Natural Earth, and both get credit.

## How we work

Run to the end and report.

## What the agent could not check here

A real touch device, Safari and Firefox.

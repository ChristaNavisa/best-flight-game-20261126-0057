# ARUNIKA — Island Hop Flight

[![Make.fun — Make the best flight game](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/ChristaNavisa/best-flight-game-20261126-0057/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/ChristaNavisa/best-flight-game-20261126-0057/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A complete, original flight game that runs offline in a desktop browser from its own static files. One sortie, three jobs, one runway home.

## The game

You fly a little prop plane — the *Arunika* — over a procedurally built island: patchwork fields, a river, a road, a town, and a runway cut into the grass. A chase camera follows you; press **C** to sit in the cockpit, where the gauges are lit.

**One sortie, three missions:**

1. **Ring Run** — thread all 5 glowing sky rings in order (+250 each).
2. **Supply Drop** — drop the crate on the yellow circle by the town (+500).
3. **Island Landing** — bring her down soft on runway 09 and stop (+1,000).

Throttle and turn discipline matter: climb bleeds speed, a banked turn eats it faster, and below stall speed the wing gives up and you sink. Fuel drains with the throttle — run dry and you glide to whatever is below. Landings are judged: too hard, too banked, or too fast, and it reads as a crash.

## Controls

| Input | Action |
| --- | --- |
| ↑ ↓ ← → | Pitch and bank |
| W / S | Throttle up / down |
| Mouse | Steer (virtual stick) |
| Space | Drop the crate |
| B | Brake |
| C | Chase / cockpit camera |
| M | Sound on / off |
| R | Restart the sortie |

## Tech

- No engine, no libraries: a custom software 3D renderer (canvas 2D, painter's algorithm, flat shading, distance fog) written for this game.
- The island is deterministic — one fixed seed, so the terrain, town and trees are identical on every load.
- Sound is synthesised with WebAudio (engine hum, wind, chimes). No audio files.
- `game/` is plain static files with no build step and no network requests; `main.ts` copies it plus `screenshots/` to `/output` and writes `dossier.json`.

## Run it

```sh
node serve.ts        # http://localhost:8080 — play in desktop Chrome
MAKEFUN_OUTPUT_DIR=out node main.ts   # hand-in build (byte-identical twice)
```

Screenshots in `screenshots/` are real renders of this game in Chrome (`?shot=1..4` stages each scene).

## License

MIT — see [LICENSE](LICENSE).

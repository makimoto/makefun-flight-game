# makefun-flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/makimoto/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/makimoto/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Sky Harbor — Island Mail Run.** A chase-view flight game in the browser: take the mail plane Petrel off from Sky Harbor island, thread six glowing mail rings over the archipelago, drop the parcel low over the Beacon Islet lighthouse, and land back home into the wind. Throttle discipline matters — the tank is finite — and a bent arrival costs hull. Full instrument panel (attitude, airspeed, altimeter, compass tape, fuel and hull), wind gusts on the approach, and a flight report that grades the sortie. Played with keyboard and mouse, no network, no build step. The screenshots in `screenshots/` are single frames of one canonical flight simulated through the game's own physics and mission code, so every number on them agrees.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

To hand the game in the way the grader does:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---
<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>

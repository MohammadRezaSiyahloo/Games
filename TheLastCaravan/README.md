# The Last Caravan

![Mara Voss, Bram Holt, Iona Reed, and Tomas Vale cross a stone bridge with a draft horse and covered wagon.](docs/images/cover-banner.webp)

**One wagon. A dying kingdom. Get your people home.**

The Last Caravan is a single-player survival strategy game for the browser. Guide four travelers from Hearth Camp to the Last City. Choose which roads to risk, keep the wagon moving, and decide what you can spare when someone asks for help.

## Features

- **Route planning.** Compare travel time, rations, wagon wear, and weather across branching routes.
- **Illustrated encounters.** Read the scene in comic panels, weigh each choice, and revisit the outcome in the Journal.
- **Crew management.** Assign duties, treat injuries, recruit at settlements, and build bonds around the campfire.
- **Wagon upgrades.** Choose two upgrades and balance their benefits against the timber and coins you have left.
- **Replayable expeditions.** Choose a starting caravan and a seed, earn achievements, and replay completed runs.
- **English and Persian.** Switch languages in the header or Settings. Persian uses right-to-left layout and Persian numerals.

## Gameplay

Follow one expedition from a choice at Pinewatch to a crossing in the Frostmarch. The previews are illustrated with route names, costs, and outcomes from the game.

### A choice at Pinewatch

Illustrated encounters show what each choice costs. Spend medicine on a stranger, share a ration to help Tomas finish his letter, or save those supplies for the next leg. Some decisions open routes later in the journey. The **Journal** records the story alongside the impact on supplies and travelers.

![The Fever encounter and its three choices. Giving Iona a dose costs one medicine, raises each traveler’s morale by ten, and can lead to Reedkeeper Crossing.](docs/images/road-encounter.webp)

### Over Glacier Pass

Use the **World Map** to compare travel time, food and water costs, wagon wear, and departure weather. A shorter pass can save a day and still leave you worse off if it damages the wagon. Settlements offer a chance to trade before the next stretch.

![Day 3 expedition atlas. Glacier Pass takes one day from Pinewatch, costs three food and four water, and wears the wagon down by 22 points. A mountain squall is forecast.](docs/images/expedition-atlas.webp)

### From the road diary

The diary breaks each leg into days and records the actual effects of travel. Open the **Journal** to revisit those entries and the choices you made, including what happened to Tomas’s letter.

![The road diary records a rainy day on the way to Pinewatch, the food and water used, and the wagon wear. A Letter for Lina shows the choice to share a ration or carry the unfinished letter.](docs/images/road-diary-and-letter.webp)

### By the fire

At **Camp**, cook, forage, treat injuries, repair the wagon, and reassign duties when someone needs time to recover. Share a watch to build bonds, or talk by the fire to hear a traveler’s story. Injuries can disable a role’s benefits and change the cost of travel.

![The four travelers around camp, with illustrated cards listing Mara’s scouting, Bram’s guarding, Iona’s medicine, and Tomas’s ration savings.](docs/images/camp-ledger.webp)

### In town and at the workshop

At a settlement, spend coins on food, water, medicine, and timber, or sell spare timber. Some settlements offer recruits. At camp, choose two wagon upgrades and weigh their benefits against the supplies you have left.

![Pinewatch traders, a wheelwright fitting an ironbound wheel, and ledgers showing prices, recruits, and all five wagon upgrades.](docs/images/market-and-workshop.webp)

## Run results

The final roll call shows who reached the Last City, who fell, and a memory from the road. It also records what happened to Tomas’s letter.

<details>
<summary>See how this expedition ends</summary>

![Journey’s End at the Last Well. The empty wagon and undelivered letter accompany the final crew roll call and route record.](docs/images/journeys-end.webp)

</details>

<a name="run-locally"></a>

## Quick start

Use **Node.js 22.18 or later** and a modern browser. From the root of a local clone of this repository, run:

```sh
cd TheLastCaravan
npm ci
npm run dev
```

If your terminal is already in `TheLastCaravan/`, start with `npm ci`. Open the URL printed by Vite. The game runs entirely in the browser.

## Expedition routes

| Route             | What to expect                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **The Far Road**  | The longest journey, with three possible opening encounters, late markets and supply caches, and a crossing unlocked by an early decision. |
| **The Long Road** | Supply detours, a ridge bypass, and weather that changes as time passes.                                                                   |
| **The Road East** | A shorter expedition with fixed road conditions.                                                                                           |

Choose a route, starting caravan, and optional seed under **New expedition**. **Records** tracks completed runs and achievements. Replay a recent run’s seed from its record, or choose one of the starting caravans you’ve unlocked.

## Controls

| Screen              | What to do                                                                      |
| ------------------- | ------------------------------------------------------------------------------- |
| **World Map**       | Select a destination to preview the leg, then choose **Travel** when ready.     |
| **Road encounters** | Read the panels and select a response. Each option lists its costs and effects. |
| **Camp**            | Manage supplies, crew duties, injuries, conversations, and wagon upgrades.      |
| **Journal**         | Open previous travel days and encounter outcomes.                               |

Select **How to play** in the header for the in-game guide.

## Saves and settings

- **Saves.** Your expedition, records, and settings are stored in the browser for that site. Use **Settings → Portable saves** to export or import a JSON backup.
- **Language.** Switch between English and فارسی in the header or settings. Persian uses a right-to-left layout, Persian numerals, and translated dialogue. Noto Sans Arabic is bundled. If you have a licensed copy of the Peyda variable webfont, place it at `src/fonts/Peyda.woff2` before starting or building.
- **Graphics and sound.** The campsite uses Babylon.js and WebGL, with an illustrated fallback. Settings include sound, volume, and campsite animation.

## Project layout

| Path                                             | Responsibility                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `src/game.ts`, `src/content.ts`                  | Expedition state, travel, camp, trading, encounters, and save migration. |
| `src/frontier.ts`, `src/far-road.ts`             | Route variants, weather, detours, and story-dependent crossings.         |
| `src/main.ts`, `src/views.ts`, `src/style.css`   | Browser interface and player actions.                                    |
| `src/chronicle*.ts`, `src/letter.ts`             | The illustrated diary and Tomas’s letter.                                |
| `src/camp-scene.ts`, `src/audio.ts`              | 3D camp rendering and game audio.                                        |
| `src/profile.ts`, `src/backup.ts`, `src/fa-*.ts` | Run records, portable saves, and Persian translations.                   |
| `public/`, `docs/images/`                        | Runtime artwork and fonts, and README previews.                          |
| `tests/`                                         | Regression tests.                                                        |

## Development

```sh
npm run format:check
npm test
npm run build
npm run preview
```

Use `npm run format` to apply Prettier formatting. The build type-checks TypeScript and writes the static game to `dist/`. Use `npm run preview` to check that build locally.

## Deployment

Serve the contents of `dist/` over HTTP. Asset paths support a site root or a repository subpath, including GitHub Pages.

The bundled Noto Sans Arabic font license is included in [public/fonts](public/fonts/NotoSansArabic-LICENSE.txt).

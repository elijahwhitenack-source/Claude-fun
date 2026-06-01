# ASTRARI — PROGRESS

Session-by-session tracker. Read this (and `ASTRARI_MASTER_BRIEF.md`) at the start of every session.

---

## Current architecture (after Session 5)

```
astrari/
├── index.html              # Vite entry shell (head, body DOM, module + SW registration)
├── vite.config.js          # Single-file build via vite-plugin-singlefile
├── package.json / lock     # vite + vite-plugin-singlefile (devDeps)
├── public/                 # copied verbatim to dist/ (manifest.json, sw.js, icon-192/512.png)
├── scripts/make-icons.mjs  # one-off icon generator (needs sharp; not a build dep)
├── .github/workflows/deploy.yml   # build + deploy to GitHub Pages on push to main
└── src/
    ├── style.css           # all game CSS (imported by game.js)
    ├── constants.js        # TILE, ELEM, RAR, POOL, champDef, GEAR, RECIPES, SKILLS, RESINFO, WEATHERS
    ├── utils.js            # $, $$, clamp, lerp, fmt, dist, sleep, shade
    ├── rng.js              # mulberry32 seeded RNG
    ├── glow.js             # cached glow sprites (replaces ctx.shadowBlur)
    ├── particles.js        # pooled particle system (500), bursts
    ├── quests.js           # QS enum, FLAGS, QUEST defs incl. Act 1 + NPC arcs (pure data)
    ├── story.js            # dialogue trees, visions, Caelun, NPC bios (pure data)
    └── game.js             # world, render, combat, UI, quest + dialogue/vision/Caelun engine
```

Build: `npm run dev` (localhost:5173) · `npm run build` → self-contained `dist/index.html` (~95 KB).

Dev hooks on `window` (harmless in prod, used for perf work): `__perf` (render-time/fps),
`__bench(n)` (sync render benchmark, visibility-independent), `__tp(x,y)` (teleport),
`__time(t)` (set day-clock), `__spawnFx(type)` (test particles).

---

## Session 1 — Repo Restructure + PWA Setup — 2026-05-31

### Completed
- Vite project (vanilla) with `vite-plugin-singlefile` → one self-contained `dist/index.html`. `base: './'` for the GitHub Pages subpath.
- Extracted `src/style.css` and `src/game.js` from the old single `astrari.html`; new `index.html` is a thin shell loading `src/game.js` as a module.
- Verified game plays **identically** (town, gather nodes, crafting/skills panels, minimap, weather) in both dev and the built single-file output. No console errors.
- Real ES-module extraction of the cleanly-decoupled layers: `constants.js`, `utils.js`, `rng.js` (data + pure helpers, never reassigned — low risk).
- PWA: `manifest.json`, versioned service worker (`astrari-v2`, network-first for navigations so new builds are picked up, cache-first for assets, old caches purged on activate), canvas/SVG-generated 192 & 512 icons, SW registration + manifest link in `index.html`.
- GitHub Actions `deploy.yml`: `npm ci && npm run build` then official Pages deploy (`upload-pages-artifact` + `deploy-pages`).
- Removed legacy root `astrari.html` (history preserved in git).

### Decisions / deviations from the brief
- **Single-file output uses `vite-plugin-singlefile`** rather than only the brief's rollup `inlineDynamicImports` (which still emits a separate JS file). Same goal — one self-contained HTML — achieved more reliably.
- **Deep module decomposition (entities/render/systems/ui/story) is DEFERRED.** The brief's 25-file tree was not fully realized this session, *on purpose*. ~20 mutable globals (`now`, `nodes`, `interior`, `inBattle`, `fade`, world arrays, weather buffers…) are **reassigned** across what would become separate modules. A true fine-grained split requires housing all of them in shared state objects and rewriting every reassignment — a high-risk big-bang rewrite that conflicts with the brief's own rule ("game must play identically"). Safer to carve these out **opportunistically** as each system is touched in later sessions. `game.js` remains the tightly-coupled core for now.
- **Deploy uses the official GitHub Pages actions** (Pages source = "GitHub Actions") instead of `peaceiris/actions-gh-pages` (gh-pages branch). Cleaner, no extra branch.

### Known issues
- None. Game runs identically; build + PWA verified locally **and live**. The live Pages HTML is byte-for-byte identical to the locally verified `dist/index.html` (sha256 008f24fe…). manifest.json / sw.js / icon-512.png all serve 200.

### Next session notes / action items
- ✅ DONE: GitHub Pages **Source = "GitHub Actions"** is set; auto-deploy on push to `main` is live at https://elijahwhitenack-source.github.io/Claude-fun/ . (Note: switching the source needs a fresh Actions run to become active — a push/empty-commit re-triggers it.)
- localStorage key is still `astrari2`; saves persist across the restructure on the same origin. (Local dev on a new port = fresh save — expected.)
- Session 2 (rendering optimization) is the natural place to begin carving `render/*` modules out of `game.js`, introducing the shared `clock`/`world`/`fx` state objects that make the rest of the decomposition safe.
- `scripts/make-icons.mjs` needs `sharp` (`npm i --no-save sharp`) only if icons are regenerated; not required for normal build.

---

## Session 2 — Rendering Optimization — 2026-06-01

### Completed
- **Perf instrumentation** — `__perf` (render-time + fps) and `__bench()` (synchronous render benchmark; needed because the headless preview backgrounds the tab and pauses `requestAnimationFrame`, so live FPS reads 0).
- **Glow sprite cache (`glow.js`)** — replaced all 13 `ctx.shadowBlur` uses with pre-rendered radial-gradient sprites. This was the single biggest win.
- **Cached tile layer** — `drawTileLayer()` renders visible tiles to an offscreen buffer, rebuilt only when the camera crosses a tile boundary or every ~90 ms (keeps water/lava/ice/ember animation alive), then blits. `drawTile()` now takes a target context.
- **Pooled particle system (`particles.js`)** — 500 pre-allocated particles, batched by color. Hooks: gather spray, level-up ring (world canvas), combat hit sparks + arena hit-flash/shake (DOM). Replaced the old DOM `burstWorld`.
- **Dynamic lighting (`drawLighting`)** — offscreen darkness layer with light pools punched out (`destination-out`) + colored warmth (`lighter`): player, forge (orange, flickers), shrine/codex (purple), market (warm), crystal nodes (blue), boss auras (red). Scales with `dayTint()`; absent in daytime. Night darkness moved here out of `drawWeatherOverlay`.
- **Screen effects** — static vignette (cached), per-biome color grade (tundra/ember/crystal/lake/mountain), screen shake (`addShake`, decays in loop; triggered on encounter start, bigger for bosses), combat arena hit-flash.

### Measured (desktop render ms/frame, median; ~5× slower on mid mobile)
| Scene | Baseline | Final | Speedup |
|---|---|---|---|
| Town | 2.1 | ~0.8 | 2.6× |
| Crystal Hollows | **21.2** | **1.9** | **11×** |
| Forest (dense) | 8.6 | 1.5 | 5.7× |
| Emberwaste | 7.5 | 0.6 | 12× |

Crystal Hollows was >16.6 ms (sub-60fps) even on desktop before; now everything is sub-2 ms (≈8–10× mobile headroom). Lighting adds ~0.1 ms; vignette+grade ~0.3 ms.

### Decisions / deviations from the brief
- **Layered DOM canvas stack (2A) → offscreen tile buffer instead.** Same per-frame win (tiles redraw ~10×/s not 60×/s) without splitting the single `#game` canvas into 4 stacked DOM canvases or rewiring pointer events — lower risk, and the benchmarks show it's enough.
- **Deferred (2C spatial grid, 2D avatar cache, 2H weather offscreen, 2I/2J budget/draw-list):** with everything already sub-2 ms there's no measurable need, and the avatar cache's bob/face animation complicates cache keys. To be done opportunistically if a future scene actually needs it.
- **Combat is a DOM modal**, so combat "particles" are DOM sparks + arena flash/shake (the world-canvas shake fires on the encounter-start clash, before the modal covers the field).
- Module decomposition of the coupled render core into `render/*` is still deferred (see Session 1 note) — but `glow.js` and `particles.js` are real new modules, advancing the structure.

### Known issues
- None. No console errors; build clean (~95 KB single file). All effects verified via screenshots (crystal/town day+night, particles mid-flight, lighting pools).

### Next session notes
- Session 3 is UI/visual polish (panel transitions, combat UI, HUD). Good moment to also start carving `render/*` modules now that `glow`/`particles` set the pattern.
- Dev hooks (`__bench`/`__tp`/`__time`/`__spawnFx`) ship in prod — harmless, keep for ongoing perf work; strip later if desired.

---

## Session 3 — Visual Polish + UI Overhaul — 2026-06-01

### Completed
- **3A — panel transitions:** modal slide-up + fade on enter, slide-down + fade on exit (pure CSS via `#modal`/`.mbox` — `closeModal` still just toggles `.show`). Card hover/active inner glow, `h2.gold` gradient header utility for legendary content.
- **3C — combat UI:** full-width **boss health bar** at top of boss fights; **damage numbers** scale + crits go large/gold (`.float-dmg.crit`); **HP damage-chip** bars (ghost trail lags the fill); **status-effect badges** on unit portraits; low-HP bar color; **animated victory screen** with staggered loot reveal (rarity-colored gear, level-up callout, Continue + 4.2s auto-advance).
- **3B — HUD:** resource counters animate (count-up tween + pop) via `setRes`; **active-skill XP bar** in the HUD (icon + progress + level, tracks `S.activeSkill` set in `gainXp`); warden-level **pulse** on level-up.
- **3E — gather feedback:** circular **progress arc** with skill icon around the node (replaces the center text prompt); **`+N` float anchored to the node**; depletion **poof** + respawn **sparkle** via the particle system.
- **3D — champion portraits:** per-element radial gradient behind each portrait (`champBg`), idle **bob** (CSS), **legend cards pulse**, prominent level badge, gold name + glow for legendaries in detail view.
- **3G — bag:** equipped items **glow** in their gear color; **compare mode** shows stat diff vs equipped (`gearDiff` → green ▲ / red ▼) on every unequipped item.

### Deferred (documented, not done)
- **3F — map blending** (per-tile biome boundary gradients): skipped. The Session-2 cached tile buffer makes per-tile gradient blends costly to recompute, and water/lava already animate — low ROI. Revisit if the map gets a bigger art pass.
- **3B stretch** — minimap fog-of-war, compass rose, region labels: skipped (needs persistent per-tile visited tracking; bigger than the rest of 3B).

### Known issues
- None. All 6 dock panels verified open→interact→close with no console errors. Boss bar, victory screen, champion portraits, bag compare verified via screenshots. Build clean (~111 KB single file).
- Combat is hard to screenshot mid-fight (fast async + headless tab pauses rAF); verified via frozen-state hooks + DOM assertions instead.

### Next session notes
- Session 4 is the **quest engine** (state machine, objective hooks, story flags, journal UI) — pure systems, no story content yet. Migrate the existing 4 bounty quests onto it.
- Gameplay test hooks (`__fight`/`__victory`/`__gather`/`__arc`/`__giveGear`) were removed after use; perf/visual hooks (`__perf`/`__bench`/`__tp`/`__time`/`__spawnFx`) remain.
- Reminder: the modules use inline `on*` handlers → any new panel function called from inline HTML must be added to the `Object.assign(window, {...})` block near the boot section.

---

## Session 4 — Quest System Architecture — 2026-06-01

### Completed
- **4A/4C — quest engine + flags** (`quests.js` data + engine in `game.js`):
  - `QS` enum (LOCKED/AVAILABLE/ACTIVE/COMPLETE/CLAIMED). State in `S.qs[id]={s,o:{objId:cur}}`, flags in `S.flags`. Both migrated in `load()`.
  - Engine: `qStatus`, `isUnlocked`/`condMet` (quest_complete, combat_level, skill_level, flag, biome_visited, boss_defeated), `checkUnlocks` (auto-activates newly-unlocked quests with a toast), `updateObjective(type,target,amount)` (target `'*'`=any; `skill_level` uses set-max not add; auto-completes when all objectives met), `claimReward` (grants astral/shard/mats/items/xp + sets flags + repeatable re-offer), flag helpers `setFlag/getFlag/hasFlag`.
- **4B — objective hooks** wired into: gather (`gatherNode` + fishing), kill + boss_defeated (`endBattle`), summon (`doSummon`), craft (`craft`), skill_level (`gainXp` on level-up), talk (`talkNPC` by role), reach (first-visit biome in `stepPlayer` → `visitBiome`). `checkUnlocks()` runs on boot.
- **4D — journal + tracker**: tabbed **Quest Journal** (Active / Completed), grouped by chain (Story/Biomes/People/Skills/Bounties) with per-objective progress bars, reward previews, Claim buttons; main-chain cards get the gold glow. Persistent **active-objective tracker** overlay (`#questtracker`, top-left, tap → journal).
- **Content** (demo, not story): migrated the 4 bounties (Harvest/Blooded/Answer the Call/Hollow Bane, repeatable) + a 3-step **main chain** (First Light → A Wider World → Sharpen the Edge) with a real unlock chain + `WANDERER`/`FORGE_LEARNED` flags, two biome quests gated on the `WANDERER` flag, one NPC quest, one skill quest.

### Verified
- Full cycle end-to-end: summon ×5 advanced "Answer the Call" → COMPLETE → Claim granted reward + repeatable reset to 0/5. All 6 dock panels still open/close; tracker overlay + journal render; no console errors. Build clean (~119 KB).

### Deferred (documented)
- **Daily quests** (reset cadence), **Lore Journal tab**, and **flag-timeline visualization**: no content sources yet (lore tablets arrive Session 6). The schema supports `daily`/`repeatable`; wire the reset when daily content exists.

### Next session notes
- Session 5 = **Act 1 story content** (dialogue system, vision system, Caelun encounter, the 5 Act-1 quests + NPC arc stubs). The quest engine, flags, and `talk`/`reach`/`kill` objective types are ready to carry it.
- New inline-handler fn this session: `claimReward` (added to the `Object.assign(window,…)` block; replaced the old `claimQuest`).

---

## Session 5 — Story Content: Act 1 + Dialogue System — 2026-06-01

### Completed
- **5A — dialogue system** (`story.js` DLG trees + engine in `game.js`): full-screen `#dlg` overlay with a rendered NPC portrait (`portraitSpec` → `drawAvatar`), speaker name, **typewriter** text (skippable; advances in the loop via `dlgTick`), choice buttons (`flagSet`/`vision`/`next`), tap-to-advance. `talkNPC` now routes through it with a give → progress → turn-in flow tied to the quest engine.
- **5B — vision system** (`showVision`): fade-to-white desaturated overlay, **Yvalethi rendered as a tall luminous figure** (`drawYvalethi`), italic caption, auto-logged to the lore journal.
- **5C — Caelun encounter** (`spawnCaelun`/`caelunTalk`): a special world entity (NOT in `npcs[]`, so off the minimap) with drifting void-thread particles, his own dialogue with player **choices**, leaves after speaking, logged. Spawns when `a1_voice` is active.
- **Lore Journal** (`panelLore`, Menu → Lore): lists discovered visions + the Caelun record. State in `S.lore`.
- **5D — Act 1 quests** (replaced the demo main chain): First Light (Lune) → The Weight of the Thread (Vael, vision) → The Southern Margin (Sef) → Lune's Locked Archive (Lune) → The First Voice (Caelun). Each with give/turn-in dialogue; visions at 1.1/1.2; Caelun at 1.5. New objective types wired: `caelun`; quests can be NPC-given (`npc`/`startDlg`/`doneDlg`/`vision`) or field-`auto`-completed.
- **5E — NPC arc stubs**: one quest each for Borin/Vael/Lune/Quill/Sef, gated on Act-1 completion (`quest_complete a1_voice`) so they don't collide with the main chain's NPC usage.

### Verified
- Dialogue overlay (Lune portrait + typewriter), vision (Yvalethi figure + caption), Caelun (portrait + 2 choices + leaves), lore journal (vision + Caelun logged), Act-1 tracker objectives, all 6 dock panels, no console errors. Build clean (~139 KB). Temporary story test hooks removed after use.

### Deferred (documented)
- The "Root Shard ritual minigame" (1.2) and physical world-placed shard pickups (1.4) are abstracted to attune-at-Shrine / gather-2 for now — no new interactable objects placed. Lore-tablet reading + flag-timeline viz still await Session 6.
- Dialogue `condition` (per-line flag gating) field is in the schema but unused so far.

### Next session notes
- Session 6 = **world expansion + biome depth** (bigger map, biome mechanics, 64 lore tablets, new interactables, town expansion). Lore tablets will finally feed the `read` objective type + the Lore Journal's tablet section.
- Inline-handler fns added this session: `panelLore`, `dlgChoose` (in the `Object.assign(window,…)` block).
- NPC↔quest binding: `talkNPC` finds the first quest with `q.npc===role` that's ACTIVE/COMPLETE. Keep only one story quest per NPC active at a time (the chain + arc-stub gating already ensures this).

# ASTRARI — PROGRESS

Session-by-session tracker. Read this (and `ASTRARI_MASTER_BRIEF.md`) at the start of every session.

---

## Current architecture (after Session 2)

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
    └── game.js             # world, render, combat, UI, systems — still the coupled core
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

# ASTRARI — PROGRESS

Session-by-session tracker. Read this (and `ASTRARI_MASTER_BRIEF.md`) at the start of every session.

---

## Current architecture (after Session 1)

```
astrari/
├── index.html              # Vite entry shell (head, body DOM, module + SW registration)
├── manifest.json           # (in public/) PWA manifest
├── vite.config.js          # Single-file build via vite-plugin-singlefile
├── package.json / lock     # vite + vite-plugin-singlefile (devDeps)
├── public/                 # copied verbatim to dist/
│   ├── manifest.json
│   ├── sw.js               # service worker, cache 'astrari-v2', network-first nav
│   ├── icon-192.png
│   └── icon-512.png
├── scripts/make-icons.mjs  # one-off icon generator (needs sharp; not a build dep)
├── .github/workflows/deploy.yml   # build + deploy to GitHub Pages on push to main
└── src/
    ├── style.css           # all game CSS (imported by game.js)
    ├── constants.js        # TILE, ELEM, RAR, POOL, champDef, GEAR, RECIPES, SKILLS, RESINFO, WEATHERS
    ├── utils.js            # $, $$, clamp, lerp, fmt, dist, sleep, shade
    ├── rng.js              # mulberry32 seeded RNG
    └── game.js             # everything else (world, render, combat, UI, systems) — single module
```

Build: `npm run dev` (localhost:5173) · `npm run build` → self-contained `dist/index.html` (~88 KB).

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

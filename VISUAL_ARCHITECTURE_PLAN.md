# ASTRARI — Visual Architecture & Refactor Plan
*Prototype browser RPG → commercial-quality 16-bit-inspired indie RPG*
*Target: Browser · GitHub Pages · PWA · mobile-first · 60 FPS*

---

## 0. Executive verdict (read this first)

**Three decisions up front, each grounded in the current build:**

1. **Keep the hybrid: Canvas 2D for the world, DOM/CSS for the UI. Do not adopt WebGL, PixiJS, or Phaser now.**
   The world already renders in immediate-mode Canvas 2D at **0.2–0.5 ms/frame** (measured via `__bench`) — i.e. ~3–5% of the 16.6 ms 60 FPS budget. The renderer is *not* the bottleneck. Adding a WebGL stack buys nothing the scene currently needs and costs the single-file PWA its simplicity and bundle size.

2. **The gap to "commercial 16-bit" is the *art language*, not the engine.**
   Golden Sun / Chrono Trigger look the way they do because of (a) **authored, palette-cohesive tilesets with autotiled transitions**, (b) **multi-frame sprite animation**, and (c) a **deliberate light/colour model**. All three are achievable in Canvas 2D. The single biggest perceived-quality lever available right now is **terrain blending + a unified master palette** — not a new renderer.

3. **One strategic fork to choose: keep the procedural-vector aesthetic, or invest in authored pixel-art tilesets.**
   - *Procedural-vector* (current): can reach **"cohesive premium indie"** (think Moonlighter-lite / a stylised Core Keeper) with the phases below. No art-production burden.
   - *Authored tileset*: required for **true pixel-perfect** Chrono/Golden Sun fidelity. Adds a real art pipeline (atlas + 47-blob autotiler + sprite sheets). It's an *additive* track (Phase 6) — it does not require rewriting anything in Phases 0–5.
   - **Recommendation:** execute Phases 0–5 first (they improve *both* futures), then decide on Phase 6 with real screenshots in hand.

> Net: **no rewrite, no engine migration, no framework.** Everything below fits inside the existing `src/game.js` immediate-mode renderer + the existing `style.css`/DOM UI.

---

## 1. Current architecture audit

| Concern | Today | Verdict |
|---|---|---|
| World render | Immediate-mode **Canvas 2D**, single `#game` canvas | Keep |
| Tile layer | One offscreen buffer, **full-viewport rebuild every ~90 ms** to animate water/lava | **Refactor** (see 0/Phase 0) — this is the main inefficiency |
| Lighting | Offscreen darkness canvas, `destination-out` punch + `lighter` colour tints | Keep + extend |
| Glow | Cached radial sprites (`glow.js`) replacing `shadowBlur` | Keep — exactly right |
| Particles | 500-slot pooled, batched by colour | Keep |
| Depth sort | Single `draws[]` sorted by `y` each frame | Keep, formalise into layers |
| UI | **DOM + CSS** (HUD, dock, modals, dialogue, journal) | Keep DOM |
| Combat | **DOM panel** (`.arena`, units are DOM nodes) | Keep DOM + add a canvas FX layer |
| Build | Vite → **single `dist/index.html`** via `vite-plugin-singlefile`; PWA + SW; GH Pages | Keep — constrains dependency choices |
| Frameworks | **None** (vanilla JS modules) | Keep |

**Conclusion:** the architecture is already the "hybrid Canvas + declarative-UI" pattern that the brief asks whether to adopt. The work is to *deepen* it, not replace it.

---

## 2. Technology decision matrix (the explicit asks)

| Option | Benefit here | Cost | Verdict |
|---|---|---|---|
| **Move UI from DOM → Canvas** | none | loses crisp text, accessibility, fl/box layout, dev speed; re-implements buttons/scroll | ❌ **No** — DOM UI is a strength |
| **Canvas 2D sufficient?** | proven at this scene scale (sub-ms) | — | ✅ **Yes** |
| **WebGL** | real-time normal-mapped lighting, >5k particles, shader post (bloom/CRT/palette-cycle) | reimplement renderer + lighting + caches; bundle; debugging | ⚠️ **Only** if Phase 6 wants shader post on authored art. Not now |
| **PixiJS** | batched sprites, scene graph, filters | ~350–450 KB, breaks single-file ethos, re-architect immediate-mode draw, rebuild lighting/caches you already own | ⚠️ **Defer.** Reconsider *only* alongside Phase 6 authored atlases + a desire for bloom/displacement filters |
| **Phaser** | full game framework | = the rewrite you forbade; duplicates your gameplay systems | ❌ **No** |
| **React (UI only)** | declarative UI, component reuse | bundle + build complexity; UI is already functional vanilla DOM | ⚠️ **Optional/DX-only.** Not a visual lever. Use Preact if UI complexity explodes; otherwise skip |
| **Hybrid Canvas + React** | the "right" shape in principle | you already have the hybrid (Canvas + vanilla DOM); React is just one UI impl | ✅ **You're already here** — React is optional sugar |

**TypeScript note:** orthogonal to visuals. A JS→TS migration is a DX/maintainability choice with zero pixel impact — out of scope for this plan.

---

## 3. The fifteen improvement areas → concrete techniques (all Canvas 2D)

### 3.1 Rendering architecture improvements
- **Split the tile cache** into a *static ground bake* (rarely rebuilt) + a thin *animated-liquid pass* (water/lava/ice each frame). Today every grass tile's wildflowers/moss/edges are re-rendered ~11×/s only to animate water. Stop that.
- **Chunked baking:** bake ground in **8×8-tile chunks** keyed by chunk coord; scrolling only bakes newly-revealed chunks. Eliminates the per-frame full-viewport redraw.
- **Fixed-timestep sim + interpolated render:** decouple update (e.g. 60 Hz logical) from draw; interpolate positions. Removes micro-jitter on 90/120 Hz and throttled mobile frames.
- **Formal layer pipeline:** replace ad-hoc ordering with an explicit ordered list of layer functions (see 3.3).

### 3.2 DOM vs Canvas — *settled:* hybrid stays.

### 3.3 Layered rendering (explicit z-bands)
```
L0  sky / biome base gradient (+ parallax distant band)
L1  static ground (baked, chunked)
L2  ground detail + terrain blends/transitions (baked into L1 chunk)
L3  animated liquids (per-frame thin pass)
L4  ground decals + contact shadows (blob/directional)
L5  depth-sorted sprites: props · trees(trunks) · buildings · NPCs · player · enemies
L6  overhead canopy (tall tree tops / eaves that OCCLUDE actors beneath)
L7  particles (world)
L8  lighting composite (darkness punch + colour + bloom)
L9  weather (rain/fog/aurora)
L10 post: vignette, biome grade, heat-shimmer
L11 DOM UI (HUD, dock, journal, dialogue, combat)
```
The new piece is **L6 overhead occlusion** — when the player walks "behind" a tall tree/building, its top is drawn *after* the player. Cheap, hugely improves spatial readability (Stardew/Chrono hallmark).

### 3.4 Terrain richness
- **Master palette:** 18–24 colour master ramp; every biome derives a 3–5 step ramp from it (shadow→base→light→rim). Replaces today's many hand-picked hexes with a cohesive system → instant "art-directed" feel.
- **Three-tone materials:** shadow / mid / light per material, consistent light direction.
- **Macro value-noise:** sample low-frequency value noise per region so a meadow is subtly drier/lusher in patches (breaks the "one texture" read at the *region* scale, not just tile scale).

### 3.5 Terrain blending (top-3 perceived win)
- **Procedural transitions (no art needed):** where two materials meet, bake a **dithered border** using an ordered **Bayer 4×4 matrix** (the canonical 16-bit transition look) plus a soft inner fringe. Generalises the grass↔road edge work already shipped to *all* material pairs (grass/sand, sand/water, grass/snow, ash/lava…).
- **(Authored track) 47-blob autotiling:** if Phase 6 tilesets land, add a bitmask autotiler so corners/edges select the right transition tile.

### 3.6 Vegetation density
- **Three strata:** baked ground cover (grass tufts/clover, into L2) · depth-sorted midground (bushes, ferns, rocks) · canopy (L6).
- **Density maps, clustered:** scatter from per-biome density fields with clustering (Poisson-ish) rather than uniform random — copses, meadbacks, clearings. Reads as *designed*, not generated.

### 3.7 Animated foliage
- **Global wind field:** one wind vector + gust noise `wind(t, worldX)`. *Everything* foliage samples it — grass tufts, tree canopies (already sway), bushes, banners, hanging signs, even drifting particles — so motion is **cohesive** across the screen. Implement as a horizontal shear keyed to height (more sway up top). Near-free.

### 3.8 Lighting quality
- **Two-pass model (extend current):** (a) day/night **coloured ambient** ramp (dawn amber → noon neutral → dusk rose → night blue-green, already partly done) over (b) additive light map from sources.
- **Colour + cookies:** coloured lights with proper additive falloff (have it); add **flicker cookies** (torches/lanterns/forge already flicker — unify amplitude/temperature).
- **Faux directional shading:** bake a cheap per-sprite "lit side" so actors/props catch the ambient light direction (sun by day, nearby source by night) — sells volume without normal maps.
- **Cheap bloom (optional, gated):** downsample the light map ½→¼, blur, add back. One extra offscreen; gate behind a quality flag + DPR cap for low-end.

### 3.9 Shadows
- **Directional blob shadows:** skew/stretch the cached soft shadow by **sun azimuth** (long at dawn/dusk, short at noon, cool-tinted at night). Already have soft cached shadows — just drive length/angle from `S.clock`.
- **Contact AO:** a darker inner core under trees/buildings/props grounds them further.

### 3.10 Environmental depth
- **Parallax + atmospheric perspective:** a distant silhouette/sky band scrolling slower; desaturate+lighten faraway terrain bands.
- **Vertical layering:** cliffs/edges with drop-shadows; the L6 overhead occlusion; foreground occluders (a near bush the player passes behind).

### 3.11 Building visuals
- Already storytelling (foundations, weathered roofs, per-kind props). Next: **baked ambient occlusion** at the base seam, **consistent ¾ volume** (one light direction across all faces), **window parallax**/interior glimpse, and silhouette cleanup. Stays in the current vector approach; authored facades only if Phase 6.

### 3.12 Sprite presentation (big jump)
- **Animation system:** even **2–4 frame** walk / idle-breathe / attack cycles transform perceived quality vs today's single-bob. 
- **Frame-cache bake:** pre-render the vector avatars to **offscreen per-frame sprite caches** (per facing × frame). Cheaper per draw than re-running vector ops, and unlocks outline / hit-flash / palette-swap tinting on the cached frame.
- **State juice:** hit-flash (white tint), squash/stretch on land, selection rim (already have rim light).

### 3.13 Combat visuals
- Keep the DOM arena (it's good and accessible). Add a **transparent canvas FX layer over the arena** for: elemental impact bursts, slash arcs, **hit-stop** (2–4 frame freeze on big hits), screen-shake (have it), and a colour language per element. Add **telegraphs** before enemy hits. This is where "juice" lives — disproportionate perceived-quality return.

### 3.14 UI presentation
- Already journal-themed. Next: **9-slice ornate frames** (bake one decorative border, stretch via CSS `border-image` or a baked canvas), **custom icon glyphs** (replace emoji ◈/✦/⚖ with consistent canvas/SVG glyphs so the iconography is *yours*), an optional **pixel display font** for headers only (e.g. `m5x7`/`Press Start 2P`, used sparingly to avoid kitsch), and consistent motion (the micro-animations already added).

### 3.15 Performance
- Wins from Phase 0 (static bake + chunking) *create* headroom; spend it on Phases 1–4.
- **DPR cap** on mobile (render at ≤1.5× then upscale) — big fill-rate saver on retina phones.
- **Cache every gradient** (build once, reuse) — never create `createRadialGradient`/`createLinearGradient` in the hot loop.
- **OffscreenCanvas + Worker** (optional) for chunk baking so a newly-revealed chunk never hitches the main thread.
- Keep particle/draw batching; add a per-frame draw-call budget assert in the bench harness.

---

## 4. Refactor roadmap — exact implementation order

> Each phase is independently shippable, verified with the existing `npm run build` + `__bench` + screenshot loop, and deployed byte-verified to Pages. No phase requires a rewrite.

**Phase 0 — Pipeline foundations** *(low–medium risk, enables everything)*
1. Static ground bake + chunked cache (kill full-viewport rebuilds).
2. Animated-liquid thin pass.
3. Explicit layer pipeline + **L6 overhead-canopy occlusion**.
4. Fixed-timestep update / interpolated render.
5. Global **wind field** module.

**Phase 1 — Terrain identity** *(highest perceived ROI)*
6. Master palette + per-biome ramps.
7. **Terrain blending** (Bayer-dither transitions for all material pairs).
8. Macro value-noise region variation.

**Phase 2 — Vegetation & depth**
9. Three-strata vegetation + clustered density maps.
10. Wind-driven animated grass cover.
11. Parallax distance band + atmospheric perspective.
12. Directional day/night shadows.

**Phase 3 — Lighting & atmosphere**
13. Coloured ambient ramp polish + flicker-cookie unification.
14. Faux directional sprite shading.
15. Optional gated **bloom**.

**Phase 4 — Sprites & combat juice**
16. Frame-cache sprite bake + 2–4 frame walk/idle/attack.
17. Hit-flash / squash-stretch.
18. Combat canvas FX layer: elemental bursts, slash arcs, hit-stop, telegraphs.

**Phase 5 — UI finish**
19. 9-slice ornate frames + custom icon glyph set.
20. Optional pixel display font (headers only).

**Phase 6 — OPTIONAL authored-tileset fork** *(decide after Phase 5 screenshots)*
21. Tileset atlas + 47-blob autotiler; keep procedural *generation*, map output to tiles.
22. Authored sprite sheets via the frame-cache slots from Phase 4.
23. *Only here* reconsider a thin WebGL/Pixi post layer if bloom/palette-cycling/CRT is wanted.

---

## 5. Risk assessment

| Item | Risk | Mitigation |
|---|---|---|
| Static-bake + chunk refactor (Phase 0.1–0.2) | **Medium** — touches the core render loop | Land behind the existing bench + screenshot-diff harness; keep the old path until parity confirmed |
| Overhead-canopy occlusion | Low | Pure draw-order; gate by "is actor under this footprint" |
| Fixed-timestep | Low–med | Standard accumulator; cap max frame delta to avoid spiral-of-death |
| Master palette re-colour | **Low danger, real time cost** | It's data + tuning; do biome-by-biome, screenshot each |
| Terrain blending bake | Medium (naïve neighbour bakes can be slow) | Precompute edge masks; only on chunk bake, not per-frame |
| Bloom on low-end | Med perf | Quality flag + DPR cap; off by default on small screens |
| PixiJS / WebGL adoption | **High cost, low current reward** | Recommend against until Phase 6 demands shaders |
| Single-file PWA constraint | Any heavy dep breaks it | Keep deps ~zero; everything above is hand-rolled Canvas 2D |
| Mobile fill-rate (bloom + many lights) | Med | DPR cap, light-count budget, profile on a real mid phone |

---

## 6. Expected visual improvements (perceived)

| Phase | What the player notices |
|---|---|
| **0** | Smoother scrolling, no tile seams, player correctly passes *behind* trees/buildings, perfectly steady 60 FPS on high-refresh + throttled phones. (Foundational, subtle.) |
| **1** | **The headline jump.** Biomes read as one cohesive, art-directed palette; materials *blend* instead of butting edges — immediately "16-bit indie," not "prototype." |
| **2** | World gains depth and life: clustered groves, rippling grass under a single wind, distant haze, shadows that move with the sun. |
| **3** | Mood: golden dawns, rose dusks, glowing nights with soft bloom — Children-of-Morta atmosphere. |
| **4** | Characters feel *alive* (walk cycles, breathing) and combat feels *impactful* (hit-stop, elemental bursts) — the Chrono-Trigger "game feel." |
| **5** | The interface reads as a crafted artifact (ornate frames, bespoke icons) matching the world's quality. |
| **6 (opt.)** | If pursued: true authored pixel-art fidelity (Golden Sun tier). |

**Bottom line:** Phases 0–1 alone move the game from "polished prototype" to "looks like a real indie RPG." Phases 2–4 are where it becomes *memorable*. None of it requires leaving Canvas 2D, the single-file PWA, or the existing gameplay code.

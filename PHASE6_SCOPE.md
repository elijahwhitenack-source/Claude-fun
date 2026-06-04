# Phase 6 — Authored Pixel-Art Tileset Fork — Scoping Doc

*The optional "true 16-bit fidelity" track from `VISUAL_ARCHITECTURE_PLAN.md`. This is a **strategic fork**, not a quick win — read the TL;DR before committing.*

---

## 0. TL;DR / recommendation

**Phase 6 is 20% engineering, 80% art production.** The code (autotiler, sprite-atlas pipeline, frame animation) is a few focused sessions and *reuses everything we already built* in Phases 0–5. The hard, slow, expensive part is **sourcing a cohesive pixel-art asset set** — which I can't author for you; you'd commission, license, or AI-generate + hand-clean it.

**It also has two real downsides** the other phases didn't:
1. **Bundle/PWA tension** — real PNG assets fight the single-file build (could balloon from ~190 KB to multiple MB, or force dropping the single-file model).
2. **Loss of uniqueness** — the current procedural-vector look is *distinctive*; generic authored pixel art can read as an "asset flip." You'd be trading a unique style for higher *fidelity* but lower *originality* unless the art is bespoke.

**My recommendation: do NOT commit the whole game to authored art up front.** Instead:
- **Run a de-risking spike (6A):** build the autotiler + sprite-atlas pipeline behind a feature flag, drop in **one** authored test biome + the warden sprite, and **A/B it against the current look in-engine.** Decide with a real side-by-side, not a guess.
- **Or take the middle path:** keep the procedural world, author **only the hero/champion sprites** (what players stare at most) — ~80% of the perceived "real RPG" gain for ~10% of the asset volume and none of the bundle blow-up.

---

## 1. What Phase 6 actually is

Golden Sun / Chrono Trigger look the way they do because every tile and sprite was **hand-painted by artists** on a fixed palette. Phase 6 = replacing our *procedurally-drawn* vector terrain/sprites with *authored raster art* + the systems to render it (autotiling, sprite sheets).

**Critically: it does not replace Phases 0–5.** The chunk cache, dithered-blend system (becomes autotiling), wind, occlusion, directional shadows, day/night colour ramp, bloom, particles, combat juice, and journal UI are all **compositing/behaviour layers that sit on top of the base art** — vector or raster. Authored art slots into the *same* pipeline. Nothing we shipped is thrown away except the procedural *draw* functions (`drawTile` details, `drawTree`, `drawRock`, `drawAvatar` body, `drawBuilding`…), which become atlas blits.

---

## 2. Asset inventory (what would need to exist)

| Category | Items | Frames each | Rough tile/sprite count |
|---|---|---|---|
| Ground tiles | 13 materials (grass, forest, plain, path, sand, water, deep, snow, ice, ash, lava, mountain, crystal) | + transitions | **47-blob autotile × ~6 base materials ≈ 280 tiles** (or simpler 13-tile "fuzzy" sets) |
| Water/lava/ice anim | 4–5 animated materials | 3–4 frames | ~16 tiles |
| Trees / foliage | sapling, medium, ancient, glowing, conifer × biome tints | 2-frame sway optional | ~12–20 sprites |
| Rocks / crystals / plants | per biome | static | ~15 sprites |
| Props | signpost, lantern, cart, marker, shrine, ruin, fence, tools, campfire, bones, glow-flower | static + a few animated | ~12 sprites |
| Buildings | forge, shrine, market, lodge, codex | static (+ window glow) | ~5 multi-tile sprites |
| **Actors** | warden, ~6 NPC skins, ~5 champion classes, ~3 monster families × 3 variants | **idle(2) + walk(4) + attack(2–3) × 4 facings** | **~25 sheets, hundreds of frames** |
| UI | optional 9-slice frame, icons | — | small |

The **actors are the biggest art lift** (animation × facings × roster). The **ground autotile set** is the second.

---

## 3. Asset sourcing options

| Option | Quality | Cost | Time | Uniqueness | Licensing risk |
|---|---|---|---|---|---|
| **Commission a pixel artist** | ★★★★★ | $$$ | weeks | bespoke (high) | clean (work-for-hire) |
| **License a pack** (itch.io / commercial 16-bit RPG sets) | ★★★★ | $–$$ | days | low (asset-flip risk) | **must verify** redistribution + web-deploy rights |
| **AI-generate + hand-clean** | ★★–★★★★ | $ | days | medium | **murky** — check model TOS for commercial/deploy use; consistency is the hard part |
| **Hybrid** (license a base ground set; author ASTRARI-specific celestial bits: crystals, glow-flora, shrines, the warden) | ★★★★ | $$ | medium | medium-high | mixed — track per-asset |

**Note for a public GitHub-Pages deploy:** the game is shipped publicly, so every asset needs a license that permits **redistribution in a web build**. Free ≠ redistributable. This must be locked down *before* art goes into the repo.

I (Claude) **cannot author the raster art**. My role in Phase 6 is: build the pipeline + autotiler + animation system, integrate whatever art you supply, slice/pack atlases, wire animation states, and tune. **You own the art-sourcing decision.**

---

## 4. Engineering work (sub-phases) — and how it reuses Phases 0–5

**6A — Pipeline + autotiler spike** *(build first, ~1 session)*
- **Asset loader:** load a sprite atlas (PNG + JSON frame map) with a Promise gate before first render; placeholder/fallback to procedural if missing.
- **47-blob autotiler:** 8-neighbour bitmask → transition-tile lookup. **Bakes into the existing Phase-0 chunk cache** — autotiled `drawImage`s replace `drawTile`+`blendEdges`. The chunk system, anim-liquid pass, and view-eviction all stay.
- **Feature flag** `RENDER_MODE = 'vector' | 'tiles'` so we can A/B in-engine without deleting the procedural path.
- Drop in ONE authored biome to validate.

**6B — Authored ground tileset** *(art-gated)*
- Full material set + transitions through the autotiler. Day/night grade, bloom, biome grade, lighting all composite on top unchanged.

**6C — Authored actor sprites + animation system** *(art-gated, biggest)*
- Frame-based animator: state machine (idle/walk/attack) × facing → atlas frame. The **Phase-4 `mv` move-amount + combat hooks map directly onto animation states.** `drawAvatar` becomes "blit current frame"; keep procedural as fallback for un-authored entities.
- Enables proper attack frames in combat (replaces/augments the DOM-canvas unit portraits).

**6D — Authored props/buildings/foliage** *(art-gated)*
- Swap `drawTree`/`drawRock`/`drawProp`/`drawBuilding` for atlas blits; keep wind sway (UV/shear or 2-frame), occlusion, directional shadows.

**6E — Optional WebGL/Pixi post layer** *(only if shader FX wanted)*
- With authored atlases, batched sprite draw + **shader bloom / palette-cycling / CRT / water displacement** become worthwhile. Still optional — Canvas 2D `drawImage` of atlas frames is fine at our draw volumes. Adopt **only** if you want true shader effects; it's the one place Pixi earns its bundle cost.

---

## 5. The single-file / PWA bundle tension (the key technical risk)

Today: `vite-plugin-singlefile` inlines everything into one ~190 KB `dist/index.html`. Authored art is **raster bytes** — a full tileset + actor sheets can be **0.5–5 MB+**.

Two ways forward, pick one:
- **(a) Keep single-file, accept the size** — base64-inline the atlas. Simple, still one file, still works offline immediately. But a multi-MB HTML file is slower to first-paint and ugly to diff. Viable for a modest atlas (a few hundred KB).
- **(b) Drop single-file → multi-asset build** — ship `index.html` + `atlas.png` + `atlas.json`, let the **service worker precache** them (we already have a SW). Standard, scales to large art, better caching. Costs the "one file" elegance and needs the SW precache list maintained + the GH-Pages deploy to include assets (it already deploys `dist/`).

**Recommendation: (b)** if you go full authored (6B+); **(a)** is fine for the 6A spike or the middle-path hero-only sheets.

---

## 6. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Art sourcing stalls the whole phase** | High | Spike (6A) needs only 1 biome + 1 actor; middle-path needs only the warden + champs |
| **Single-file/PWA bundle blow-up** | High | Decide (a) vs (b) up front; SW precache for (b) |
| **Asset-flip / generic look** (lower uniqueness than current) | Medium-High | Bespoke or hybrid art; author the ASTRARI-specific celestial elements |
| **Licensing for public deploy** | High (legal) | Verify redistribution + web rights per asset *before* commit |
| **Throwaway of procedural code** | Medium | Feature-flag both paths; keep procedural as fallback, don't delete |
| **Animation roster scope creep** (frames × facings × roster) | Medium | Start 4-frame walk only; add attack frames later; fallback procedural for minor NPCs |
| **Mobile memory** (large atlases) | Medium | Atlas size budget, texture compression, DPR cap |

---

## 7. Effort sizing (engineering only — art is separate & variable)

- **6A spike (autotiler + atlas loader + flag + 1 test biome):** ~1 session. *Highest information-per-effort — do this first.*
- **6B full ground tileset wiring:** ~1 session once art exists.
- **6C actor animation system + warden/champs:** ~1–2 sessions once sheets exist.
- **6D props/buildings:** ~1 session.
- **6E WebGL/Pixi post (optional):** ~2+ sessions; only if shader FX wanted.

**Art effort dwarfs all of this** and is the real schedule driver.

---

## 8. Recommended path

1. **Decide the strategic question first:** do you want bespoke ASTRARI pixel art (commission/hybrid) or are you experimenting? If experimenting → **middle path or spike only.**
2. **Run 6A as a spike** behind `RENDER_MODE`: autotiler + atlas pipeline + one authored biome + the warden sprite, single-file-inlined. **A/B it in-engine.**
3. **Look at the side-by-side.** Honest test: does authored pixel art actually look *better* than what we have, or just *different*? The current procedural look is already cohesive premium-indie.
4. **If yes → commit:** choose bundle strategy (b), source the full set, roll out 6B→6D.
   **If no / not worth the art cost → ship the middle path** (authored hero/champ sprites only on the procedural world) and stop. Big perceived win, tiny asset footprint, no bundle/licensing headache.

---

## 9. Decision checklist (answer these to greenlight)

- [ ] **Art source** decided? (commission / license / AI+cleanup / hybrid)
- [ ] **Budget & timeline** for art acceptable?
- [ ] **Licensing** permits public web redistribution?
- [ ] **Bundle model:** keep single-file (small atlas) or go multi-asset + SW precache?
- [ ] **Scope:** full authored world, or middle-path actors-only?
- [ ] **Uniqueness:** comfortable trading the distinctive procedural style for standard 16-bit fidelity?

Once these are answered, **6A is the first thing I'd build** — it's the cheapest way to turn this whole decision from a guess into an A/B you can see.

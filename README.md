# ASTRARI — Echoes of the Verdant Stars

A mobile-first browser RPG set among the drifting isles of a shattered World-Tree. Single self-contained build, installable as a PWA.

**▶ Play:** https://elijahwhitenack-source.github.io/Claude-fun/ — add to your home screen to install.

---

## The game

You are a **Starwarden** — a scholar, not a warrior — on the floating isle of Skyhaven after the World-Tree *Yvalethi* shattered and death itself stopped working. The unburied dead drift as the **Hollow**. The greatest Warden scholar, **Caelun**, believes dissolution is mercy. You carry a Root Shard that remembers what she actually meant.

- **Open world** — tap to move (BFS pathfinding) across 8 biomes (meadow, forest, mountains, Frostpeak Tundra, the Emberwaste, Crystal Hollows, plains, the lake), each with its own look, enemies, and hazards.
- **Skills & crafting** — Mining, Woodcutting, Foraging, a hold-and-slide **Fishing** minigame, and Smithing at the Forge/Shrine. Skill mastery milestones unlock perks.
- **Auto-battle combat** — a **team of 3** champions beside your Warden vs the Hollow, with an elemental rock-paper-scissors, status effects, **named elites**, biome bosses with **phase changes**, gear set bonuses, and champion synergies.
- **Gear** — weapons (5 types), armor tiers, and relics that change your stats *and* your avatar; ward charms negate biome exposure.
- **Story** — a full quest engine drives Acts 1–4 with a typewriter dialogue system, Root-Shard **visions**, the recurring **Caelun** encounters, a moral choice, lore tablets, and **two endings**.
- **Atmosphere** — dynamic day/night lighting, weather (clear → storm, fog, aurora), per-biome ambient audio + procedural SFX, particles, and screen effects.

Progress saves automatically to `localStorage` (`astrari2`).

---

## Develop

Built with **Vite**; ships as one self-contained `dist/index.html` via `vite-plugin-singlefile`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/index.html (single file) + PWA assets
```

Source in `src/`: `game.js` (the core), plus modules `constants.js`, `utils.js`, `rng.js`, `glow.js`, `particles.js`, `quests.js`, `story.js`, and `style.css`. PWA bits in `public/`. Push to `main` auto-deploys to GitHub Pages (`.github/workflows/deploy.yml`).

Project plan: `ASTRARI_MASTER_BRIEF.md` · session-by-session log: `PROGRESS.md`.

---

*Built incrementally, session by session, for fun.*

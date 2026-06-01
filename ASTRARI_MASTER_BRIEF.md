# ASTRARI — MASTER PROJECT BRIEF
### Claude Code Bible — Read this at the start of every session.

---

## HOW TO USE THIS DOCUMENT

This is the single source of truth for the ASTRARI project.
Every Claude Code session should begin with:
1. Read this file in full
2. Read `PROGRESS.md` (tracks what's done, what's next, known issues)
3. Execute the assigned session scope
4. Update `PROGRESS.md` when done
5. Commit with a clear message referencing the session number

**Never skip reading PROGRESS.md. Never start a new session scope if the previous one has unresolved broken functionality.**

---

## PROJECT OVERVIEW

**Game:** ASTRARI — Echoes of the Verdant Stars
**Type:** Mobile-first browser RPG, single HTML file compiled via Vite
**Platform:** GitHub Pages, installed as PWA on iOS/Android
**Current state:** Working prototype (~2000 lines, single index.html)
**Goal:** Full production-quality game — story, systems, graphics, performance

---

## REPO STRUCTURE (target, set up in Session 1)

```
astrari/
├── index.html              # Shell only — imports bundle
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── icon-192.png            # PWA icon
├── icon-512.png            # PWA icon
├── vite.config.js          # Build config — outputs single index.html
├── package.json
├── ASTRARI_MASTER_BRIEF.md # This file
├── PROGRESS.md             # Session progress tracker
└── src/
    ├── main.js             # Entry point
    ├── constants.js        # TILE, MW, MH, all config constants
    ├── state.js            # S (game state), load(), save(), DEF
    ├── rng.js              # mulberry32, seeded RNG
    ├── utils.js            # clamp, lerp, fmt, dist, shade, roundRect
    ├── world/
    │   ├── biomes.js       # BIOMES, biomeAt(), tile constants
    │   ├── worldgen.js     # genWorld(), all node/building/npc/monster placement
    │   ├── pathfinding.js  # bfs(), nearestWalkAdj()
    │   └── spatial.js      # Spatial grid for O(1) entity lookup
    ├── entities/
    │   ├── player.js       # Player object, stepPlayer(), movement
    │   ├── monsters.js     # BOSSES, BIOME_MOBS, spawnMonsters(), wander()
    │   ├── npcs.js         # NPC definitions, talkNPC(), dialogue system
    │   └── champions.js    # POOL, champDef(), champSpec(), summon logic
    ├── render/
    │   ├── renderer.js     # Main render loop, layered canvas setup
    │   ├── tiles.js        # drawTile(), all tile rendering
    │   ├── nodes.js        # drawTree(), drawRock(), drawCrystal(), drawPlant()
    │   ├── avatar.js       # drawAvatar(), drawWeapon(), avatar cache
    │   ├── buildings.js    # drawBuilding(), interior rendering
    │   ├── weather.js      # Weather particles, day/night, lighting
    │   ├── minimap.js      # Minimap rendering
    │   ├── particles.js    # Pooled particle system
    │   ├── lighting.js     # Dynamic lighting layer
    │   └── effects.js      # Screen shake, flash, vignette
    ├── systems/
    │   ├── combat.js       # startEncounter(), resolveBattle(), status effects
    │   ├── gathering.js    # gatherNode(), fishing minigame
    │   ├── crafting.js     # GEAR, RECIPES, craft(), panelCraft()
    │   ├── skills.js       # SKILLS, gainXp(), levelOf(), skillBonus()
    │   ├── gear.js         # equip(), unequip(), wardenStats(), gear icons
    │   └── audio.js        # Procedural audio, ambient system
    ├── story/
    │   ├── questEngine.js  # Quest state machine, unlock conditions, rewards
    │   ├── quests.js       # All quest definitions (main + biome + NPC arcs)
    │   ├── dialogue.js     # NPC dialogue trees, Caelun encounter logic
    │   ├── lore.js         # Lore tablets, vision system, journal entries
    │   └── flags.js        # Story flags, moral choices, persistent decisions
    └── ui/
        ├── panels.js       # All modal panels (bag, craft, skills, etc.)
        ├── hud.js          # Top HUD, dock, prompts, toasts
        ├── battle.js       # Battle modal UI
        ├── codex.js        # Hall of Echoes / bestiary panel
        ├── quests_ui.js    # Quest journal UI
        └── transitions.js # Fade system, interior transitions
```

---

## SESSION PLAN

Complete sessions in order. Do not start Session N+1 if Session N has broken functionality.

---

### SESSION 1 — REPO RESTRUCTURE + PWA SETUP
**Goal:** Clean foundation. Nothing gameplay changes — just architecture.

**Tasks:**
1. Initialize npm project with Vite
   ```
   npm create vite@latest . -- --template vanilla
   ```
2. Configure `vite.config.js` to output a single self-contained `index.html`:
   ```javascript
   import { defineConfig } from 'vite'
   export default defineConfig({
     build: {
       outDir: 'dist',
       assetsInlineLimit: 100000000, // inline everything
       rollupOptions: {
         output: {
           inlineDynamicImports: true,
           manualChunks: undefined,
         }
       }
     },
     base: './'
   })
   ```
3. Split existing `index.html` into the module structure above. Do NOT change any game logic — copy/paste into appropriate files, add imports/exports only.
4. Verify the game runs identically after restructure (`npm run dev`)
5. Add `manifest.json`:
   ```json
   {
     "name": "ASTRARI — Echoes of the Verdant Stars",
     "short_name": "ASTRARI",
     "start_url": "./",
     "display": "standalone",
     "background_color": "#04060c",
     "theme_color": "#04060c",
     "orientation": "portrait",
     "icons": [
       { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
       { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
     ]
   }
   ```
6. Add `sw.js` service worker for offline caching:
   ```javascript
   const CACHE = 'astrari-v1';
   const ASSETS = ['./', './index.html'];
   self.addEventListener('install', e => {
     e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
   });
   self.addEventListener('fetch', e => {
     e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
   });
   ```
7. Register service worker in `index.html`:
   ```html
   <link rel="manifest" href="manifest.json">
   <script>
     if ('serviceWorker' in navigator)
       navigator.serviceWorker.register('./sw.js');
   </script>
   ```
8. Generate simple PWA icons (canvas-drawn, saved as PNG — use a script)
9. Set up GitHub Actions for auto-deploy to GitHub Pages on push to main:
   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with: { node-version: 18 }
         - run: npm install
         - run: npm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```
10. `npm run build`, verify dist output, push to main, confirm GitHub Pages serves correctly
11. Visit on phone, confirm "Add to Home Screen" prompt appears, install, verify fullscreen launch

**Success criteria:** Game plays identically. Installs as PWA. Auto-deploys on push.

---

### SESSION 2 — RENDERING OPTIMIZATION
**Goal:** Locked 60fps. Significant visual improvement. No gameplay changes.

**Tasks:**

**2A — Layered Canvas Architecture**
Replace single `#game` canvas with 4 stacked canvases in `renderer.js`:
- `canvasWorld` — static tiles, redraws only when camera moves (dirty flag)
- `canvasDynamic` — animated tiles, nodes, weather (every frame, culled)
- `canvasEntities` — player, NPCs, monsters, damage numbers (every frame, tight cull)
- `canvasHUD` — minimap, HUD elements (redraws on state change only)

All positioned `absolute` with `z-index` 1–4. Only `canvasEntities` needs `pointer-events`.

Dirty flag system:
```javascript
let worldDirty = true;
let hudDirty = true;
let lastCamX = -1, lastCamY = -1;

function checkDirty() {
  if (cam.x !== lastCamX || cam.y !== lastCamY) {
    worldDirty = true;
    lastCamX = cam.x;
    lastCamY = cam.y;
  }
}
```

**2B — Shadow Blur Replacement**
In `render/nodes.js` and `render/tiles.js`:
- Remove ALL `ctx.shadowBlur` usage
- Replace with `getGlowSprite(col, radius)` cache system:
```javascript
const glowCache = new Map();
function getGlowSprite(col, radius) {
  const key = `${col}-${radius}`;
  if (glowCache.has(key)) return glowCache.get(key);
  const size = radius * 4;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const cx = c.getContext('2d');
  const g = cx.createRadialGradient(size/2,size/2,0,size/2,size/2,radius*1.5);
  g.addColorStop(0, col + 'cc');
  g.addColorStop(1, col + '00');
  cx.fillStyle = g;
  cx.fillRect(0,0,size,size);
  glowCache.set(key, c);
  return c;
}
function drawGlow(ctx, x, y, col, radius) {
  const s = getGlowSprite(col, radius);
  ctx.drawImage(s, x - s.width/2, y - s.height/2);
}
```

**2C — Spatial Indexing**
In `world/spatial.js`, implement bucket grid replacing all linear scans:
- `nodeAt()`, `monAt()`, `npcAt()`, `buildingAt()` all use spatial grid
- Bucket size: 8 tiles
- Rebuild grid after world gen and after entity state changes

**2D — Avatar Dirty Cache**
In `render/avatar.js`:
- Cache rendered avatars to offscreen canvases keyed by `JSON.stringify(spec + face + bobFrame)`
- Evict when cache exceeds 200 entries
- Apply to all NPCs, monsters, champions

**2E — Particle System**
In `render/particles.js`, implement pooled system:
- Pool of 500 pre-allocated particle objects
- `spawnParticle(x, y, vx, vy, life, col, size, type)`
- Types: `spark`, `dust`, `leaf`, `ember`, `crystal`, `blood`, `soul`
- Batch draw by color to minimize state changes
- Replace all existing `burstWorld()` calls with particle spawns

**2F — Dynamic Lighting**
In `render/lighting.js`:
- Offscreen `lightCanvas` composited over world with `source-atop`
- Light sources: player (soft white), forge (orange flicker), shrine (purple pulse), crystals (blue), torches (warm yellow), boss aura (red)
- Night darkness scales with `dayTint()` — pitch black at midnight except near sources
- `destination-out` blend mode to punch light holes

**2G — Screen Effects**
In `render/effects.js`:
- Screen shake: translate canvas by random offset, decay over duration
- Hit flash: white overlay at low alpha for 2 frames on damage received
- Vignette: permanent subtle darkening at screen edges, intensifies at low HP
- Biome color grade: per-biome `fillRect` at 8% opacity (cool blue tundra, red-orange ember, purple crystal, etc.)

**2H — Weather Rewrite**
In `render/weather.js`:
- Offscreen `weatherCanvas`, all particles drawn there, composited in one `drawImage`
- Rain: single `beginPath()` + loop + `stroke()` — no per-drop calls
- Fog: pre-rendered gradient sprites, translated not redrawn
- Aurora: sine-wave gradient bands, cheap

**2I — Frame Budget Management**
In `renderer.js`:
```javascript
const BUDGET_MS = 14;
let frameStart = 0;
function startFrame() { frameStart = performance.now(); }
function overBudget() { return (performance.now() - frameStart) > BUDGET_MS; }
```
Skip decorative-only operations if over budget.

**2J — Pre-allocated Draw List**
Replace `draws.push()` array allocation with pre-allocated fixed array, reused each frame.

**Success criteria:** Smooth 60fps on mid-range mobile. No visual regressions. Lighting system visible at night. Particles on gather/combat.

---

### SESSION 3 — VISUAL POLISH + UI OVERHAUL
**Goal:** Looks like a real mobile game. Feels premium.

**Tasks:**

**3A — UI Design System**
In `ui/` files, implement consistent visual language:
- Animated panel entrances: slide up + fade in (CSS `transform` + `opacity` transition, 200ms)
- Panel exit: slide down + fade out
- Replace all instant modal pops with smooth transitions
- Consistent card styling with subtle inner glow on hover/active
- Gold gradient headers for legendary content
- Rarity color system applied consistently everywhere

**3B — HUD Polish**
- Resource counters: animate number changes (count up/down smoothly)
- Add XP bar visible in HUD for current active skill
- Weather icon animates (rain drops falling in the icon, etc.) — small canvas icons
- Warden level: pulse animation on level up
- Add a compass rose to minimap
- Minimap: fog of war — unexplored areas show dark until visited
- Minimap: named region labels appear after first visit

**3C — Combat UI Rewrite**
- Damage numbers: better typography, scale with damage amount, crits are larger + golden
- HP bars: smooth lerp animation not instant jump
- Status effect icons displayed on unit portraits
- Boss health bar: full-width dramatic bar at top of arena during boss fights
- Combat log: better formatting, color-coded by event type
- Victory screen: animated loot reveal, XP gain animation

**3D — Champion Portrait Improvements**
- Larger render size for champion cards
- Background gradient per element type
- Animated idle bob on portrait (subtle, 2px)
- Rarity border glow animation (legend cards pulse)
- Level badge more prominent

**3E — Gather/Interaction Feedback**
- Progress arc around cursor/tap point during gather (replaces text prompt)
- Resource gain floats from the node not from center screen
- Node depletion: visual wilt/crack animation
- Node respawn: subtle sparkle when it comes back

**3F — Map Improvements**
- Biome boundary gradients (smooth transitions between biome colors)
- Water: animated shimmer more pronounced
- Lava: brighter, more dynamic
- Town: distinct visual identity, more buildings suggested in background
- Path tiles: worn texture with footprint-like marks

**3G — Inventory/Bag UI**
- Gear icons: higher detail, more distinctive per type
- Grid layout option for inventory (toggle list/grid)
- Item tooltip on long-press with full stats
- Equipped items highlighted with element glow
- Compare mode: tap unequipped item shows stat diff vs equipped

**Success criteria:** UI feels polished and intentional. Combat is readable and exciting. Everything animated smoothly.

---

### SESSION 4 — QUEST SYSTEM ARCHITECTURE
**Goal:** Full quest engine. No content yet — just the system.

**Tasks:**

**4A — Quest State Machine** in `story/questEngine.js`:
```javascript
// Quest status enum
const QS = { LOCKED: 0, AVAILABLE: 1, ACTIVE: 2, COMPLETE: 3, CLAIMED: 4 };

// Quest definition schema
const QuestDef = {
  id: String,           // unique
  act: Number,          // 1-4
  chain: String,        // 'main'|'npc_sef'|'biome_forest'|'daily'|'champion_X'
  title: String,
  description: String,
  objectives: [         // array of objective definitions
    {
      id: String,
      type: String,     // 'reach'|'gather'|'kill'|'talk'|'interact'|'read'|'ritual'|'craft'|'skill_level'
      target: String,   // entity/item/skill id
      count: Number,
      current: Number,  // tracked in state
      hidden: Boolean,  // don't show until triggered
    }
  ],
  unlockConditions: [   // all must be true
    { type: 'quest_complete', id: String },
    { type: 'combat_level', min: Number },
    { type: 'skill_level', skill: String, min: Number },
    { type: 'flag', id: String },
    { type: 'biome_visited', biome: String },
    { type: 'boss_defeated', name: String },
  ],
  rewards: {
    astral: Number,
    shard: Number,
    ore: Number,
    wood: Number,
    items: [String],    // gear ids
    flags: [String],    // story flags to set
    unlocks: [String],  // quest ids to unlock
    xp: { skill: String, amount: Number }
  },
  dialogue: {           // optional narrative text shown on complete
    npc: String,
    lines: [String]
  },
  repeatable: Boolean,
  daily: Boolean,
};
```

Quest engine functions:
- `checkUnlocks()` — runs after any state change, unlocks newly available quests
- `updateObjective(type, target, amount)` — called by all game systems
- `completeQuest(id)` — validates, grants rewards, triggers unlocks
- `getActiveQuests()` — returns current quest list for UI
- `getQuestState(id)` — returns QS enum value

**4B — Objective Hooks**
Wire `updateObjective()` calls into every relevant game system:
- Combat win → `updateObjective('kill', monsterType, 1)`
- Gather node → `updateObjective('gather', resourceType, amount)`
- Enter biome → `updateObjective('reach', biomeName, 1)`
- Talk to NPC → `updateObjective('talk', npcId, 1)`
- Craft item → `updateObjective('craft', itemId, 1)`
- Skill level up → `updateObjective('skill_level', skillId, newLevel)`
- Boss defeated → `updateObjective('boss_defeated', bossName, 1)`
- Read lore tablet → `updateObjective('read', tabletId, 1)`

**4C — Story Flags** in `story/flags.js`:
```javascript
// Flag system — persistent decisions tracked in S.flags
const FLAGS = {
  // Act 1
  SKARN_RELEASED: 'skarn_released',
  SKARN_FORCED: 'skarn_forced',
  GELMARA_JOURNALS_COMPLETE: 'gelmara_journals',
  CAELUN_FIRST_MEETING: 'caelun_met',
  // Act 2
  ASHEN_TRUSTED: 'ashen_trusted',
  FIRES_RELIT: 'fires_relit',
  NULLITH_ANSWERED: 'nullith_answered',
  // Moral choices
  TOLD_LUNE_ABOUT_SEF: 'lune_sef_secret',
  SKARN_CHOICE: 'skarn_choice', // 'force'|'release'
  FETCH_OUTCOME: 'fetch_outcome', // 'convinced'|'partial'|'failed'
  // Act 4
  FINAL_CHOICE: 'final_choice', // 'yvalethi'|'caelun'
};

function setFlag(id, value = true) { S.flags[id] = value; save(); }
function getFlag(id) { return S.flags[id] ?? false; }
function hasFlag(id) { return !!S.flags[id]; }
```

**4D — Quest Journal UI** in `ui/quests_ui.js`:
- Tab system: Main / Biome / NPC / Daily / Completed
- Each quest entry: title, description, objective progress bars, reward preview
- Active objectives shown in a persistent small overlay during exploration (top-left, collapsible)
- Lore Journal tab: all vision entries, lore tablet text, Caelun's journal pages as readable documents
- Story flag visualization: timeline of key decisions made

**Success criteria:** Quest engine tracks all objective types. Flags persist. Journal UI shows all quest states. Wire-up tested with the 4 existing bounty quests migrated to new system.

---

### SESSION 5 — STORY CONTENT: ACT 1 + NPC DIALOGUE SYSTEM
**Goal:** Act 1 fully playable with all dialogue, cutscenes, and story beats.

**Tasks:**

**5A — Dialogue System** in `story/dialogue.js`:
```javascript
// Dialogue definition
const DialogueDef = {
  id: String,
  npc: String,
  lines: [
    {
      speaker: String,      // npc name or 'PLAYER' or 'NARRATOR'
      text: String,
      portrait: String,     // npc id for portrait render
      condition: String,    // optional flag condition
      choices: [            // optional player choices
        {
          text: String,
          flagSet: String,
          next: String,     // dialogue id to continue
          questTrigger: String,
        }
      ]
    }
  ]
};
```

Dialogue UI: full-screen overlay with:
- NPC portrait (rendered avatar, large)
- Speaker name
- Text box with typewriter effect (character by character, skippable)
- Choice buttons when applicable
- Skip/advance on tap

**5B — Vision System** in `story/lore.js`:
- Root Shard pulse: triggers vision overlay
- Vision: full-screen fade to white, then a scene rendered in desaturated colors
- Yvalethi rendered as a tall luminous figure (extended avatar renderer)
- Text caption at bottom in italic
- Fade back to game
- Vision logged in Lore Journal automatically

**5C — Caelun Encounter System**
Caelun is a special NPC entity:
- Appears at scripted world locations after specific quest triggers
- Does not appear on minimap
- Has unique visual treatment: normal human avatar but with visible soul-thread corruption (faint void-colored particles drifting off him)
- Conversation always ends with him leaving — no combat, no follow
- His appearances are logged in the Lore Journal

**5D — Implement All Act 1 Quests** (5 quests, see quest definitions in STORY BIBLE section below)
- Quest 1.1: First Light
- Quest 1.2: The Weight of the Thread (Root Shard ritual minigame)
- Quest 1.3: The Southern Margin (Hollow circle discovery)
- Quest 1.4: Lune's Locked Archive (two Root Shard retrieval)
- Quest 1.5: The First Voice (first Caelun encounter)

**5E — NPC Arc Quest Stubs**
Add first quest for each NPC arc (Sef, Borin, Vael, Lune, Quill) — dialogue and objectives defined, rewards working. Full arcs come in later sessions.

**Success criteria:** Act 1 completable start to finish. All dialogue plays correctly. Caelun encounter triggers properly. Visions display. Lore Journal populates.

---

### SESSION 6 — WORLD EXPANSION + BIOME DEPTH
**Goal:** Map feels alive and distinct. Each biome has identity beyond visual.

**Tasks:**

**6A — Map Expansion**
- Increase map from 78×72 to 120×110
- Add 3 new sub-areas within existing biomes (forest echo-grove clearing, tundra Aetherwatch station, ember Ashen settlement)
- Add dungeon entrances (visual only for now — blocked until story unlocks)
- Add the Fraying Edge zone (locked behind Act 2 completion)
- Improve biome boundary blending (gradient tiles at edges)

**6B — Biome Unique Mechanics**
- **Tundra:** Hypothermia timer — standing in tundra without Cold Ward gear slowly drains HP. Warm at bonfires (new interactable). Cold Ward crafted at forge.
- **Emberwaste:** Lava tiles deal damage on contact (already `walk=0` but add damage aura to adjacent tiles). Fire Ward gear negates.
- **Crystal Hollows:** Echo maze — certain paths redirect you if you don't know the pattern (pressure plate tiles that flip walk direction). Pattern learned from lore tablets.
- **Forest:** Echo-grove tiles — walking through triggers brief 3-second vision of the past. Visual effect only (desaturate + ghost overlay).
- **Mountain:** Altitude — movement speed slightly reduced, stamina system (sprinting depletes, recovers at rest).

**6C — Lore Tablets**
- Place 64 lore tablets across all biomes (8 per biome)
- Each is a small glowing stone interactable
- Reading opens a lore entry in the journal
- Biome completion bonus: find all 8 → unlock bonus quest
- Tablet content: pre-shattering world history, Warden records, personal journals, creature lore

**6D — New Interactables**
- Bonfires (tundra, ember): warm/cool player, brief rest animation
- Ancient shrines (ruins in each biome): one-time interaction, small lore reveal + resource reward
- Notice boards (each settlement): daily bounty board, local rumors that hint at quests
- Warden monuments: stone markers with engraved text, key lore pieces

**6E — Town Expansion**
- Add 3 more buildings to Skyhaven: Library (Lune's external workspace), Training Ground (combat skill grinding), Passage Node Workshop (late game)
- Add wandering townspeople NPCs (no quests, ambient dialogue only — 20 lines each, rotate)
- Add day/night town behavior: NPCs go indoors at night, lights appear in windows

**Success criteria:** Expanded map generates correctly. Biome mechanics active and testable. 64 tablets placed and readable. Town feels populated.

---

### SESSION 7 — ENEMY OVERHAUL + ELITE SYSTEM
**Goal:** Every biome has distinct enemy types. Named elites spawn on cycle. Combat is deeper.

**Tasks:**

**7A — Full Enemy Taxonomy**
Implement all enemy variants from the enemy faction design (see ENEMY FACTIONS section):

*Meadow:* Drifters, Mourners, Seekers
*Forest:* Thornwraiths, Echoforms, Grovesingers
*Mountain:* Stone-Walkers, Shardminds, Peakwardens
*Tundra:* Coldwalkers, Frostsingers, Glaciants
*Emberwaste:* Embers, Cinderfused, Ashen Remnants
*Crystal:* Echomirrors, Void-touched, Crystallized

Each variant:
- Unique visual (color scheme, size modifier, one distinctive shape element in avatar renderer)
- Unique behavior in `wander()` and combat
- Unique lore entry in bestiary
- Biome-appropriate drop table

**7B — Named Elite System**
- 24 named elites, 2-3 per biome
- Spawn on 24-hour real-time cycle at fixed locations
- Name generated from pool: `[prefix][biome_word]` (e.g. "Velk the Ashen-Marked")
- Visual: 1.3× size, unique color variant, particle aura
- Bestiary entry auto-generates: "A [type] who [past life fragment]. Now [hollow description]."
- Guaranteed named loot on first kill
- Kill tracker in bestiary

**7C — Boss Phase System**
Rewrite boss encounters to support multiple phases:
- Phase trigger at HP thresholds (configurable per boss)
- Phase transition: brief pause, visual change, new move set
- Phase-specific abilities:
  - Mournroot: Phase 2 floods arena with 3 Hollow Spawn waves
  - Skarn: Phase 2 stone cracks (visual), Phase 3 optional release mechanic
  - Gelmara: Journal reading system during fight (see quest design)
  - Pyrrhaxis: 4 phases, environmental hazards, corrupted champion soul in Phase 3
  - Nullith: Mirror mechanic — fight your own squad

**7D — Combat Ability System**
Add special abilities to combat — triggered, not automatic:
- **Ashen Dissolution:** Unlocked via questline. Weakens Hollow, releases trapped souls mid-fight (visual spectacle). Costs resource.
- **Soul Anchor:** Unlocked via tundra questline. Stabilizes a Hollow instead of defeating it — passes it through nearest node. Different rewards.
- **Warden's Insight:** Passive unlock — shows enemy HP numbers, element weaknesses in UI.
- **Champion Synergies:** 3 matching elements in squad = elemental bonus damage. Full element set = all-element mastery buff.

**7E — World Boss Implementation**
Three world bosses (see WORLD BOSS section):
- The Unnamed Tide
- The Warden's Regret
- Caelun's Shadow (Act 3+ only)
- 72-hour spawn timer
- Patrol routes defined
- Unique 4-phase fights
- Unique loot drops

**Success criteria:** All biome enemy variants spawning correctly. Elite spawn cycle working. Boss phases trigger and transition. At least one world boss implemented and beatable.

---

### SESSION 8 — STORY CONTENT: ACT 2 + NPC ARCS
**Goal:** Act 2 fully playable. All 5 biome boss quests complete. NPC arcs 50% done.

**Tasks:**
- Implement quests 2.1–2.5 (one per biome boss)
- Each with full dialogue, vision sequence, Caelun appearance
- Skarn choice mechanic (force vs release — flag set, reward differs)
- Gelmara journal reading mechanic during combat
- Nullith mirror fight mechanic
- NPC arcs: Sef quests 1–5, Borin quests 1–5, Vael quests 1–5, Lune quests 1–6, Quill quests 1–4
- Champion memory arc system: unlock at level 20, 5 quests per champion
- Implement Sylune, Noctyr, Aurelia memory arcs in full

**Success criteria:** Act 2 completable. All 5 bosses have full story integration. NPC arcs progress through mid-points.

---

### SESSION 9 — PROGRESSION SYSTEMS OVERHAUL
**Goal:** Progression feels meaningful and deep at every stage.

**Tasks:**

**9A — Skill Mastery Milestones**
Each skill gets milestone unlocks at levels 10, 20, 35, 50, 70, 99:
- Mining 10: Detect rare ore deposits (glow on minimap)
- Mining 20: New ore type available (Voidite, only in Crystal Hollows)
- Mining 35: Double ore chance on crits
- Mining 50: Unlock Aetheri ore (exclusive to mountain ruins)
- Mining 70: Soul-ore — rare, used in endgame passage node crafting
- Mining 99: Title: "Deepwarden" + unique cosmetic pick
(Similar depth for all 6 skills plus new skills: Lore, Alchemy, Passage-Weaving)

**9B — New Skills**
- **Lore** (levels by reading tablets, completing quests, vision sequences): Unlocks cipher translations, deeper NPC dialogue options, hidden world interactions
- **Alchemy** (levels by crafting potions at new Alchemy station): New crafting branch — consumables, buffs, status cures
- **Passage-Weaving** (levels by operating passage nodes, post-Act 2): The endgame skill — building and upgrading the Warden Network

**9C — Gear Set Bonuses**
Sets of 3 (weapon + armor + relic from same tier/theme) grant bonus:
- Astralite Set: +15% gathering yield
- Verdantine Set: +20% flora/forest combat
- Voidsteel Set: +25% void damage, +10% all resist
- Glacial Set: Immunity to hypothermia
- Ashen Set: Fire immunity + +30% ember damage

**9D — Champion Synergy System**
- Squad composition bonuses (3 matching elements = 20% elemental damage)
- Role bonuses: 1 Warden + 1 Healer + 1 DPS = balanced buff
- Legendary trio bonus: 3 legends in squad = "Starborn" buff (all stats +15%)
- Caelun's Mirror: specific 3-champion combo unlocks hidden dialogue with Caelun

**9E — Prestige System (Post-Endgame)**
After Act 4 completion (Yvalethi path):
- Warden Network building (see story — place passage nodes across the world)
- Each node placed: permanent passive buff to that biome's yields + reduced Hollow spawn rate
- 32 node slots across all biomes
- Endgame "seasons" — world events every 7 real days, new bounty pool, limited cosmetics

**Success criteria:** Milestones trigger correctly. New skills leveling. Gear sets recognized. Champion synergies applying in combat.

---

### SESSION 10 — AUDIO EXPANSION
**Goal:** Audio feels like a real game soundtrack.

**Tasks:**

**10A — Biome Ambient Themes**
Extend procedural audio to have distinct ambient character per biome:
- Meadow: high open sine tones, gentle
- Forest: lower, denser, slight dissonance
- Mountain: sparse, wind-like filtered noise, high resonance
- Tundra: minimal, cold — mostly silence with occasional high crystal tone
- Emberwaste: low drone, irregular percussion-like transients
- Crystal: harmonic overtones, almost musical, eerie
- Town: warmer, busier, slight reverb

**10B — Combat Audio**
- Hit sounds: short white noise burst filtered differently per element
- Critical hit: brighter, slightly pitched up
- Status effects: each element has a distinct short tone (burn = crackle, freeze = glass, etc.)
- Victory: ascending arpeggio
- Defeat: descending, muffled

**10C — UI Audio**
- Panel open/close: soft click
- Quest complete: bright chime sequence
- Level up: ascending tone + resonance
- Loot drop: sparkle tone, pitch varies by rarity
- Caelun appearance: subtle dissonant undertone begins 5 seconds before he appears

**10D — Dynamic Music System**
- Base ambient layer always playing (current system)
- Combat layer crossfades in during encounters (more percussion, tension)
- Boss layer: distinct, more complex, unique per boss element
- Night layer: slower, darker
- Story moment layer: soft piano-like tones during key story beats

**Success criteria:** Each biome feels audibly distinct. Combat audio lands. UI sounds not annoying.

---

### SESSION 11 — STORY CONTENT: ACTS 3 + 4 + ENDINGS
**Goal:** Complete main story. Both endings implemented. Full emotional payoff.

**Tasks:**
- Fraying Edge zone fully built and populated
- Quests 3.1–3.8 implemented
- Warden Ghost NPC system (dialogue-only, unique visual)
- Caelun's research camp built and interactable
- Quest 4.1–4.4 implemented
- Final boss: Caelun multi-phase fight
- Force vs dissolution ritual ending mechanic
- Caelun's Path ending (Ending A — dissolution)
- Yvalethi's Path ending (Ending B — rebuilding begins)
- Credit sequence both paths
- Complete remaining NPC arcs
- All champion memory arcs
- Post-game Warden Network building mode

**Success criteria:** Both endings reachable and complete. All story content implemented. No dead-end quests.

---

### SESSION 12 — FINAL POLISH + PERFORMANCE AUDIT
**Goal:** Ship-ready. Plays beautifully on mobile.

**Tasks:**
- Full performance profiling on mobile viewport
- Fix any remaining frame rate issues
- Accessibility pass: font sizes, contrast, touch target sizes
- Save system audit: verify nothing is lost on reload
- Edge case testing: what happens at very high skill levels, maxed gear, etc.
- Localization prep: extract all strings to a strings object (no hardcoded UI text)
- Build optimization: verify single-file output, offline functionality
- Service worker update strategy (cache versioning)
- Final PWA audit: Lighthouse score target 90+
- README update with full feature list

---

## STORY BIBLE (SUMMARY — Full version in conversation history)

### THE WORLD
Yvalethi, the World-Tree, was a living lattice of soul-thread woven through everything. When something died, souls passed through her roots and were released cleanly. Wardens were her scholars.

### THE SHATTERING
**Caelun Drey**, the greatest Warden scholar, discovered the Fraying Margin — the Unraveling eating the lattice from outside. His attempt to patch it created a contact point. The Unraveling infected him not with evil but with absolute certainty — his own logic, his own care, reorganized around a conclusion that serves dissolution. He went to unmake Yvalethi directly. She saw him coming. She chose to shatter herself — too scattered to be consumed whole. It bought time.

**The cost:** Death stopped working. No roots to receive souls. They fray, lose shape, become **Hollow** — not monsters, the unburied dead. Every single one.

### THE PLAYER
A Warden archivist. Not a warrior — a scholar. The only one still asking *why*. Carries a Root Shard that pulses with Yvalethi's residual intent. Chosen not for strength but for patience.

### CAELUN NOW
Survived the shattering because the Unraveling held him together. Wanders. Appears at key moments. Reasonable, warm, brilliant, completely convinced that dissolution is mercy. **He is the tragic mirror** — same path, wrong conclusion.

### YVALETHI'S MESSAGE
Hidden in the Memory Shards inside each biome boss. Assembled over Acts 1–2. The message: the lattice regrows from within through souls passing cleanly, not from external repair. She shattered herself into the seeds of the network. The Wardens, rebuilt and distributed, are the mechanism. She built the education into the journey.

### THE CHOICE (Act 4)
- **Yvalethi's Path:** Rebuild the network. Long, uncertain, generations of work. Caelun fights you — not from evil but because he can't tolerate the in-between. Defeated with force or dissolved with mercy (Ashen Ritual). World doesn't look saved — looks like Day 1 of a long project.
- **Caelun's Path:** Agree with him. Dissolution begins. World goes quiet. Everything fades. Credits on an empty, peaceful, dead world. No judgment.

### THE THEME
Grief as corruption. The Hollow are grief made literal. The journey is learning to read what something left behind and finding the message was never about power — it was about trust.

---

## ENEMY FACTIONS (FULL TAXONOMY)

### MEADOW — THE WANDERERS
- **Drifters:** Move in straight lines until obstruction, passive, weakest
- **Mourners:** Stationary, pulse weakens nearby soul-thread, release soul-fragment on death
- **Seekers:** Run toward last heard sound, fast, fragile, terrifying in groups

### FOREST — THE ROOTED
- **Thornwraiths:** Slow, massive, trail thorns (DoT), drop rare wood
- **Echoforms:** Semi-transparent, replay living behavior fragments, attack only when touched
- **Grovesingers:** Don't attack, move toward passage nodes, draw other Hollow toward them

### MOUNTAIN — THE BOUND
- **Stone-Walkers:** Slow, immune to physical, vulnerable to void/ember, drop Aetheri fragments
- **Shardminds:** Geometric movement patterns, explode on death for AoE
- **Peakwardens:** Aetheri champion remnants, hardest mountain enemies, drop legendary materials

### TUNDRA — THE PRESERVED
- **Coldwalkers:** Ancient slow Hollow, high HP, low aggression, drop preserved materials
- **Frostsingers:** Emit meditation frequency, build Coherence status on player (buff)
- **Glaciants:** Ice-absorbed massive Hollow, environmental hazards

### EMBERWASTE — THE COMPOSITE
- **Embers:** Youngest dissolution, swarm behavior, smallest
- **Cinderfused:** 2-3 partially merged Hollow, coordinated attacks
- **Ashen Remnants:** Absorbed grief-practice residue, perform Cooling fragments mid-combat

### CRYSTAL — THE REFLECTED
- **Echomirrors:** Reflect player's last action, counter by changing tactics
- **Void-touched:** Non-linear attack patterns, occasionally ask questions
- **Crystallized:** Inert in geometric formations, puzzle mechanic (activate if broken)

---

## WORLD BOSSES

### THE UNNAMED TIDE
- **What:** Composite of entire pre-shattering fleet that drowned in Aether Lake
- **Patrol:** Lake → Plains
- **Elements:** Water + Void
- **Phases:** 4
- **Drop:** Tidecrown (helmet slot — new slot type)

### THE WARDEN'S REGRET
- **What:** Collective grief of 6 Forest Outpost Wardens
- **Visual:** 6 figures moving in perfect synchronization
- **Difficulty:** Hardest non-final boss
- **Drop:** The Final Entry (staff that records combat history in its lore text)

### CAELUN'S SHADOW
- **What:** The Unraveling's physical avatar, built from Caelun's shed soul-thread over 20 years
- **Unlock:** Act 3+, spawns at the Edge
- **Abilities:** Corrupted version of every elemental status simultaneously
- **Drop:** The Unraveling's Shard (relic — removes all status effects from team)

---

## NPC ARC SUMMARIES

### SEF — "The Last Honest Man" (8 quests)
Was Caelun's most loyal student. Gave him a document that helped unlock the Fraying Margin research — has carried guilt for 20 years. Arc: reveal history with Caelun → find old letters → confession → message relay → teaching new Wardens.

### BORIN — "What Remains" (10 quests)
His entire family became Hollow. Forges to survive psychologically. Arc: reveal through gaps in dialogue → father's hammer recovery → secretly building a passage node → his soul-thread as the key → node activates, two Hollow dissolve, he watches, says nothing, builds the second one.

### VAEL — "The Faith That Survives Doubt" (9 quests)
Maintains Shrine rituals even though Yvalethi is gone. Faith is deliberate, not naive. Arc: meditative quests → public debate with a scholar who challenges her → modifying rituals using Edge research → ritual connects to nascent network for 30 seconds → rewrites the Shrine's founding text honestly.

### LUNE — "Everything Written Down" (12 quests)
Catalogues everything, concludes nothing. Arc: research quests → misfiled document (about her grandmother) → grandmother was the Twelfth Warden who gave Caelun the cipher → find grandmother's ghost at Edge → conversation via recording crystal → Lune writes her first opinion document.

### QUILL — "The Economy of Survival" (8 quests)
Practical to the point of apparent heartlessness. Arc: trade runs → discovers Hollow follow memory-routes (pre-shattering trade routes) → maps the routes → reveals they're his old business partner's routes → names the new inter-biome trade network after his partner.

---

## PROGRESSION DESIGN

### SKILL MILESTONES (every skill, at levels 10/20/35/50/70/99)
Milestones unlock content, not just +yield. See Session 9 for full list.

### NEW SKILLS
- **Lore** — Read tablets, complete quests, experience visions
- **Alchemy** — Craft consumables and buffs at Alchemy station
- **Passage-Weaving** — Post-Act 2 endgame skill, build the Warden Network

### GEAR SETS (3-piece bonuses)
- Astralite Set: +15% gathering yield
- Verdantine Set: +20% flora/forest combat
- Voidsteel Set: +25% void damage, +10% all resist
- Glacial Set: Hypothermia immunity
- Ashen Set: Fire immunity + +30% ember damage

### CHAMPION SYNERGIES
- 3 matching elements: +20% elemental damage
- Legendary trio: "Starborn" buff (+15% all stats)
- Specific combos unlock hidden Caelun dialogue

---

## RENDERING ARCHITECTURE

### FOUR-LAYER CANVAS STACK
1. `canvasWorld` — Static tiles, rebuilds on camera move only
2. `canvasDynamic` — Animated tiles, nodes, weather
3. `canvasEntities` — Player, NPCs, monsters, damage numbers
4. `canvasHUD` — Minimap, resource HUD (rebuilds on state change)

### KEY OPTIMIZATIONS
- Spatial grid (8-tile buckets) for O(1) entity lookup
- Glow sprite cache replaces all `ctx.shadowBlur`
- Avatar dirty cache (keyed to spec+face+bobFrame)
- Pooled particle system (500 pre-allocated)
- Pre-allocated draw list (no per-frame array allocation)
- Weather offscreen buffer (single drawImage composite)
- Frame budget management (skip decorative ops if over 14ms)
- Dynamic lighting via `destination-out` compositing

---

## TECHNICAL CONSTRAINTS

- **Single output file:** Vite build must produce one self-contained `index.html` in `dist/`
- **No external APIs:** Everything runs client-side, no server
- **localStorage only:** Save data in `astrari2` key, max ~4MB, prune if approaching limit
- **Mobile first:** Touch targets minimum 44px, test on 375px wide viewport
- **Offline capable:** Service worker caches all assets, game fully playable without connection
- **No WebGL:** Canvas 2D only — stay within the layered canvas architecture
- **Performance target:** 60fps on mid-range mobile (iPhone 12 / Pixel 5 equivalent)

---

## PROGRESS TRACKING

**At the end of every session, update `PROGRESS.md` with:**

```markdown
## Session [N] — [Title] — [Date]
### Completed
- [list of completed tasks]

### Partially Complete
- [list with notes on what remains]

### Known Issues
- [bugs or regressions introduced]

### Next Session Notes
- [anything the next session needs to know]
```

**Never start a new session if Known Issues contains broken core gameplay.**

---

*End of ASTRARI Master Brief. This document is the single source of truth. When in doubt, refer here first.*

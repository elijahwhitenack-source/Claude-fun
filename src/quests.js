/* Quest system data — pure (no game-state access).
   The state-machine engine + flag helpers live in game.js (they mutate S). */

// Quest status enum
export const QS = { LOCKED: 0, AVAILABLE: 1, ACTIVE: 2, COMPLETE: 3, CLAIMED: 4 };

// Story flags (persistent decisions / milestones, tracked in S.flags)
export const FLAGS = {
  FORGE_LEARNED: 'forge_learned',
  FIRST_BLOOD: 'first_blood',
  WANDERER: 'wanderer',
  CAELUN_MET: 'caelun_met',
};

/* Quest definitions.
   objective.type: gather | kill | boss_defeated | summon | craft | skill_level | reach | talk
   objective.target: specific id, or '*' for any
   unlock condition.type: quest_complete | combat_level | skill_level | flag | biome_visited
   rewards: { astral, shard, ore, wood, herb, fish, dust, bio, items:[gearId], flags:[id], xp:{skill,amount} } */
export const QUESTS = [
  // ===================== ACT 1 — MAIN STORY =====================
  { id: 'a1_firstlight', chain: 'main', act: 1, title: 'First Light', npc: 'codex',
    desc: 'The Root Shard woke you. Speak with Archivist Lune, then steady your hands in the wilds.',
    objectives: [
      { id: 'o_talk', type: 'talk', target: 'codex', count: 1, label: 'Speak with Archivist Lune' },
      { id: 'o_g', type: 'gather', target: '*', count: 3, label: 'Gather from the wilds' },
      { id: 'o_k', type: 'kill', target: '*', count: 1, label: 'Defeat a Hollow' },
    ],
    unlock: [], startDlg: 'a1_firstlight_intro', doneDlg: 'a1_firstlight_done', vision: 'v_shard',
    rewards: { astral: 80, xp: { skill: 'combat', amount: 25 } } },
  { id: 'a1_thread', chain: 'main', act: 1, title: 'The Weight of the Thread', npc: 'shrine',
    desc: 'Attune the Root Shard at the Shrine. Let it show you the shape of the wound.',
    objectives: [ { id: 'o_t', type: 'talk', target: 'shrine', count: 1, label: 'Attune at the Shrine of Yvalethi' } ],
    unlock: [ { type: 'quest_complete', id: 'a1_firstlight' } ],
    startDlg: 'a1_thread_intro', doneDlg: 'a1_thread_done', vision: 'v_wound',
    rewards: { astral: 120, shard: 6, flags: [FLAGS.WANDERER] } },
  { id: 'a1_margin', chain: 'main', act: 1, title: 'The Southern Margin', npc: 'lore',
    desc: 'A ring of Hollow stands in the south, around the place where it began. Thin them and look upon it. Report to Old Warden Sef.',
    objectives: [ { id: 'o_k', type: 'kill', target: '*', count: 2, label: 'Cull the Hollow of the ring' } ],
    unlock: [ { type: 'quest_complete', id: 'a1_thread' } ],
    startDlg: 'a1_margin_intro', doneDlg: 'a1_margin_done',
    rewards: { astral: 160, shard: 8 } },
  { id: 'a1_archive', chain: 'main', act: 1, title: "Lune's Locked Archive", npc: 'codex',
    desc: 'Lune\'s sealed records are keyed to two Root Shards. Bring two from the wilds, then return to the Hall.',
    objectives: [ { id: 'o_g', type: 'gather', target: '*', count: 2, label: 'Recover two Root Shards' } ],
    unlock: [ { type: 'quest_complete', id: 'a1_margin' } ],
    startDlg: 'a1_archive_intro', doneDlg: 'a1_archive_done',
    rewards: { astral: 200, shard: 10, flags: [FLAGS.FORGE_LEARNED] } },
  { id: 'a1_voice', chain: 'main', act: 1, title: 'The First Voice', npc: 'lore', auto: true,
    desc: 'Caelun walks the south road at dusk. Find him. Do not draw on him. Listen.',
    objectives: [ { id: 'o_c', type: 'caelun', target: '*', count: 1, label: 'Meet Caelun on the south road' } ],
    unlock: [ { type: 'quest_complete', id: 'a1_archive' } ],
    startDlg: 'a1_voice_intro',
    rewards: { astral: 300, shard: 20, flags: [FLAGS.CAELUN_MET] } },

  // ---- BIOME ----
  { id: 'b_tundra', chain: 'biome', act: 1, title: 'Frostpeak Survey',
    desc: 'Set foot on the frozen north and live to tell it.',
    objectives: [ { id: 'o_t', type: 'reach', target: 'tundra', count: 1, label: 'Reach Frostpeak Tundra' } ],
    unlock: [ { type: 'flag', id: FLAGS.WANDERER } ], rewards: { shard: 20, dust: 5 } },
  { id: 'b_ember', chain: 'biome', act: 1, title: 'Into the Ash',
    desc: 'The Emberwaste burns. Walk its cinders.',
    objectives: [ { id: 'o_e', type: 'reach', target: 'ember', count: 1, label: 'Reach the Emberwaste' } ],
    unlock: [ { type: 'flag', id: FLAGS.WANDERER } ], rewards: { shard: 20, ore: 10 } },

  // ---- NPC ARCS (open after Act 1) ----
  { id: 'arc_borin', chain: 'npc', act: 1, title: 'What Remains', npc: 'forge',
    desc: 'Smith Borin forges to keep from breaking. Hear him out.',
    objectives: [ { id: 'o', type: 'talk', target: 'forge', count: 1, label: 'Speak with Smith Borin' } ],
    unlock: [ { type: 'quest_complete', id: 'a1_voice' } ], startDlg: 'arc_borin', rewards: { astral: 60, ore: 10 } },
  { id: 'arc_vael', chain: 'npc', act: 1, title: 'The Faith That Survives Doubt', npc: 'shrine',
    desc: 'Priestess Vael keeps rites for a Tree that may never answer.',
    objectives: [ { id: 'o', type: 'talk', target: 'shrine', count: 1, label: 'Speak with Priestess Vael' } ],
    unlock: [ { type: 'quest_complete', id: 'a1_voice' } ], startDlg: 'arc_vael', rewards: { astral: 60, shard: 6 } },
  { id: 'arc_lune', chain: 'npc', act: 1, title: 'Everything Written Down', npc: 'codex',
    desc: 'Archivist Lune records all and concludes nothing. There is one page she fears.',
    objectives: [ { id: 'o', type: 'talk', target: 'codex', count: 1, label: 'Speak with Archivist Lune' } ],
    unlock: [ { type: 'quest_complete', id: 'a1_voice' } ], startDlg: 'arc_lune', rewards: { astral: 60, dust: 6 } },
  { id: 'arc_quill', chain: 'npc', act: 1, title: 'The Economy of Survival', npc: 'market',
    desc: 'Trader Quill maps the routes the Hollow walk. He says they are the old roads.',
    objectives: [ { id: 'o', type: 'talk', target: 'market', count: 1, label: 'Speak with Trader Quill' } ],
    unlock: [ { type: 'quest_complete', id: 'a1_voice' } ], startDlg: 'arc_quill', rewards: { astral: 60, shard: 6 } },
  { id: 'arc_sef', chain: 'npc', act: 1, title: 'The Last Honest Man', npc: 'lore',
    desc: 'Old Warden Sef carries a guilt twenty years deep. Let him spend it on something true.',
    objectives: [ { id: 'o', type: 'talk', target: 'lore', count: 1, label: 'Speak with Old Warden Sef' } ],
    unlock: [ { type: 'quest_complete', id: 'a1_voice' } ], startDlg: 'arc_sef', rewards: { astral: 60, shard: 8 } },

  // ---- SKILL ----
  { id: 'sk_miner', chain: 'skill', act: 1, title: 'Deepening Veins',
    desc: 'The ore runs deeper than it looks. Hone your Mining.',
    objectives: [ { id: 'o_m', type: 'skill_level', target: 'mining', count: 5, label: 'Reach Mining Lv 5' } ],
    unlock: [], rewards: { shard: 15, ore: 25 } },

  // ---- BOUNTIES (repeatable) ----
  { id: 'bn_harvest', chain: 'bounty', act: 1, title: 'First Harvest', repeatable: true,
    desc: 'Skyhaven always needs raw stock.',
    objectives: [ { id: 'o_g', type: 'gather', target: '*', count: 15, label: 'Gather from the wilds' } ],
    unlock: [], rewards: { shard: 30 } },
  { id: 'bn_blooded', chain: 'bounty', act: 1, title: 'Blooded', repeatable: true,
    desc: 'Thin the Hollow that crowd the isle.',
    objectives: [ { id: 'o_k', type: 'kill', target: '*', count: 8, label: 'Defeat the Hollow' } ],
    unlock: [], rewards: { shard: 45 } },
  { id: 'bn_thecall', chain: 'bounty', act: 1, title: 'Answer the Call', repeatable: true,
    desc: 'Call the lost champions home from the shattered Tree.',
    objectives: [ { id: 'o_s', type: 'summon', target: '*', count: 5, label: 'Summon champions' } ],
    unlock: [], rewards: { shard: 50 } },
  { id: 'bn_bane', chain: 'bounty', act: 1, title: 'Hollow Bane', repeatable: true,
    desc: 'A biome boss haunts the wilds. End it.',
    objectives: [ { id: 'o_b', type: 'boss_defeated', target: '*', count: 1, label: 'Defeat a biome boss' } ],
    unlock: [], rewards: { shard: 120, astral: 200 } },
];

export const CHAIN_LABEL = { main: 'Story', biome: 'Biomes', npc: 'People', skill: 'Skills', bounty: 'Bounties' };

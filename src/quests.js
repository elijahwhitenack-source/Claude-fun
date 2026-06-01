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
  // ---- MAIN CHAIN (act 1) ----
  { id: 'm1_firstlight', chain: 'main', act: 1, title: 'First Light',
    desc: 'Steady your hands on Skyhaven — gather from the wilds and face a Hollow.',
    objectives: [
      { id: 'o_gather', type: 'gather', target: '*', count: 5, label: 'Gather resources' },
      { id: 'o_kill', type: 'kill', target: '*', count: 1, label: 'Defeat a Hollow' },
    ],
    unlock: [], rewards: { astral: 60, xp: { skill: 'combat', amount: 20 } } },
  { id: 'm2_wider', chain: 'main', act: 1, title: 'A Wider World',
    desc: 'The isle is vast. Roam beyond the meadow and learn its shapes.',
    objectives: [ { id: 'o_reach', type: 'reach', target: '*', count: 3, label: 'Explore new biomes' } ],
    unlock: [ { type: 'quest_complete', id: 'm1_firstlight' } ],
    rewards: { astral: 120, shard: 6, flags: [FLAGS.WANDERER] } },
  { id: 'm3_forge', chain: 'main', act: 1, title: 'Sharpen the Edge',
    desc: 'Smith Borin can teach the forge to sing. Craft your first gear.',
    objectives: [ { id: 'o_craft', type: 'craft', target: '*', count: 1, label: 'Craft an item' } ],
    unlock: [ { type: 'quest_complete', id: 'm2_wider' } ],
    rewards: { astral: 180, ore: 20, flags: [FLAGS.FORGE_LEARNED] } },

  // ---- BIOME ----
  { id: 'b_tundra', chain: 'biome', act: 1, title: 'Frostpeak Survey',
    desc: 'Set foot on the frozen north and live to tell it.',
    objectives: [ { id: 'o_t', type: 'reach', target: 'tundra', count: 1, label: 'Reach Frostpeak Tundra' } ],
    unlock: [ { type: 'flag', id: FLAGS.WANDERER } ], rewards: { shard: 20, dust: 5 } },
  { id: 'b_ember', chain: 'biome', act: 1, title: 'Into the Ash',
    desc: 'The Emberwaste burns. Walk its cinders.',
    objectives: [ { id: 'o_e', type: 'reach', target: 'ember', count: 1, label: 'Reach the Emberwaste' } ],
    unlock: [ { type: 'flag', id: FLAGS.WANDERER } ], rewards: { shard: 20, ore: 10 } },

  // ---- NPC ----
  { id: 'npc_borin1', chain: 'npc', act: 1, title: 'What Remains',
    desc: 'Smith Borin keeps the forge fires lit. Speak with him.',
    objectives: [ { id: 'o_talk', type: 'talk', target: 'forge', count: 1, label: 'Talk to Smith Borin' } ],
    unlock: [], rewards: { astral: 40, ore: 8 } },

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

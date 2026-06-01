/* ASTRARI story content — Act 1. Pure data (dialogue trees, visions, Caelun, NPC bios).
   The dialogue/vision/Caelun engine lives in game.js. */

// NPC portrait + flavor by role. (skin/cloak come from the world npc; these add hair + identity.)
export const NPC_INFO = {
  forge:  { name: 'Smith Borin',     title: 'Keeper of the Star-Forge', hair: '#3a2218' },
  shrine: { name: 'Priestess Vael',  title: 'Tender of the Shrine',     hair: '#2a1f3a' },
  market: { name: 'Trader Quill',    title: 'Caravan-Master',           hair: '#3a2a1a' },
  lore:   { name: 'Old Warden Sef',  title: 'The Last Honest Man',      hair: '#cfcfd6' },
  codex:  { name: 'Archivist Lune',  title: 'Keeper of the Hall',       hair: '#241a3a' },
};

// Special characters (rendered specs)
export const CAELUN_SPEC = { kind: 'npc', skin: '#cdb6c6', cloak: '#2a2440', hair: '#1a1428', weapon: false, caelun: true };
export const YVALETHI_SPEC = { kind: 'yvalethi' };

/* Dialogue trees. Each entry: array of lines.
   line: { sp: speaker name, port: portrait spec key ('player'|'caelun'|'yvalethi'|role), text,
           choices?: [{ text, set?:flag, vision?:id, end?:bool }] }
   Speaker 'NARRATOR' renders without a portrait. */
export const DLG = {
  // ---- 1.1 First Light ----
  a1_firstlight_intro: [
    { sp: 'NARRATOR', text: 'The Root Shard at your belt has not stopped trembling since you woke.' },
    { sp: 'Archivist Lune', port: 'codex', text: 'You feel it too, then. Good. Most stopped feeling anything when the Tree broke.' },
    { sp: 'Archivist Lune', port: 'codex', text: 'I am Lune. I catalogue what remains. What remains, lately, is the Hollow — the dead who cannot pass. Death itself has jammed, Warden.' },
    { sp: 'PLAYER', port: 'player', text: 'And the shard? It pulls south, toward the dark.' },
    { sp: 'Archivist Lune', port: 'codex', text: 'Then it remembers something we forgot. Steady your hands first — gather, face a Hollow, learn the weight of this place. Come back when you have.' },
  ],
  a1_firstlight_done: [
    { sp: 'Archivist Lune', port: 'codex', text: 'You stand straighter already. The shard chose well.' },
    { sp: 'NARRATOR', text: 'The Root Shard flares white. The world thins—' },
  ],
  // ---- 1.2 The Weight of the Thread ----
  a1_thread_intro: [
    { sp: 'Priestess Vael', port: 'shrine', text: 'Lune sent you. The shard holds a fragment of Yvalethi’s last intent — and you want to hear it.' },
    { sp: 'Priestess Vael', port: 'shrine', text: 'Kneel, then. I’ll keep the rite. Let it show you the shape of the wound. It will be heavy. Carry it anyway.' },
  ],
  a1_thread_done: [
    { sp: 'Priestess Vael', port: 'shrine', text: 'I have kept these rites for a Tree that no longer answers. Today, for the first time in years— it did.' },
    { sp: 'NARRATOR', text: 'The shard shows you the south: a perfect circle of Hollow, standing, waiting, around nothing at all.' },
  ],
  // ---- 1.3 The Southern Margin ----
  a1_margin_intro: [
    { sp: 'Old Warden Sef', port: 'lore', text: 'South? You’re going south. Of course you are.' },
    { sp: 'Old Warden Sef', port: 'lore', text: 'There’s a ring of them down there. They don’t hunt. They just… stand. Around the place where it started. Go look. Someone should. I never could.' },
  ],
  a1_margin_done: [
    { sp: 'NARRATOR', text: 'At the heart of the ring, the air is frayed — threadbare, like cloth worn through. Through the gap you can almost see… someone, walking away.' },
    { sp: 'PLAYER', port: 'player', text: 'There was a person here. A Warden. He did this.' },
  ],
  // ---- 1.4 Lune's Locked Archive ----
  a1_archive_intro: [
    { sp: 'Archivist Lune', port: 'codex', text: 'A Warden. You’re certain. Then I have records I’ve been afraid to open.' },
    { sp: 'Archivist Lune', port: 'codex', text: 'They’re sealed with two Root Shards — keyed to intent, not lock. Bring me two more from the wilds and the Hall will open its throat.' },
  ],
  a1_archive_done: [
    { sp: 'Archivist Lune', port: 'codex', text: 'The seal reads your shard and answers… there. A name, struck through a hundred times by the same hand. Caelun Drey. Our greatest scholar.' },
    { sp: 'Archivist Lune', port: 'codex', text: 'He went to mend the Fraying Margin. The records say he succeeded. The records are a lie I helped file.' },
  ],
  // ---- 1.5 The First Voice ----
  a1_voice_intro: [
    { sp: 'Old Warden Sef', port: 'lore', text: 'Caelun. So you’ve found his name. He’ll find you now — he always does, when someone starts to understand.' },
    { sp: 'Old Warden Sef', port: 'lore', text: 'Walk the south road at dusk. Don’t draw on him. You can’t kill a man who’s already decided to end everything. Just… listen. Then decide what you think.' },
  ],
  // Caelun's first appearance
  caelun_first: [
    { sp: 'NARRATOR', text: 'A man stands in the road. Threads of void drift off him like smoke off a cooling iron. He is smiling, and it is kind.' },
    { sp: 'Caelun', port: 'caelun', text: 'You read it as a wound. I understand. I read it that way too, once — for a very long time.' },
    { sp: 'Caelun', port: 'caelun', text: 'But a wound implies a body that wants to heal. Look closer, Warden. The Tree was holding back a tide with the whole weight of itself. I simply… stopped pushing the water uphill.' },
    { sp: 'PLAYER', port: 'player', text: 'You stopped death from working. The dead are still here. That’s mercy?' },
    { sp: 'Caelun', port: 'caelun', text: 'They are here because she scattered herself to keep them. That is the cruelty — hers, not mine. I would let them rest. All of them. Completely.',
      choices: [
        { text: '"Then you’ll have to go through me."', set: 'caelun_defiant' },
        { text: '"…What did you see, out past the Margin?"', set: 'caelun_curious' },
      ] },
    { sp: 'Caelun', port: 'caelun', text: 'There he is. Patience — the only thing that ever frightened me. Good. Be patient, then. Gather her pieces. Hear what she has to say. And when you understand it as I do, come find me at the Edge.' },
    { sp: 'NARRATOR', text: 'The threads pull him apart into the dusk, gently, the way a thought leaves you. He does not look back.' },
  ],

  // ---- NPC ARC STUBS (first beat each) ----
  arc_borin: [
    { sp: 'Smith Borin', port: 'forge', text: 'Bring me ore and I’ll keep the fire honest. It’s the only honest thing left to me.' },
    { sp: 'Smith Borin', port: 'forge', text: 'Don’t ask about the three places set at my table. Just… craft something. Make a thing that lasts. I find it helps.' },
  ],
  arc_vael: [
    { sp: 'Priestess Vael', port: 'shrine', text: 'People think faith is certainty. It isn’t. It’s what I do at the altar on the mornings I’m sure no one is listening.' },
    { sp: 'Priestess Vael', port: 'shrine', text: 'Offer at the Shrine and I’ll bind you a relic. Doubt and all, the rites still hold. Maybe that’s the miracle.' },
  ],
  arc_quill: [
    { sp: 'Trader Quill', port: 'market', text: 'Sentiment doesn’t move cargo, Warden. Shards do. Gather, sell, survive — in that order.' },
    { sp: 'Trader Quill', port: 'market', text: 'Funny thing, though. The Hollow drift the old trade roads. Same routes my partner ran, before. I’ve started mapping them. Tell no one.' },
  ],
  arc_lune: [
    { sp: 'Archivist Lune', port: 'codex', text: 'I have recorded everything and concluded nothing. It is the safest way to be a coward with good handwriting.' },
    { sp: 'Archivist Lune', port: 'codex', text: 'There is one misfiled page I keep not reading. My grandmother’s name is on it. Some day you’ll make me open it. Not today.' },
  ],
  arc_sef: [
    { sp: 'Old Warden Sef', port: 'lore', text: 'They call me the last honest man. It’s a joke. I gave Caelun a document, once. A small thing. It helped him unlock the Margin.' },
    { sp: 'Old Warden Sef', port: 'lore', text: 'Twenty years I’ve carried that. So if I’m honest now, it’s not virtue. It’s penance. Reclaim the south, Warden. Let an old man’s mistake mean something.' },
  ],
};

/* Visions — fade-to-white scenes narrated by Yvalethi's residual intent. */
export const VISIONS = {
  v_shard: {
    title: 'A Fragment Remembers',
    caption: 'I am the lattice the dead pass through. I am torn. I did not break by accident — I broke on purpose, into seeds, so that I might be replanted. Find me. Reassemble what I meant.',
  },
  v_wound: {
    title: 'The Shape of the Wound',
    caption: 'Look south. The circle stands where one of you tried to mend me and tore wider instead. He is not evil. He is certain. That is worse.',
  },
};

export const LORE_INTRO = {
  title: 'The Hall of Echoes',
  text: 'A record of what the shattered Tree still whispers — visions, encounters, and the names struck from the archive.',
};

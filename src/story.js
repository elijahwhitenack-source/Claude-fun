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

// ---- ACT 2 — the biome bosses each hold a Memory Shard of Yvalethi's message ----
Object.assign(DLG, {
  a2_mournroot_done: [
    { sp: 'NARRATOR', text: 'Mournroot stills. From its unspooling thorns rises a shard of pale light — a Memory.' },
    { sp: 'Yvalethi', port: 'yvalethi', text: 'The first thing you must understand: I did not die. I divided. Grief is not an ending — it is a thread left untied. Gather my threads, Warden.' },
    { sp: 'PLAYER', port: 'player', text: 'A piece of her. Lune has to see this.' },
  ],
  a2_skarn_intro: [
    { sp: 'NARRATOR', text: 'Skarn the Peakbreaker is half-stone now, cracking, holding something in. A Memory waits inside the fracture — but the stone has not finished breaking.' },
    { sp: 'Skarn', port: 'caelun', text: 'I kept the pass. I keep it still. If you take the shard, I crack open. Force it, and be done. Or… wait with me, and let me let go on my own. Choose.',
      choices: [
        { text: 'Force the stone — take the shard now.', set: 'skarn_force', seq: 'a2_skarn_force' },
        { text: 'Wait. Let him release it himself.', set: 'skarn_release', seq: 'a2_skarn_release' },
      ] },
  ],
  a2_skarn_force: [
    { sp: 'NARRATOR', text: 'You strike the fracture. Skarn shatters — fast, clean, gone. The shard is in your hand before the dust settles.' },
    { sp: 'Yvalethi', port: 'yvalethi', text: 'Sometimes mercy is speed. Remember that you chose it. The lattice will remember too.' },
  ],
  a2_skarn_release: [
    { sp: 'NARRATOR', text: 'You lower your blade. Skarn breathes out, slow as a glacier, and lets the stone go on its own terms. The shard drifts to you, warm.' },
    { sp: 'Yvalethi', port: 'yvalethi', text: 'Sometimes mercy is patience. You waited. So few do. This is the thread the rebuilding needs most.' },
  ],
  a2_gelmara_done: [
    { sp: 'NARRATOR', text: 'Gelmara Frostwidow falls without a sound. A journal of ice cracks open at your feet, and a Memory escapes its frozen pages.' },
    { sp: 'Yvalethi', port: 'yvalethi', text: 'The cold preserves what should pass. So did I, at the end — I held the dead rather than lose them. That was love, and it was the wound. Do not repeat it forever.' },
  ],
  a2_pyrrhaxis_done: [
    { sp: 'NARRATOR', text: 'The Cinder-King gutters out. In the cooling ash, a Memory glows like the last coal.' },
    { sp: 'Yvalethi', port: 'yvalethi', text: 'The Emberwaste taught letting-go as a rite. Caelun saw the rite and called it proof that everything should end. He read the kindness as a verdict. He was always too good a reader.' },
  ],
  a2_nullith_done: [
    { sp: 'NARRATOR', text: 'Nullith, Echo of the Void, unravels into the dark it came from. The last Memory rises — and the others, carried in your shard, rise to meet it.' },
    { sp: 'Yvalethi', port: 'yvalethi', text: 'You have them all now. Here, then, is the whole of it—' },
  ],
  // assembled message (turn in at Lune)
  a2_message_done: [
    { sp: 'Archivist Lune', port: 'codex', text: 'Five shards. Twenty years I filed around the shape of this and never let myself read it. Lay them down, Warden. Let me finally do my work.' },
    { sp: 'Archivist Lune', port: 'codex', text: 'They fit. Of course they fit. She wrote them to fit.' },
  ],
});

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
  v_message: {
    title: "Yvalethi's Whole Message",
    caption: 'I do not regrow from the outside. No hand can stitch me. I regrow from within, through every soul that passes cleanly — and the Wardens, rebuilt and scattered like seeds, are how the passing is taught again. I shattered into the lesson. You are not here to repair me. You are here to begin. Go to the Edge. Tell Caelun what the reading actually says.',
  },
};

export const LORE_INTRO = {
  title: 'The Hall of Echoes',
  text: 'A record of what the shattered Tree still whispers — visions, encounters, and the names struck from the archive.',
};

/* Lore tablets — small glowing stones scattered through each biome.
   Keyed by biome; worldgen places one per entry, id = `<biome>_<index>`. */
export const TABLETS = {
  meadow: [
    { title: 'Warden Record I', text: 'Before the Shattering, the dead walked to the nearest root and simply… stopped being afraid. We called it the Easy Road. We did not know it could break.' },
    { title: 'A Child\'s Carving', text: '“Mama says the stars are leaves. When one falls, somebody we love goes up to be it.” The hand that cut this was very small.' },
    { title: 'Field Note', text: 'The meadow Hollow do not hunt. They drift toward sound, then toward each other, as if remembering they were once a crowd.' },
  ],
  forest: [
    { title: 'Grovekeeper\'s Ledger', text: 'The Echo-groves replay the living. Stand still and you will see yourself as you were an hour ago, a year, a life. The Tree forgets nothing here, even now.' },
    { title: 'Thornwraith Study', text: 'They trail thorns because in life they were hedge-wardens, and they are still, gently, trying to keep something fenced in. We never learned what.' },
    { title: 'Burned Page', text: '…and so the Margin was not a place but a thinness, and Caelun mapped it the way a man maps a wound he intends to close…' },
  ],
  mountain: [
    { title: 'Peakwarden\'s Oath', text: 'Aetheri-ore sings when the Tree is whole. It has been silent twenty years. I climb each dawn to listen. One day it will hum again, or I will not come down.' },
    { title: 'Stone-Walker Lore', text: 'They are immune to the blade because grief cannot be cut. Strike them with what they feared in life — fire, the void — and they remember how to fall.' },
    { title: 'Survey Marker', text: 'Altitude thins the breath and the soul both. Wardens posted here served short rotations. The Hollow here serve forever.' },
  ],
  tundra: [
    { title: 'Aetherwatch Log', text: 'The cold preserves. Hollow that fray in an hour elsewhere stand whole for centuries here — patient, unhurried, certain we will join them. Keep a fire.' },
    { title: 'Frostsinger Note', text: 'Their hum builds Coherence in the listener — a steadiness, a warmth of mind. The Tree once sang it to the newly dead. Now only the ice remembers the tune.' },
    { title: 'Last Entry', text: 'Ward failed at dusk. Cold in my hands now. If you read this, the bonfires are the only mercy left in the north. Tend them. — Warden Ysolde' },
  ],
  ember: [
    { title: 'Ashen Doctrine', text: 'We practiced Cooling here — the rite of letting go. The Emberwaste was a place of endings done kindly. Caelun would call that proof. It is not.' },
    { title: 'Cinder Record', text: 'Lava is the isle\'s old grief made literal: heat with nowhere to go. Walk it unwarded and it will share the burden with you. It is generous that way.' },
    { title: 'Ember-Witch Scrawl', text: 'The Remnants perform the Cooling mid-battle, out of habit, trying to comfort the very things killing them. Mercy is a hard reflex to unlearn.' },
  ],
  crystal: [
    { title: 'Hollow-Glass Theorem', text: 'The Reflected copy your last act because in death they have nothing of their own left to do. Change, and they cannot follow. Be unpredictable. Be alive.' },
    { title: 'Echo-Maze Key', text: 'The paths flip for those who walk by certainty. Only the doubtful, the questioning, pass straight through. The Tree always did prefer a mind that asked why.' },
    { title: 'Void-touched Query', text: 'One asked me, in the middle of trying to kill me, whether I thought it had been a good person. I am still deciding what it deserved to hear.' },
  ],
};

export const BIOME_LABEL = { meadow:'Verdant Meadow', forest:'Whispering Forest', mountain:'The Peaks', tundra:'Frostpeak Tundra', ember:'The Emberwaste', crystal:'Crystal Hollows', plains:'Open Plains' };

/* Immutable game config — elements, rarities, champions, gear, recipes, skills. */
export const TILE=30;

/* ---------------- ELEMENTS / RARITY ---------------- */
export const ELEM={
  flora:{n:'Flora',c:'e-flora',col:'#2fae6b',beats:'flux'},
  flux:{n:'Flux',c:'e-flux',col:'#3f86f0',beats:'ember'},
  ember:{n:'Ember',c:'e-ember',col:'#e0654b',beats:'flora'},
  void:{n:'Void',c:'e-void',col:'#9a5cf0',beats:'light'},
  light:{n:'Light',c:'e-light',col:'#ffce54',beats:'void'},
};
export const RAR={
  com:{n:'COMMON',stars:2,mult:1.0,c:'com',col:'#9aa7c0'},
  rare:{n:'RARE',stars:3,mult:1.5,c:'rare',col:'#5aa9ff'},
  epic:{n:'EPIC',stars:4,mult:2.3,c:'epic',col:'#c07bff'},
  legend:{n:'LEGEND',stars:5,mult:3.6,c:'legend',col:'#ffce54'},
};
/* ---------------- CHAMPION POOL ---------------- */
export const POOL=[
  {id:'sylune',name:'Sylune Verdant',el:'flora',rar:'legend',atk:78,hp:560,role:'Warden of the World-Tree',hair:'#bff2a0'},
  {id:'noctyr',name:'Noctyr Voidsong',el:'void',rar:'legend',atk:96,hp:430,role:'Hollow-touched Assassin',hair:'#1a1024'},
  {id:'aurelia',name:'Aurelia Dawnspear',el:'light',rar:'legend',atk:84,hp:500,role:'Radiant Vanguard',hair:'#ffe9a8'},
  {id:'thornak',name:'Thornak Bramblefist',el:'flora',rar:'epic',atk:60,hp:480,role:'Rootbound Bulwark',hair:'#5a3b1f'},
  {id:'zephren',name:'Zephren Tideweaver',el:'flux',rar:'epic',atk:66,hp:360,role:'Stormcaller',hair:'#bfe6ff'},
  {id:'cindra',name:'Cindra Ashveil',el:'ember',rar:'epic',atk:72,hp:330,role:'Emberwitch',hair:'#ff9a5b'},
  {id:'umbriel',name:'Umbriel Nightglass',el:'void',rar:'epic',atk:70,hp:340,role:'Shade Stalker',hair:'#2a1740'},
  {id:'fenli',name:'Fenli Sporeling',el:'flora',rar:'rare',atk:44,hp:300,role:'Mire Healer',hair:'#d6b3ff'},
  {id:'brisa',name:'Brisa Galewing',el:'flux',rar:'rare',atk:50,hp:240,role:'Skydart Archer',hair:'#e8f4ff'},
  {id:'molt',name:'Molt Cinderpaw',el:'ember',rar:'rare',atk:52,hp:230,role:'Pyre Skirmisher',hair:'#3a2218'},
  {id:'vael',name:'Vael Duskborn',el:'void',rar:'rare',atk:48,hp:260,role:'Web-spinner',hair:'#3a2a4a'},
  {id:'lumi',name:'Lumi Sparkmote',el:'light',rar:'rare',atk:46,hp:270,role:'Glimmer Acolyte',hair:'#fff0c0'},
  {id:'pip',name:'Pip Leafkin',el:'flora',rar:'com',atk:30,hp:200,role:'Sapling Scout',hair:'#8fd96a'},
  {id:'rin',name:'Rin Ripplet',el:'flux',rar:'com',atk:34,hp:160,role:'Tide Pup',hair:'#a8d8ff'},
  {id:'ash',name:'Ash Emberlin',el:'ember',rar:'com',atk:36,hp:150,role:'Spark Urchin',hair:'#d98a5b'},
  {id:'dot',name:'Dot Shadeling',el:'void',rar:'com',atk:33,hp:175,role:'Wisp',hair:'#4a3a5a'},
  {id:'glim',name:'Glim Brightbug',el:'light',rar:'com',atk:31,hp:185,role:'Lumen Bug',hair:'#fff4c8'},
];
export const champDef=id=>POOL.find(p=>p.id===id);

/* ---------------- GEAR / RECIPES ---------------- */
export const GEAR={
  // weapons (wt = weapon type: sword/axe/staff/bow/spear) — shown on the avatar
  w_astralite:{id:'w_astralite',name:'Astralite Blade',slot:'weapon',wt:'sword',tier:1,col:'#b9803e',atk:14,hp:0,sk:{}},
  w_oakaxe:{id:'w_oakaxe',name:'Heartwood Axe',slot:'weapon',wt:'axe',tier:1,col:'#9bd66a',atk:18,hp:10,sk:{woodcutting:1}},
  w_verdant:{id:'w_verdant',name:'Verdantine Spear',slot:'weapon',wt:'spear',tier:2,col:'#3fb0a6',atk:34,hp:20,sk:{}},
  w_runebow:{id:'w_runebow',name:'Runewood Longbow',slot:'weapon',wt:'bow',tier:2,col:'#6ad0a0',atk:38,hp:0,sk:{foraging:1}},
  w_void:{id:'w_void',name:'Voidsteel Reaver',slot:'weapon',wt:'axe',tier:3,col:'#8a6cff',atk:66,hp:40,sk:{}},
  w_aetherstaff:{id:'w_aetherstaff',name:'Aetherflux Staff',slot:'weapon',wt:'staff',tier:3,col:'#c89bff',atk:58,hp:30,sk:{fishing:2}},
  // boss legendaries (weapons)
  w_tempest:{id:'w_tempest',name:'Tempest, Peakcleaver',slot:'weapon',wt:'axe',tier:4,col:'#7fd4ff',atk:108,hp:60,sk:{mining:3}},
  w_infernal:{id:'w_infernal',name:'Infernal Cindermaul',slot:'weapon',wt:'sword',tier:4,col:'#ff7a3a',atk:152,hp:90,sk:{}},
  // armor
  a_astralite:{id:'a_astralite',name:'Astralite Plate',slot:'armor',tier:1,col:'#b9803e',atk:0,hp:70,sk:{mining:1}},
  a_verdant:{id:'a_verdant',name:'Verdantine Mail',slot:'armor',tier:2,col:'#3fb0a6',atk:6,hp:170,sk:{foraging:1}},
  a_void:{id:'a_void',name:'Voidsteel Aegis',slot:'armor',tier:3,col:'#8a6cff',atk:14,hp:340,sk:{mining:2}},
  a_crystal:{id:'a_crystal',name:'Crystalweave Cuirass',slot:'armor',tier:3,col:'#9be8ff',atk:20,hp:300,sk:{fishing:2}},
  // boss legendaries (armor)
  a_glacial:{id:'a_glacial',name:'Glacial Bulwark',slot:'armor',tier:4,col:'#bfe8ff',atk:24,hp:560,sk:{}},
  // relics / artifacts
  r_tide:{id:'r_tide',name:'Tideheart Charm',slot:'relic',tier:1,col:'#46c8e8',atk:4,hp:30,sk:{woodcutting:1},teamAtk:0},
  r_aurora:{id:'r_aurora',name:'Aurora Sigil',slot:'relic',tier:2,col:'#b388ff',atk:8,hp:60,sk:{fishing:2},teamAtk:0.08},
  r_emberstone:{id:'r_emberstone',name:'Emberstone Idol',slot:'relic',tier:2,col:'#ff8a4a',atk:16,hp:40,sk:{},teamAtk:0.10},
  r_radiant:{id:'r_radiant',name:'Radiant Heart',slot:'relic',tier:3,col:'#ffce54',atk:18,hp:120,sk:{},teamAtk:0.16},
  r_starcore:{id:'r_starcore',name:'Starcore Prism',slot:'relic',tier:3,col:'#9be8ff',atk:28,hp:90,sk:{mining:2},teamAtk:0.20},
  // boss legendaries (relics)
  r_thornheart:{id:'r_thornheart',name:'Thornheart Seed',slot:'relic',tier:4,col:'#5fd66a',atk:30,hp:200,sk:{foraging:3},teamAtk:0.24},
  r_voidheart:{id:'r_voidheart',name:'Voidheart Eclipse',slot:'relic',tier:4,col:'#a06cff',atk:48,hp:260,sk:{},teamAtk:0.34},
  // ward relics — negate biome exposure (Session 6)
  r_coldward:{id:'r_coldward',name:'Cold Ward Charm',slot:'relic',tier:2,col:'#bfe8ff',atk:6,hp:80,sk:{},teamAtk:0.04,ward:'cold'},
  r_emberward:{id:'r_emberward',name:'Ember Ward Charm',slot:'relic',tier:2,col:'#ff8a4a',atk:10,hp:60,sk:{},teamAtk:0.04,ward:'heat'},
};
export const RECIPES=[
  {id:'w_astralite',out:'w_astralite',station:'forge',skill:'smithing',lvl:1,cost:{ore:6,wood:2}},
  {id:'a_astralite',out:'a_astralite',station:'forge',skill:'smithing',lvl:2,cost:{ore:9}},
  {id:'w_verdant',out:'w_verdant',station:'forge',skill:'smithing',lvl:8,cost:{ore:16,wood:8,herb:3}},
  {id:'a_verdant',out:'a_verdant',station:'forge',skill:'smithing',lvl:10,cost:{ore:20,wood:6}},
  {id:'w_void',out:'w_void',station:'forge',skill:'smithing',lvl:18,cost:{ore:34,wood:16,dust:8}},
  {id:'a_void',out:'a_void',station:'forge',skill:'smithing',lvl:20,cost:{ore:40,dust:12}},
  {id:'r_tide',out:'r_tide',station:'shrine',skill:'smithing',lvl:3,cost:{fish:8,herb:4}},
  {id:'r_aurora',out:'r_aurora',station:'shrine',skill:'smithing',lvl:12,cost:{fish:20,bio:10,shard:5}},
  {id:'r_radiant',out:'r_radiant',station:'shrine',skill:'smithing',lvl:22,cost:{fish:40,dust:20,shard:14}},
  {id:'w_oakaxe',out:'w_oakaxe',station:'forge',skill:'smithing',lvl:4,cost:{wood:14,ore:6}},
  {id:'w_runebow',out:'w_runebow',station:'forge',skill:'smithing',lvl:9,cost:{wood:18,herb:10,bio:6}},
  {id:'w_aetherstaff',out:'w_aetherstaff',station:'forge',skill:'smithing',lvl:16,cost:{wood:20,shard:10,dust:6}},
  {id:'a_crystal',out:'a_crystal',station:'forge',skill:'smithing',lvl:24,cost:{ore:30,shard:18,dust:10}},
  {id:'r_emberstone',out:'r_emberstone',station:'shrine',skill:'smithing',lvl:15,cost:{dust:16,ore:14,shard:6}},
  {id:'r_starcore',out:'r_starcore',station:'shrine',skill:'smithing',lvl:26,cost:{shard:24,dust:18,fish:30}},
  {id:'r_coldward',out:'r_coldward',station:'forge',skill:'smithing',lvl:6,cost:{ore:12,dust:6}},
  {id:'r_emberward',out:'r_emberward',station:'forge',skill:'smithing',lvl:6,cost:{ore:12,dust:6}},
];

/* ---------------- SKILLS ---------------- */
export const SKILLS=[
  {id:'mining',n:'Mining',ic:'⛏️',res:'ore',resn:'Ore',base:2,node:'rock'},
  {id:'woodcutting',n:'Woodcutting',ic:'🪓',res:'wood',resn:'Wood',base:2,node:'tree'},
  {id:'foraging',n:'Foraging',ic:'🌿',res:'herb',resn:'Herb',base:1,node:'plant'},
  {id:'fishing',n:'Fishing',ic:'🎣',res:'fish',resn:'Fish',base:1,node:'fish'},
  {id:'smithing',n:'Smithing',ic:'🔨',res:null,resn:'',base:0,node:null},
  {id:'combat',n:'Combat',ic:'⚔️',res:null,resn:'',base:0,node:null},
];
export const RESINFO={astral:'◈',shard:'✦',ore:'⛁',wood:'🪵',herb:'🌿',fish:'🐟',dust:'☄',bio:'✿'};

/* ---------------- WEATHER ---------------- */
export const WEATHERS=['clear','clear','cloud','rain','fog','aurora','storm'];

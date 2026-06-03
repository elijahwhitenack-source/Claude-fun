import './style.css';
/* ===================================================================
   ASTRARI — open-world build
   =================================================================== */
import { $, $$, clamp, lerp, fmt, dist, sleep, shade } from './utils.js';
import { mulberry32 } from './rng.js';
import { drawGlow } from './glow.js';
import { updateParticles, drawParticles, burstSpray, burstRing, burstMotes } from './particles.js';
import { QUESTS, QS, FLAGS, CHAIN_LABEL } from './quests.js';
import { DLG, VISIONS, NPC_INFO, CAELUN_SPEC, LORE_INTRO, TABLETS, BIOME_LABEL, ENDINGS } from './story.js';
import { TILE, ELEM, RAR, POOL, champDef, GEAR, RECIPES, SKILLS, RESINFO, WEATHERS, GEAR_SETS, MILESTONES } from './constants.js';

/* ===================================================================
   STATE
   =================================================================== */
const DEF={
  res:{astral:80,shard:30,ore:0,wood:0,herb:0,fish:0,dust:0,bio:0},
  heroes:{}, squad:[null,null,null], pity:0,
  skills:{}, gear:[], equip:{weapon:null,armor:null,relic:null},
  px:39, py:43, combatLvl:1, combatXp:0, mapVer:0, bestiary:{mobs:{},gear:{},biomes:{},bosses:{}},
  clock:0.28, day:1, weatherIdx:0, weatherT:0,
  quests:{summon:0,fight:0,gather:0,claimed:{}},
  qs:{}, flags:{}, lore:[], read:{}, tabBonus:{}, activeSkill:'mining',
  firstRun:true, lastSeen:Date.now(), audio:true,
};
let S=load();
function load(){
  try{const d=JSON.parse(localStorage.getItem('astrari2'));
    if(d){const m=structuredClone(DEF);Object.assign(m,d);m.res={...DEF.res,...d.res};m.equip={...DEF.equip,...d.equip};
      m.bestiary={mobs:{},gear:{},biomes:{},bosses:{},...(d.bestiary||{})};
      m.qs=d.qs||{}; m.flags=d.flags||{}; m.lore=d.lore||[]; m.read=d.read||{}; m.tabBonus=d.tabBonus||{};
      // migrate squad to 3 strong slots (keep first filled champions)
      const picks=(d.squad||[]).filter(Boolean).slice(0,3); m.squad=[picks[0]||null,picks[1]||null,picks[2]||null];
      return m;}}catch(e){}
  return structuredClone(DEF);
}
function save(){S.lastSeen=Date.now();localStorage.setItem('astrari2',JSON.stringify(S));}
function skillXp(id){return (S.skills[id]||{xp:0}).xp;}
function lvlReq(l){return Math.floor(55*Math.pow(l,1.55));}
function levelOf(xp){let l=1;while(xp>=lvlReq(l+1)&&l<99)l++;return l;}
function skillLvl(id){return levelOf(skillXp(id));}
function combatLevel(){return levelOf(S.combatXp);}

/* ===================================================================
   WORLD GENERATION  (seeded, stable)
   =================================================================== */
const MW=78, MH=72;
// tile codes
const T_GRASS=0,T_PATH=1,T_WATER=2,T_SAND=3,T_FOREST=4,T_MTN=5,T_PLAIN=6,T_DEEP=7,
      T_SNOW=8,T_ICE=9,T_ASH=10,T_LAVA=11,T_CRYST=12;
const BIOMES={
  meadow:{name:'Verdant Meadow',ground:T_GRASS,col:'#2f6b3f',el:'flora'},
  forest:{name:'Whispering Forest',ground:T_FOREST,col:'#1f5230',el:'flora'},
  plains:{name:'Sunlit Plains',ground:T_PLAIN,col:'#3a7a4a',el:'light'},
  mountain:{name:'Skybound Peaks',ground:T_MTN,col:'#5f5852',el:'flux'},
  tundra:{name:'Frostpeak Tundra',ground:T_SNOW,col:'#c6d4e4',el:'flux'},
  ember:{name:'The Emberwaste',ground:T_ASH,col:'#39302d',el:'ember'},
  crystal:{name:'Crystal Hollows',ground:T_CRYST,col:'#2a2450',el:'void'},
  lake:{name:'Aether Lake',ground:T_WATER,col:'#2767b0',el:'flux'},
  town:{name:'Skyhaven',ground:T_PATH,col:'#6b6f7d',el:'light'},
};
let grid=[], biomeMap=[], nodes=[], buildings=[], npcs=[], monsters=[], walk=[];
function biomeAt(x,y){
  if(y < 8+Math.sin(x*0.3)*2 && x>10 && x<66) return 'lake';
  if(x>=31&&x<=47&&y>=27&&y<=41) return 'town';
  if(x<26 && y<27) return 'tundra';
  if(x>=52 && y<27) return 'crystal';
  if(x<24 && y>=27) return 'forest';
  if(x>=54 && y>=27 && y<52) return 'mountain';
  if(x>=48 && y>=52) return 'ember';
  if(y>=50 && x>=22 && x<48) return 'plains';
  return 'meadow';
}
const inb=(x,y)=>x>=0&&y>=0&&x<MW&&y<MH;
function genWorld(){
  const R=mulberry32(20260601);
  grid=[];walk=[];biomeMap=[];nodes=[];buildings=[];npcs=[];monsters=[];
  for(let y=0;y<MH;y++){grid[y]=[];walk[y]=[];biomeMap[y]=[];
    for(let x=0;x<MW;x++){const b=biomeAt(x,y);biomeMap[y][x]=b;grid[y][x]=BIOMES[b].ground;walk[y][x]=1;}}
  // LAKE depth + sandy shore
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    if(biomeMap[y][x]==='lake'){
      const edge=7+Math.sin(x*0.3)*2;
      if(y<edge-1.6){grid[y][x]=T_DEEP;walk[y][x]=0;}
      else if(y<edge){grid[y][x]=T_WATER;walk[y][x]=0;}
      else grid[y][x]=T_SAND;
    }
  }
  // blob helper for ponds / pools / wall clusters
  function blob(cx,cy,rad,setter){const r=Math.ceil(rad);
    for(let y=Math.round(cy)-r;y<=Math.round(cy)+r;y++)for(let x=Math.round(cx)-r;x<=Math.round(cx)+r;x++){
    if(inb(x,y)&&Math.hypot(x-cx,y-cy)<=rad+R()*0.6) setter(x,y);}}
  // frozen ponds (tundra)
  [[10,15],[17,9],[7,21]].forEach(([x,y])=>blob(x,y,2,(ix,iy)=>{if(biomeMap[iy][ix]==='tundra'){grid[iy][ix]=T_ICE;walk[iy][ix]=0;}}));
  // lava pools (ember)
  [[60,61],[68,56],[55,67]].forEach(([x,y])=>blob(x,y,2,(ix,iy)=>{if(biomeMap[iy][ix]==='ember'){grid[iy][ix]=T_LAVA;walk[iy][ix]=0;}}));
  // jagged impassable peaks / crystal spires (visual walls)
  [[62,18],[70,34],[66,44]].forEach(([x,y])=>blob(x,y,1.6,(ix,iy)=>{if(biomeMap[iy][ix]==='mountain'&&R()<0.7)walk[iy][ix]=0;}));
  [[60,12],[70,20],[66,8]].forEach(([x,y])=>blob(x,y,1.4,(ix,iy)=>{if(biomeMap[iy][ix]==='crystal'&&R()<0.6)walk[iy][ix]=0;}));

  // TOWN plaza paths + radiating roads from center (39,34)
  for(let y=27;y<=41;y++)for(let x=31;x<=47;x++){ if(inb(x,y)&&grid[y][x]!==T_WATER&&grid[y][x]!==T_DEEP)grid[y][x]=T_PATH; }
  function road(x,y){ if(inb(x,y)&&walk[y][x]&&grid[y][x]!==T_WATER&&grid[y][x]!==T_DEEP&&grid[y][x]!==T_LAVA&&grid[y][x]!==T_ICE)grid[y][x]=T_PATH; }
  for(let y=8;y<MH;y++){road(39,y);road(40,y);}           // N-S highway
  for(let x=4;x<MW-4;x++){road(x,34);road(x,35);}          // E-W highway
  for(let t=0;t<40;t++){ road(18-t*0,0); }                  // (noop safeguard)
  // diagonal-ish spurs to far biomes
  for(let i=0;i<22;i++){road(39-i,20-Math.floor(i*0.3));road(39+i,20-Math.floor(i*0.3));} // toward tundra & crystal
  for(let i=0;i<24;i++){road(39+i,48+Math.floor(i*0.2));}   // toward ember

  // BUILDINGS (occupy tiles, non-walkable, door at bottom-center)
  function addBuilding(x,y,w,h,kind,name){
    const b={x,y,w,h,kind,name,door:{x:x+(w>>1),y:y+h}};
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){ if(inb(x+i,y+j))walk[y+j][x+i]=0; }
    if(inb(b.door.x,b.door.y))walk[b.door.y][b.door.x]=1;
    buildings.push(b); return b;
  }
  addBuilding(33,28,3,3,'forge','The Star-Forge');
  addBuilding(43,28,3,3,'shrine','Shrine of Yvalethi');
  addBuilding(33,38,3,2,'market','Skyhaven Market');
  addBuilding(43,38,3,2,'house','Warden Lodge');
  addBuilding(38,38,2,2,'codex','Hall of Echoes');

  // RESOURCE NODES (biome-themed)
  function place(type,x,y,b){ if(!inb(x,y))return; const water=(type==='fish'||type==='ice');
    if(walk[y][x]===0&&!water)return; nodes.push({type,x,y,biome:b,depleted:0,respawn:0}); if(!water)walk[y][x]=0; }
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const b=biomeMap[y][x]; if(!walk[y][x])continue; const r=R();
    if(b==='forest'){ if(r<0.15)place('tree',x,y,b); else if(r<0.21)place('plant',x,y,b); }
    else if(b==='mountain'){ if(r<0.17)place('rock',x,y,b); }
    else if(b==='tundra'){ if(r<0.11)place('rock',x,y,b); else if(r<0.16)place('plant',x,y,b); }
    else if(b==='ember'){ if(r<0.15)place('rock',x,y,b); }
    else if(b==='crystal'){ if(r<0.13)place('crystal',x,y,b); else if(r<0.17)place('plant',x,y,b); }
    else if(b==='plains'){ if(r<0.05)place('plant',x,y,b); else if(r<0.067)place('tree',x,y,b); }
    else if(b==='meadow'){ if(r<0.03)place('plant',x,y,b); else if(r<0.04)place('tree',x,y,b); }
  }
  // lake fishing spots (water adjacent to shore)
  for(let y=1;y<10;y++)for(let x=1;x<MW-1;x++){
    if(grid[y][x]===T_WATER&&R()<0.12){ let shore=false; for(let d=1;d<=2;d++){if(inb(x,y+d)&&walk[y+d][x])shore=true;} if(shore)place('fish',x,y,'lake'); }
  }
  // ice-fishing holes on frozen ponds (adjacent to walkable snow)
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    if(grid[y][x]===T_ICE&&R()<0.4){ let edge=false; for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){if(inb(x+dx,y+dy)&&walk[y+dy][x+dx])edge=true;} if(edge)place('ice',x,y,'tundra'); }
  }

  // NPCs in town
  const npcDefs=[
    {x:35,y:31,name:'Smith Borin',role:'forge',skin:'#d8a878',cloak:'#8a4a2a'},
    {x:45,y:31,name:'Priestess Vael',role:'shrine',skin:'#e8c8a8',cloak:'#5a3b8a'},
    {x:34,y:40,name:'Trader Quill',role:'market',skin:'#caa070',cloak:'#2a6a5a'},
    {x:46,y:40,name:'Old Warden Sef',role:'lore',skin:'#e0b890',cloak:'#3a5a8a'},
    {x:39,y:40,name:'Archivist Lune',role:'codex',skin:'#cdb0e0',cloak:'#3a4a7a'},
  ];
  // wandering townsfolk (ambient, no quests)
  [{x:38,y:34,name:'Townsperson',role:'townsfolk',skin:'#d8b890',cloak:'#5a6a8a'},
   {x:42,y:36,name:'Townsperson',role:'townsfolk',skin:'#c8a878',cloak:'#7a5a8a'},
   {x:36,y:43,name:'Townsperson',role:'townsfolk',skin:'#e0c0a0',cloak:'#4a7a6a'},
  ].forEach(n=>{ if(walk[n.y]&&!walk[n.y][n.x])n.y++; npcs.push({...n,bx:n.x,by:n.y,t:R()*6,face:'down'}); });

  // ---- Session 6: lore tablets + bonfires (special interactables) ----
  function placeSpecial(type,x,y,extra){ if(!inb(x,y)||walk[y][x]===0)return false; nodes.push({type,x,y,depleted:0,...extra}); walk[y][x]=0; return true; }
  for(const bk in TABLETS){ let placed=0,tries=0; const need=TABLETS[bk].length;
    while(placed<need&&tries<6000){ tries++; const x=(R()*MW)|0,y=(R()*MH)|0;
      if(biomeMap[y]&&biomeMap[y][x]===bk&&walk[y][x]){ if(placeSpecial('tablet',x,y,{biome:bk,tid:placed}))placed++; } } }
  ['tundra','ember'].forEach(bk=>{ let placed=0,tries=0;
    while(placed<3&&tries<5000){ tries++; const x=(R()*MW)|0,y=(R()*MH)|0;
      if(biomeMap[y]&&biomeMap[y][x]===bk&&walk[y][x]){ if(placeSpecial('bonfire',x,y,{biome:bk}))placed++; } } });

  spawnMonsters();
}
// per-biome combat profiles (level range + element theme + spawn density)
const BIOME_MOBS={
  meadow:{el:['light','flora'],lo:1,hi:6,density:0.010},
  plains:{el:['light','flora'],lo:3,hi:8,density:0.016},
  forest:{el:['flora','void'],lo:6,hi:12,density:0.018},
  mountain:{el:['flux','ember'],lo:11,hi:19,density:0.020},
  tundra:{el:['flux','void'],lo:15,hi:25,density:0.018},
  ember:{el:['ember','flux'],lo:23,hi:35,density:0.020},
  crystal:{el:['void','light'],lo:31,hi:45,density:0.018},
};
const BOSSES=[
  {biome:'forest',x:8,y:46,name:'Mournroot the Strangler',el:'flora',lvl:15,drop:'r_thornheart'},
  {biome:'mountain',x:66,y:40,name:'Skarn the Peakbreaker',el:'flux',lvl:23,drop:'w_tempest'},
  {biome:'tundra',x:11,y:13,name:'Gelmara Frostwidow',el:'flux',lvl:30,drop:'a_glacial'},
  {biome:'ember',x:62,y:64,name:'Pyrrhaxis, Cinder-King',el:'ember',lvl:42,drop:'w_infernal'},
  {biome:'crystal',x:64,y:14,name:'Nullith, Echo of the Void',el:'void',lvl:52,drop:'r_voidheart'},
];
function bossHp(lvl,boss){return Math.round((70+lvl*44)*(boss?6.5:1));}
function bossAtk(lvl,boss){return Math.round((10+lvl*6)*(boss?1.7:1));}
// per-biome Hollow variants (Session 7) + elite name pool
const VARIANTS={ meadow:['Drifter','Mourner','Seeker'], plains:['Drifter','Wanderer','Seeker'],
  forest:['Thornwraith','Echoform','Grovesinger'], mountain:['Stone-Walker','Shardmind','Peakwarden'],
  tundra:['Coldwalker','Frostsinger','Glaciant'], ember:['Ember','Cinderfused','Ashen Remnant'],
  crystal:['Echomirror','Void-touched','Crystallized'] };
const ELITE_PREFIX=['Velk','Mourne','Sythe','Korrath','Ysra','Dolm','Nareth','Veld','Ashka','Threnn','Orix','Sevren'];
function spawnMonsters(){
  const R=mulberry32((Date.now()&0xffff)^0x5151);
  monsters=[];
  function addMon(x,y,lvl,el,b,boss,elite){
    const vs=VARIANTS[b]||['Hollow Spawn'], vidx=(R()*vs.length)|0;
    let hp=bossHp(lvl,boss), atk=bossAtk(lvl,boss); if(elite){ hp=Math.round(hp*1.4); atk=Math.round(atk*1.3); }
    const m={x,y,bx:x,by:y,el,lvl,biome:b,boss:boss||null,maxhp:hp,hp,atk,alive:true,t:R()*5,face:'down',cd:0,
      kind:boss?'boss':(R()<.5?'maw':'shade'), variant:vs[vidx], vidx};
    if(elite){ m.elite=true; m.eliteName=ELITE_PREFIX[(R()*ELITE_PREFIX.length)|0]+' the '+vs[vidx]; }
    monsters.push(m); }
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const b=biomeMap[y][x]; if(b==='town'||b==='lake')continue;
    const p=BIOME_MOBS[b]; if(!p||!walk[y][x])continue;
    // keep a safe ring around the town spawn
    if(dist(x,y,39,36)<6)continue;
    if(R()<p.density){
      const lvl=p.lo+(R()*(p.hi-p.lo+1)|0), el=p.el[R()*p.el.length|0];
      addMon(x,y,lvl,el,b,null,R()<0.05); // ~5% elite
    }
  }
  // biome bosses at fixed lairs
  BOSSES.forEach(B=>{ let x=B.x,y=B.y;
    if(!inb(x,y)||!walk[y][x]){const a=nearestWalkAdj(x,y);if(a){x=a[0];y=a[1];}}
    addMon(x,y,B.lvl,B.el,B.biome,B); });
}
genWorld();
function safeSpawn(cx,cy){
  for(let r=0;r<24;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    const x=cx+dx,y=cy+dy; if(inb(x,y)&&walk[y][x]&&biomeMap[y][x]==='town'&&!monAtRaw(x,y))return[x,y];}
  for(let r=0;r<40;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
    const x=cx+dx,y=cy+dy; if(inb(x,y)&&walk[y][x])return[x,y];}
  return[cx,cy];
}
function monAtRaw(x,y){return monsters.find(m=>m.alive&&Math.round(m.x)===x&&Math.round(m.y)===y);}
const MAPVER=3;
S.px=clamp(S.px,1,MW-2); S.py=clamp(S.py,1,MH-2);
// relocate to town once on the new map, or if standing somewhere invalid
if(S.mapVer!==MAPVER||!walk[S.py]||!walk[S.py][S.px]){ const s=safeSpawn(39,43); S.px=s[0];S.py=s[1]; S.mapVer=MAPVER; }
const nodeAt=(x,y)=>nodes.find(n=>n.x===x&&n.y===y&&!n.depleted);
const monAt=(x,y)=>monsters.find(m=>m.x===x&&m.y===y&&m.alive);
const npcAt=(x,y)=>npcs.find(n=>Math.round(n.bx)===x&&Math.round(n.by)===y);
const buildingAt=(x,y)=>buildings.find(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h);

/* ===================================================================
   CANVAS + CAMERA
   =================================================================== */
const cv=$('#game'), ctx=cv.getContext('2d');
let VW=430, VH=800, DPR=Math.min(window.devicePixelRatio||1,2);
function resize(){
  const ph=$('#phone'); VW=ph.clientWidth; VH=ph.clientHeight;
  cv.width=VW*DPR; cv.height=VH*DPR; cv.style.width=VW+'px'; cv.style.height=VH+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const tp=$('#top'); window.SAFE_TOP = tp? tp.offsetHeight : 52;
}
window.addEventListener('resize',resize); resize();
const cam={x:0,y:0};
function updateCam(){
  cam.x=clamp(player.px*TILE - VW/2, 0, MW*TILE-VW);
  cam.y=clamp(player.py*TILE - VH/2, 0, MH*TILE-VH);
  if(MW*TILE<VW) cam.x=(MW*TILE-VW)/2;
  if(MH*TILE<VH) cam.y=(MH*TILE-VH)/2;
}

/* ===================================================================
   PLAYER (pixel-space, follows path)
   =================================================================== */
const player={px:S.px, py:S.py, tx:S.px, ty:S.py, path:[], moving:false, face:'down', bob:0, busy:false};
player.px=S.px+0.0; player.py=S.py+0.0;
// player.px/py are tile-space floats; tx,ty = current tile

/* ===================================================================
   VECTOR AVATAR RENDERER
   spec: {kind:'hero'|'npc'|'champ'|'monster', skin,cloak,hair,weapon:bool,weaponCol,el,glow}
   Draws into ctx at pixel (cx,cy=foot point), with scale s.
   =================================================================== */
// draw an equipped weapon by type in the avatar's hand (local coords, origin at body center)
function drawWeapon(g,s,dir,col,wt){
  g.save();
  const side=(dir==='left'?-1:1);
  g.translate(side*7*s, 3*s);
  const dark=shade(col,-25), light=shade(col,35);
  if(wt==='sword'){
    g.strokeStyle='#6b5230';g.lineWidth=1.6*s;g.beginPath();g.moveTo(0,7*s);g.lineTo(0,3*s);g.stroke();
    g.fillStyle=dark;g.fillRect(-2.4*s,2*s,4.8*s,1.4*s); // guard
    g.fillStyle=col;g.beginPath();g.moveTo(-1.4*s,2*s);g.lineTo(1.4*s,2*s);g.lineTo(0,-13*s);g.closePath();g.fill();
    g.fillStyle=light;g.beginPath();g.moveTo(-0.4*s,2*s);g.lineTo(0.4*s,2*s);g.lineTo(0,-13*s);g.closePath();g.fill();
  } else if(wt==='axe'){
    g.strokeStyle='#6b5230';g.lineWidth=1.8*s;g.beginPath();g.moveTo(0,8*s);g.lineTo(0,-11*s);g.stroke();
    g.fillStyle=col;g.beginPath();g.moveTo(0,-10*s);g.quadraticCurveTo(side*9*s,-8*s,side*7*s,-2*s);g.quadraticCurveTo(side*4*s,-5*s,0,-4*s);g.closePath();g.fill();
    g.fillStyle=light;g.beginPath();g.moveTo(0,-9*s);g.quadraticCurveTo(side*6*s,-7.5*s,side*5*s,-4*s);g.lineTo(0,-5*s);g.closePath();g.fill();
  } else if(wt==='staff'){
    g.strokeStyle='#5a4a3a';g.lineWidth=1.7*s;g.beginPath();g.moveTo(0,9*s);g.lineTo(0,-10*s);g.stroke();
    g.save();drawGlow(g,0,-12*s,col,4*s,0.9);g.fillStyle=col;g.beginPath();g.arc(0,-12*s,3*s,0,7);g.fill();
    g.fillStyle=light;g.beginPath();g.arc(-0.8*s,-12.8*s,1.1*s,0,7);g.fill();g.restore();
  } else if(wt==='bow'){
    g.strokeStyle=col;g.lineWidth=1.7*s;g.beginPath();g.arc(0,-2*s,9*s,Math.PI*-0.5,Math.PI*0.5,false);g.stroke();
    g.strokeStyle='rgba(240,240,255,.7)';g.lineWidth=0.7*s;g.beginPath();g.moveTo(0,-11*s);g.lineTo(0,7*s);g.stroke();
  } else if(wt==='spear'){
    g.strokeStyle='#6b5230';g.lineWidth=1.5*s;g.beginPath();g.moveTo(0,9*s);g.lineTo(0,-12*s);g.stroke();
    g.fillStyle=col;g.beginPath();g.moveTo(-1.8*s,-11*s);g.lineTo(1.8*s,-11*s);g.lineTo(0,-17*s);g.closePath();g.fill();
    g.fillStyle=light;g.beginPath();g.moveTo(-0.5*s,-11*s);g.lineTo(0.5*s,-11*s);g.lineTo(0,-17*s);g.closePath();g.fill();
  } else {
    g.strokeStyle=shade(col,-10);g.lineWidth=1.6*s;g.beginPath();g.moveTo(0,8*s);g.lineTo(0,-9*s);g.stroke();
    g.fillStyle=col;g.beginPath();g.moveTo(-1.8*s,-7*s);g.lineTo(1.8*s,-7*s);g.lineTo(0,-13*s);g.closePath();g.fill();
  }
  g.restore();
}
function drawAvatar(g,cx,cy,s,spec,face,bob){
  bob=bob||0; face=face||'down';
  const dir=face;
  // shadow
  g.save();
  g.translate(cx,cy);
  g.fillStyle='rgba(0,0,0,.28)';
  g.beginPath();g.ellipse(0,0,7*s,3*s,0,0,7);g.fill();
  g.translate(0,-bob);
  if(spec.kind==='monster'){
    // spiky blob body — variant changes the silhouette
    const body=spec.cloak, vidx=spec.vidx||0;
    g.translate(0,-9*s);
    // tendrils (count/length varies by variant)
    g.fillStyle=shade(body,-30);
    const tend=vidx===0?2:vidx===1?3:1, tlen=vidx===2?15:12;
    for(let i=-tend;i<=tend;i++){ g.beginPath();g.moveTo(i*4*s,6*s);g.lineTo(i*4*s-2*s,tlen*s);g.lineTo(i*4*s+2*s,tlen*s);g.closePath();g.fill(); }
    // core
    const grd=g.createRadialGradient(0,0,1,0,0,9*s);
    grd.addColorStop(0,shade(body,40));grd.addColorStop(1,body);
    g.fillStyle=grd;
    g.beginPath();g.arc(0,0,8.5*s,0,7);g.fill();
    // variant 1 = crystalline shards atop; variant 2 = horned
    if(vidx===1){ g.fillStyle=shade(body,55); for(let k=-1;k<=1;k++){g.beginPath();g.moveTo(k*4*s,-6*s);g.lineTo(k*4*s-1.5*s,-2*s);g.lineTo(k*4*s+1.5*s,-2*s);g.closePath();g.fill();} }
    else if(vidx===2){ g.fillStyle=shade(body,-40); g.beginPath();g.moveTo(-7*s,-5*s);g.lineTo(-9*s,-11*s);g.lineTo(-5*s,-7*s);g.closePath();g.fill(); g.beginPath();g.moveTo(7*s,-5*s);g.lineTo(9*s,-11*s);g.lineTo(5*s,-7*s);g.closePath();g.fill(); }
    if(spec.elite){ g.fillStyle='#ffd24a'; for(let k=-1;k<=1;k++){g.beginPath();g.moveTo(k*3.5*s-1.5*s,-8.5*s);g.lineTo(k*3.5*s,-12.5*s);g.lineTo(k*3.5*s+1.5*s,-8.5*s);g.closePath();g.fill();} } // crown
    // glow eyes
    const ec=spec.glow||'#ff5a7a';
    drawGlow(g,-3*s,-1*s,ec,3.4*s,0.9);drawGlow(g,3*s,-1*s,ec,3.4*s,0.9);
    g.fillStyle=ec;
    g.beginPath();g.arc(-3*s,-1*s,1.6*s,0,7);g.arc(3*s,-1*s,1.6*s,0,7);g.fill();
    g.restore();return;
  }
  // humanoid
  g.translate(0,-22*s);
  const cloak=spec.cloak, skin=spec.skin, hair=spec.hair;
  // legs
  g.fillStyle=shade(cloak,-50);
  g.fillRect(-4*s,14*s,3.2*s,7*s); g.fillRect(0.8*s,14*s,3.2*s,7*s);
  // body/cloak
  g.fillStyle=cloak;
  g.beginPath();
  g.moveTo(-6*s,4*s); g.quadraticCurveTo(-7*s,16*s,-5*s,16*s);
  g.lineTo(5*s,16*s); g.quadraticCurveTo(7*s,16*s,6*s,4*s);
  g.quadraticCurveTo(0,-1*s,-6*s,4*s); g.fill();
  // cloak highlight
  g.fillStyle=shade(cloak,28);
  g.beginPath();g.moveTo(-6*s,4*s);g.quadraticCurveTo(0,-1*s,6*s,4*s);g.lineTo(3*s,5*s);g.quadraticCurveTo(0,2*s,-3*s,5*s);g.closePath();g.fill();
  // arms
  g.fillStyle=shade(cloak,-20);
  g.fillRect(-7*s,5*s,2.4*s,8*s); g.fillRect(4.6*s,5*s,2.4*s,8*s);
  // ARMOR overlays (scale detail with tier) — visible plate, pauldrons, trim
  const tier=spec.armorTier||0;
  if(tier>0){
    const metal=tier>=4?'#bfe8ff':tier>=3?'#a98cff':tier>=2?'#7fd0b8':'#caa15a';
    const trim=shade(metal,30);
    // chest plate
    g.fillStyle=metal;g.beginPath();g.moveTo(-4.2*s,4*s);g.quadraticCurveTo(0,1.5*s,4.2*s,4*s);g.lineTo(3.4*s,12*s);g.quadraticCurveTo(0,13.5*s,-3.4*s,12*s);g.closePath();g.fill();
    g.strokeStyle=trim;g.lineWidth=0.8*s;g.beginPath();g.moveTo(0,3*s);g.lineTo(0,12.5*s);g.stroke();
    // pauldrons (shoulder plates) — bigger with tier
    const ps=(2.2+tier*0.5)*s;
    g.fillStyle=metal;g.beginPath();g.arc(-6*s,5.5*s,ps,0,7);g.arc(6*s,5.5*s,ps,0,7);g.fill();
    g.fillStyle=trim;g.beginPath();g.arc(-6*s,4.6*s,ps*0.45,0,7);g.arc(6*s,4.6*s,ps*0.45,0,7);g.fill();
    if(tier>=3){ // belt + glow for high tiers
      g.fillStyle=shade(metal,-20);g.fillRect(-4*s,12*s,8*s,1.8*s);
      g.fillStyle=trim;g.fillRect(-1*s,11.6*s,2*s,2.6*s);
    }
    if(tier>=4){ drawGlow(g,0,7*s,metal,4*s,0.5);g.fillStyle=metal;g.beginPath();g.arc(0,7*s,1.4*s,0,7);g.fill(); }
  }
  // relic charm hovering at the hip
  if(spec.relicCol){ const rx=(dir==='left'?5:-5)*s; drawGlow(g,rx,9*s,spec.relicCol,3.5*s,0.85);
    g.fillStyle=spec.relicCol;g.beginPath();g.arc(rx,9*s,1.5*s,0,7);g.fill(); }
  // WEAPON (type-aware) in the hand
  if(spec.weapon){ drawWeapon(g,s,dir,spec.weaponCol||'#cfd8e0',spec.wt||'sword'); }
  // head
  g.fillStyle=skin;
  g.beginPath();g.arc(0,-2*s,5.2*s,0,7);g.fill();
  // hair / hood
  g.fillStyle=hair;
  g.beginPath();
  g.arc(0,-2.5*s,5.4*s,Math.PI*1.05,Math.PI*1.95);
  g.lineTo(4.6*s,-2.5*s);g.quadraticCurveTo(5*s,-6*s,0,-7.4*s);g.quadraticCurveTo(-5*s,-6*s,-4.6*s,-2.5*s);
  g.fill();
  // face (eyes) by direction
  if(dir!=='up'){
    g.fillStyle='#1a2030';
    let ex=dir==='left'?-2.4:dir==='right'?0.4:-1.6;
    g.beginPath();g.arc((ex)*s,-2*s,0.9*s,0,7);g.arc((ex+3.2)*s,-2*s,0.9*s,0,7);g.fill();
  }
  // element aura dot
  if(spec.el){ g.fillStyle=ELEM[spec.el].col; g.globalAlpha=.9;
    g.beginPath();g.arc(0,-9.5*s,1.5*s,0,7);g.fill();g.globalAlpha=1; }
  g.restore();
}
// build a champion spec
const ELEM_WT={ember:'axe',flora:'spear',flux:'staff',void:'staff',light:'sword'};
function champSpec(id){const d=champDef(id);const tierByRar={common:1,rare:2,epic:3,legend:4}[d.rar]||1;
  return{kind:'champ',skin:'#e6c4a0',cloak:ELEM[d.el].col,hair:d.hair,weapon:true,weaponCol:RAR[d.rar].col,wt:ELEM_WT[d.el]||'sword',armorTier:tierByRar,el:d.el};}
function wardenSpec(){
  const arm=S.equip.armor?GEAR[S.equip.armor]:null;
  const wpn=S.equip.weapon?GEAR[S.equip.weapon]:null;
  const rel=S.equip.relic?GEAR[S.equip.relic]:null;
  return{kind:'hero',skin:'#f0d0a8',cloak:arm?arm.col:'#3a6f8a',hair:'#2a3a52',
    weapon:!!wpn,weaponCol:wpn?wpn.col:'#9fb3c8',wt:wpn?wpn.wt:null,
    armorTier:arm?arm.tier:0,relicCol:rel?rel.col:null,el:'light'};
}
function monSpec(m){return{kind:'monster',cloak:ELEM[m.el].col,glow:m.elite?'#ffd24a':(m.el==='void'?'#c08bff':m.el==='ember'?'#ff8a4a':'#ff5a7a'),vidx:(m.vidx||0),elite:!!m.elite};}

/* ===================================================================
   TILE RENDERING
   =================================================================== */
const TCOL={
  [T_GRASS]:'#2a5d39',[T_PATH]:'#565b69',[T_WATER]:'#235d9c',[T_SAND]:'#b6a06c',
  [T_FOREST]:'#19432a',[T_MTN]:'#534d48',[T_PLAIN]:'#316a42',[T_DEEP]:'#12345d',
  [T_SNOW]:'#bccbde',[T_ICE]:'#84afce',[T_ASH]:'#302a27',[T_LAVA]:'#d8531f',[T_CRYST]:'#26214a'};
function tileNoise(x,y){return ((x*73856093)^(y*19349663))&7;}
function drawTile(x,y,px,py,g){
  g=g||ctx;
  const t=grid[y][x];
  let col=TCOL[t];
  const n=tileNoise(x,y);
  g.fillStyle=col; g.fillRect(px,py,TILE+1,TILE+1);
  if(t===T_GRASS||t===T_FOREST||t===T_PLAIN){
    // soft dappled light & shadow patches (organic, smooth) for depth
    g.fillStyle=shade(col,-13);
    if(n%2===0){g.beginPath();g.ellipse(px+9,py+18,6.5,4,0,0,7);g.fill();}
    if(n%3===0){g.beginPath();g.ellipse(px+21,py+8,5,3.4,0,0,7);g.fill();}
    g.fillStyle=shade(col,12);
    if(n%2===1){g.beginPath();g.ellipse(px+12,py+9,5.5,3.2,0,0,7);g.fill();}
    if(n%4===0){g.beginPath();g.ellipse(px+20,py+19,4.5,3,0,0,7);g.fill();}
    // a few grass blades
    g.fillStyle=shade(col,n>3?20:-2);
    if(n%3===0){g.fillRect(px+6,py+8,1.5,5);g.fillRect(px+9,py+7,1.5,6);}
    if(n%4===0){g.fillRect(px+18,py+15,1.5,5);g.fillRect(px+21,py+14,1.5,6);}
    if(n%5===0){g.fillStyle='rgba(200,255,215,.06)';g.beginPath();g.arc(px+14,py+21,1.3,0,7);g.fill();}
  }else if(t===T_WATER||t===T_DEEP){
    const shimmer=Math.sin(now*0.002 + x*0.6 + y*0.4)*0.5+0.5;
    g.fillStyle=`rgba(255,255,255,${0.05+shimmer*0.06})`;
    g.fillRect(px+4,py+ (n*3)%(TILE-6) ,TILE-10,2);
  }else if(t===T_MTN){
    g.fillStyle=shade(col,-16);g.beginPath();g.ellipse(px+8,py+10,6,4.5,0,0,7);g.fill();
    g.beginPath();g.ellipse(px+21,py+19,6,4.5,0,0,7);g.fill();
    g.fillStyle=shade(col,16);if(n%2){g.beginPath();g.ellipse(px+15,py+9,3.5,2.4,0,0,7);g.fill();}
  }else if(t===T_PATH){
    g.fillStyle=shade(col,-9);if(n%2){g.beginPath();g.ellipse(px+10,py+14,5,3.5,0,0,7);g.fill();}
    g.fillStyle=shade(col,8);if(n%3===0){g.beginPath();g.ellipse(px+20,py+9,3,2,0,0,7);g.fill();}
  }else if(t===T_SAND){
    g.fillStyle=shade(col,-12);if(n%2)g.fillRect(px+10,py+12,3,3);
  }else if(t===T_SNOW){
    g.fillStyle=shade(col,-12);if(n%3===0)g.fillRect(px+5,py+18,5,3);if(n%4===0)g.fillRect(px+18,py+8,4,3);
    g.fillStyle='rgba(255,255,255,.7)';g.beginPath();g.arc(px+8+n*2,py+10,0.9,0,7);g.arc(px+20,py+22,0.8,0,7);g.fill();
  }else if(t===T_ICE){
    const sh=Math.sin(now*0.0015+x+y)*0.5+0.5;
    g.fillStyle=`rgba(220,240,255,${0.12+sh*0.12})`;g.fillRect(px,py,TILE+1,TILE+1);
    g.strokeStyle='rgba(255,255,255,.3)';g.lineWidth=1;g.beginPath();
    g.moveTo(px+6,py+4);g.lineTo(px+14,py+16);g.lineTo(px+10,py+26);g.stroke();
  }else if(t===T_ASH){
    g.fillStyle=shade(col,n>3?10:-8);if(n%3===0)g.fillRect(px+6,py+10,7,4);
    // glowing embers
    const e=Math.sin(now*0.004+x*1.3+y)*0.5+0.5;
    g.fillStyle=`rgba(255,${90+e*80|0},40,${0.25+e*0.4})`;
    if(n%4===0){g.beginPath();g.arc(px+12,py+18,1.4,0,7);g.fill();}
    if(n%5===0){g.beginPath();g.arc(px+22,py+9,1.1,0,7);g.fill();}
  }else if(t===T_LAVA){
    const e=Math.sin(now*0.003+x+y*0.7)*0.5+0.5;
    g.fillStyle=`rgb(${200+e*55|0},${70+e*60|0},20)`;g.fillRect(px,py,TILE+1,TILE+1);
    g.strokeStyle=`rgba(255,${200+e*55|0},120,${0.4+e*0.4})`;g.lineWidth=1.5;
    g.beginPath();g.moveTo(px+4,py+8);g.lineTo(px+16,py+12);g.lineTo(px+10,py+24);g.lineTo(px+24,py+20);g.stroke();
  }else if(t===T_CRYST){
    g.fillStyle=shade(col,n>3?14:-8);if(n%3===0)g.fillRect(px+6,py+14,6,4);
    const gg=Math.sin(now*0.003+x*2+y)*0.5+0.5;
    g.fillStyle=`rgba(150,120,255,${0.18+gg*0.25})`;
    if(n%4===0){g.beginPath();g.arc(px+13,py+12,1.3,0,7);g.fill();}
    if(n%5===0){g.fillStyle=`rgba(120,220,255,${0.18+gg*0.25})`;g.beginPath();g.arc(px+22,py+20,1,0,7);g.fill();}
  }
}
// Cached tile layer: rebuild the offscreen buffer only when the camera crosses a
// tile boundary or every ~90ms (keeps water/lava/ice animation alive), then blit.
let tileBuf=null, tileBufCtx=null, tbCols=0, tbRows=0, tbX0=-1, tbY0=-1, tbBuilt=0;
function drawTileLayer(){
  const cols=Math.ceil(VW/TILE)+2, rows=Math.ceil(VH/TILE)+2;
  if(!tileBuf||tbCols!==cols||tbRows!==rows){
    tileBuf=document.createElement('canvas'); tileBuf.width=cols*TILE; tileBuf.height=rows*TILE;
    tileBufCtx=tileBuf.getContext('2d'); tbCols=cols; tbRows=rows; tbX0=-1;
  }
  const x0=Math.floor(cam.x/TILE), y0=Math.floor(cam.y/TILE);
  if(x0!==tbX0||y0!==tbY0||now-tbBuilt>90){
    const g=tileBufCtx; g.fillStyle='#06203a'; g.fillRect(0,0,tileBuf.width,tileBuf.height);
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const tx=x0+i, ty=y0+j; if(tx<0||ty<0||tx>=MW||ty>=MH)continue;
      drawTile(tx,ty,i*TILE,j*TILE,g);
    }
    tbX0=x0; tbY0=y0; tbBuilt=now;
  }
  ctx.drawImage(tileBuf, x0*TILE-cam.x, y0*TILE-cam.y);
}
// biome-aware foliage palettes
const TREE_PAL={ forest:['#23713e','#2c8a4c','#37a05a'], plains:['#2c7a44','#35924f','#42a85c'],
  meadow:['#2c7a44','#37994f','#46b562'], tundra:['#2a5a48','#356b54','#dfe9f2'] };
function drawTree(px,py,biome){
  const pal=TREE_PAL[biome]||TREE_PAL.forest, snow=biome==='tundra';
  ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(px+TILE/2,py+TILE-3,9,3.5,0,0,7);ctx.fill();
  ctx.fillStyle=snow?'#6a5238':'#5a3b22';ctx.fillRect(px+TILE/2-2.5,py+TILE-16,5,14);
  ctx.fillStyle='rgba(0,0,0,.12)';ctx.fillRect(px+TILE/2+0.5,py+TILE-16,2,14);
  if(snow){ // conifer triangles
    for(let i=0;i<3;i++){ ctx.fillStyle=pal[i===2?2:i];ctx.beginPath();
      ctx.moveTo(px+TILE/2-9+i*1.5,py+TILE-10-i*5);ctx.lineTo(px+TILE/2+9-i*1.5,py+TILE-10-i*5);ctx.lineTo(px+TILE/2,py+TILE-22-i*5);ctx.closePath();ctx.fill(); }
    ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.moveTo(px+TILE/2-4,py+TILE-13);ctx.lineTo(px+TILE/2+4,py+TILE-13);ctx.lineTo(px+TILE/2,py+TILE-18);ctx.closePath();ctx.fill();
  } else {
    const cx=px+TILE/2;
    // layered canopy blobs for a rounder, fuller crown
    const blobs=[[-5,-15,8],[5,-15,8],[0,-19,9.5],[-3,-24,7],[4,-23,6.5],[0,-27,5.5]];
    for(let i=0;i<blobs.length;i++){ const lvl=Math.min(2,Math.floor(i/2));
      ctx.fillStyle=pal[lvl];ctx.beginPath();ctx.arc(cx+blobs[i][0],py+TILE+blobs[i][1],blobs[i][2],0,7);ctx.fill(); }
    // rim light on upper-left, shadow on lower-right
    ctx.fillStyle='rgba(190,255,210,.4)';ctx.beginPath();ctx.arc(cx-4,py+TILE-27,2.2,0,7);ctx.arc(cx-6,py+TILE-22,1.6,0,7);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.14)';ctx.beginPath();ctx.arc(cx+5,py+TILE-15,4.5,0,7);ctx.fill();
  }
}
function drawRock(px,py,biome){
  ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(px+TILE/2,py+TILE-4,10,4,0,0,7);ctx.fill();
  let base='#7a736b',light='#948c82',glint='#ffd479';
  if(biome==='tundra'){base='#8fa6bd';light='#bcd0e2';glint='#d6f0ff';}
  else if(biome==='ember'){base='#332a2a';light='#4a3c3a';glint='#ff7a3a';}
  const dark=biome==='tundra'?'#5e7488':biome==='ember'?'#1d1616':'#4a443e';
  // dark outline silhouette for crisp edges
  ctx.fillStyle=dark;ctx.beginPath();
  ctx.moveTo(px+4,py+TILE-3);ctx.lineTo(px+7,py+8);ctx.lineTo(px+14,py+4);ctx.lineTo(px+22,py+6);ctx.lineTo(px+26,py+TILE-3);ctx.closePath();ctx.fill();
  // main body
  ctx.fillStyle=base;ctx.beginPath();
  ctx.moveTo(px+5,py+TILE-4);ctx.lineTo(px+8,py+9);ctx.lineTo(px+14,py+5);ctx.lineTo(px+21,py+7);ctx.lineTo(px+25,py+TILE-4);ctx.closePath();ctx.fill();
  // lit upper facet
  ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(px+8,py+9);ctx.lineTo(px+14,py+5);ctx.lineTo(px+21,py+7);ctx.lineTo(px+15,py+16);ctx.closePath();ctx.fill();
  // shaded lower-right facet
  ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(px+15,py+16);ctx.lineTo(px+21,py+7);ctx.lineTo(px+25,py+TILE-4);ctx.lineTo(px+17,py+TILE-4);ctx.closePath();ctx.fill();
  // crack line
  ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+14,py+6);ctx.lineTo(px+15,py+16);ctx.lineTo(px+11,py+TILE-5);ctx.stroke();
  // embedded ore veins + animated sparkle
  const tw=0.5+0.5*Math.sin(now*0.006+px);
  drawGlow(ctx,px+13,py+16,glint,3+tw*2.5,0.9);
  ctx.fillStyle=glint;
  ctx.beginPath();ctx.arc(px+13,py+16,1.7,0,7);ctx.arc(px+19,py+19,1.3,0,7);ctx.arc(px+10,py+12,1,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,'+(0.4+tw*0.5)+')';ctx.beginPath();ctx.arc(px+12.4,py+15.4,0.7,0,7);ctx.fill();
}
function drawCrystal(px,py){
  ctx.fillStyle='rgba(60,30,120,.3)';ctx.beginPath();ctx.ellipse(px+TILE/2,py+TILE-4,9,3.5,0,0,7);ctx.fill();
  const g=Math.sin(now*0.004+px)*0.5+0.5;
  const cols=['#7a5cff','#5ad0ff','#c08bff'];
  for(let i=0;i<3;i++){ ctx.save();ctx.translate(px+TILE/2+(i-1)*5,py+TILE-5);
    drawGlow(ctx,0,-7-i,cols[i],5+g*3,0.85);
    ctx.fillStyle=cols[i];
    ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(3,0);ctx.lineTo(1.5,-13-i*2);ctx.lineTo(-1.5,-13-i*2);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillRect(-1,-11-i*2,1.4,9);ctx.restore(); }
}
function drawPlant(px,py,biome){
  let leaf='#2c8a52',leaf2='#37a463',leafD='#1d6038',bloom='#b388ff';
  if(biome==='tundra'){leaf='#4f7e8e';leaf2='#67a0ad';leafD='#3a5e6a';bloom='#9be8ff';}
  else if(biome==='crystal'){leaf='#4a3a7a';leaf2='#5e4d96';leafD='#352a58';bloom='#7ad0ff';}
  else if(biome==='plains'){leaf='#3a9a5a';leaf2='#4cb56e';leafD='#2a6e40';bloom='#ffd479';}
  const cx=px+TILE/2, by=py+TILE-4;
  ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(cx,by,8,3,0,0,7);ctx.fill();
  // rounded leafy bush from overlapping blobs, dark base then lit top
  const lobes=[[-5,-4,5,leafD],[5,-4,5,leafD],[0,-5,5.5,leafD],[-4,-8,4.5,leaf],[4,-8,4.5,leaf],[0,-10,5,leaf],[-2,-12,3.6,leaf2],[3,-12,3.4,leaf2]];
  for(const l of lobes){ ctx.fillStyle=l[3];ctx.beginPath();ctx.arc(cx+l[0],by+l[1],l[2],0,7);ctx.fill(); }
  // highlight speckles
  ctx.fillStyle='rgba(255,255,255,.18)';ctx.beginPath();ctx.arc(cx-3,by-12,1.4,0,7);ctx.arc(cx+2,by-13,1.1,0,7);ctx.fill();
  // berries / blooms
  drawGlow(ctx,cx,by-9,bloom,5,0.6);
  ctx.fillStyle=bloom;
  ctx.beginPath();ctx.arc(cx-3,by-7,1.9,0,7);ctx.arc(cx+4,by-9,1.7,0,7);ctx.arc(cx+1,by-13,1.7,0,7);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.6)';ctx.beginPath();ctx.arc(cx-3.6,by-7.6,0.6,0,7);ctx.arc(cx+3.4,by-9.6,0.6,0,7);ctx.fill();
}
function drawFishSpot(px,py,ice){
  const cx=px+TILE/2, cy=py+TILE/2;
  if(ice){
    // ice fishing hole: dark water ring cut into ice
    ctx.fillStyle='#0a2438';ctx.beginPath();ctx.ellipse(cx,cy,8,6,0,0,7);ctx.fill();
    ctx.strokeStyle='rgba(200,235,255,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cx,cy,8,6,0,0,7);ctx.stroke();
    const r=3+Math.sin(now*0.004+px)*1.5;
    ctx.strokeStyle='rgba(150,220,255,.6)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.stroke();
    return;
  }
  const r=6+Math.sin(now*0.004+px)*2;
  ctx.strokeStyle='rgba(180,240,255,.6)';ctx.lineWidth=1.4;
  ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy,r*0.5,0,7);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.5)';ctx.beginPath();ctx.arc(cx+3,cy-2,1.4,0,7);ctx.fill();
}
function drawTablet(px,py,n){ const cx=px+TILE/2, read=S.read&&S.read[n.biome+'_'+n.tid];
  ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(cx,py+TILE-4,8,3,0,0,7);ctx.fill();
  if(!read){ const g=0.5+0.5*Math.sin(now*0.004+px); drawGlow(ctx,cx,py+TILE-14,'#7ad0ff',6+g*3,0.7); }
  ctx.fillStyle='#36465a'; ctx.fillRect(cx-5,py+TILE-22,10,18);                 // stele
  ctx.fillStyle=read?'#46566e':'#5aa0c8'; ctx.fillRect(cx-3.5,py+TILE-19,7,12);  // glyph panel
  ctx.fillStyle='rgba(220,240,255,.6)'; for(let i=0;i<3;i++)ctx.fillRect(cx-2.5,py+TILE-17+i*3.2,5,1);
  if(read){ ctx.fillStyle='#5ce6a4';ctx.font='8px sans-serif';ctx.textAlign='center';ctx.fillText('✓',cx,py+TILE-25); } }
function drawBonfire(px,py,n){ const cx=px+TILE/2, by=py+TILE-5, f=0.6+0.4*Math.sin(now*0.012+px);
  ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(cx,by+2,9,3,0,0,7);ctx.fill();
  ctx.strokeStyle='#3a2a1a';ctx.lineWidth=2.5; for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(cx+i*4,by+1);ctx.lineTo(cx-i*3,by-5);ctx.stroke();}
  drawGlow(ctx,cx,by-8,'#ff8a3a',12+f*5,0.85);
  ctx.fillStyle='#ff7a2a';ctx.beginPath();ctx.moveTo(cx-5,by);ctx.quadraticCurveTo(cx-3,by-13*f,cx,by-16*f);ctx.quadraticCurveTo(cx+3,by-13*f,cx+5,by);ctx.closePath();ctx.fill();
  ctx.fillStyle='#ffd24a';ctx.beginPath();ctx.moveTo(cx-2.5,by);ctx.quadraticCurveTo(cx,by-8*f,cx,by-11*f);ctx.quadraticCurveTo(cx+2.5,by-7*f,cx+2.5,by);ctx.closePath();ctx.fill(); }
function readTablet(n){ const id=n.biome+'_'+n.tid, t=TABLETS[n.biome]&&TABLETS[n.biome][n.tid]; if(!t)return;
  const first=!(S.read&&S.read[id]); if(!S.read)S.read={}; S.read[id]=1; logLore('tablet',id);
  if(first){ updateObjective('read',id,1); updateObjective('read','*',1); checkBiomeTablets(n.biome); save();
    burstMotes(n.x*TILE+TILE/2,n.y*TILE+TILE-12,'#7ad0ff',6); }
  modal(`<h2>📜 ${t.title}</h2><div class="muted" style="font-size:11px;margin:-6px 0 8px">${BIOME_LABEL[n.biome]||n.biome} · lore tablet</div>
    <div class="card glow-legend"><div style="font-style:italic;line-height:1.75;font-size:13px">${t.text}</div></div>`); }
function checkBiomeTablets(biome){ const all=TABLETS[biome]||[]; if(!all.length)return;
  const got=all.every((_,i)=>S.read&&S.read[biome+'_'+i]);
  if(got && !(S.tabBonus&&S.tabBonus[biome])){ if(!S.tabBonus)S.tabBonus={}; S.tabBonus[biome]=1;
    S.res.shard+=25; S.res.astral+=80; save(); updateHUD();
    toast('📖 '+(BIOME_LABEL[biome]||biome)+' lore complete! +80◈ +25✦');
    burstRing(player.px*TILE+TILE/2,player.py*TILE+TILE-14,'#7ad0ff',18,100); } }
function restAtBonfire(n){ exposure=100; expState=''; toast('You warm yourself by the fire. 🔥');
  burstMotes(n.x*TILE+TILE/2,n.y*TILE+TILE-10,'#ff9a4a',7); }
function drawBuilding(b){
  const px=b.x*TILE-cam.x, py=b.y*TILE-cam.y, w=b.w*TILE, h=b.h*TILE;
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(px+4,py+h-6,w,8);
  // walls
  const wallCol=b.kind==='forge'?'#5a4538':b.kind==='shrine'?'#3a4a6a':b.kind==='market'?'#4a5a3a':b.kind==='codex'?'#3a3050':'#4a4458';
  ctx.fillStyle=wallCol;ctx.fillRect(px,py+h*0.32,w,h*0.68);
  ctx.fillStyle=shade(wallCol,18);ctx.fillRect(px,py+h*0.32,w,5);
  // roof
  ctx.fillStyle=b.kind==='forge'?'#8a3a2a':b.kind==='shrine'?'#6a4aa0':b.kind==='market'?'#2a7a5a':b.kind==='codex'?'#4a3a7a':'#5a4a8a';
  ctx.beginPath();ctx.moveTo(px-4,py+h*0.36);ctx.lineTo(px+w/2,py-4);ctx.lineTo(px+w+4,py+h*0.36);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.12)';ctx.beginPath();ctx.moveTo(px-4,py+h*0.36);ctx.lineTo(px+w/2,py-4);ctx.lineTo(px+w/2,py+h*0.36);ctx.closePath();ctx.fill();
  // windows — warm glow at night
  const night=dayTint().dark>0.25;
  const wy=py+h*0.46, lit=night?'#ffd98a':'#1a2230';
  if(night){drawGlow(ctx,px+w*0.26,wy,'#ffcf6e',7,0.5);drawGlow(ctx,px+w*0.74,wy,'#ffcf6e',7,0.5);}
  ctx.fillStyle=lit;ctx.fillRect(px+w*0.26-4,wy-4,8,8);ctx.fillRect(px+w*0.74-4,wy-4,8,8);
  // door
  ctx.fillStyle='#241a14';ctx.fillRect(px+w/2-6,py+h-14,12,14);
  // sign icon
  ctx.font='13px serif';ctx.textAlign='center';
  const icon=b.kind==='forge'?'🔨':b.kind==='shrine'?'✦':b.kind==='market'?'⚖':b.kind==='codex'?'📖':'🛏';
  ctx.fillText(icon,px+w/2,py+h*0.62);
  // glow for forge at night
  if(b.kind==='forge'){ctx.fillStyle='rgba(255,140,60,'+(0.25+0.15*Math.sin(now*0.005))+')';ctx.beginPath();ctx.arc(px+w/2,py+h-7,10,0,7);ctx.fill();}
  if(b.kind==='codex'){ctx.fillStyle='rgba(150,120,255,'+(0.18+0.12*Math.sin(now*0.004))+')';ctx.beginPath();ctx.arc(px+w/2,py+h*0.5,12,0,7);ctx.fill();}
}

/* ===================================================================
   WEATHER + DAY/NIGHT
   =================================================================== */
let drops=[], fogParts=[], lightning=0;
function initWeatherParts(){
  drops=[];for(let i=0;i<80;i++)drops.push({x:Math.random()*VW,y:Math.random()*VH,sp:6+Math.random()*6,len:8+Math.random()*8});
  fogParts=[];for(let i=0;i<10;i++)fogParts.push({x:Math.random()*VW,y:Math.random()*VH,r:80+Math.random()*120,sp:0.2+Math.random()*0.3});
}
initWeatherParts();
function curWeather(){return WEATHERS[S.weatherIdx%WEATHERS.length];}
function updateWeather(dt){
  S.weatherT+=dt;
  if(S.weatherT>26){ S.weatherT=0; S.weatherIdx=(S.weatherIdx+1+(Math.random()*2|0))%WEATHERS.length; setAmbientForWeather(); }
  S.clock+=dt/240; // full day = 240s
  if(S.clock>=1){S.clock-=1;S.day++;}
  if(curWeather()==='storm'&&Math.random()<0.004)lightning=1;
  if(lightning>0)lightning=Math.max(0,lightning-dt*2.5);
}
function dayTint(){ // returns overlay rgba based on clock
  const t=S.clock; // 0=midnight .25=dawn .5=noon .75=dusk
  // night darkness
  let dark=0;
  if(t<0.22||t>0.80) dark=0.55;
  else if(t<0.30) dark=lerp(0.55,0,(t-0.22)/0.08);
  else if(t>0.72) dark=lerp(0,0.55,(t-0.72)/0.08);
  let tint='10,16,40';
  if(t>=0.22&&t<0.32) tint='80,50,40';      // dawn warm
  else if(t>=0.70&&t<0.80) tint='90,40,60';  // dusk
  return {dark, tint};
}
function timeLabel(){const t=S.clock;
  if(t<0.22)return'Night';if(t<0.32)return'Dawn';if(t<0.48)return'Morning';if(t<0.58)return'Noon';
  if(t<0.70)return'Afternoon';if(t<0.80)return'Dusk';return'Night';}
function drawWeatherOverlay(){
  const w=curWeather(), dt=dayTint();
  // (night darkness is handled by drawLighting() so light sources can punch through)
  // clouds = slight grey
  if(w==='cloud'){ctx.fillStyle='rgba(120,130,150,.12)';ctx.fillRect(0,0,VW,VH);}
  if(w==='rain'||w==='storm'){
    ctx.strokeStyle='rgba(170,200,235,.5)';ctx.lineWidth=1.4;ctx.beginPath();
    drops.forEach(d=>{d.y+=d.sp;d.x+=2; if(d.y>VH){d.y=-10;d.x=Math.random()*VW;} ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-2,d.y+d.len);});
    ctx.stroke();
    ctx.fillStyle='rgba(40,55,80,.18)';ctx.fillRect(0,0,VW,VH);
  }
  if(w==='fog'){
    fogParts.forEach(f=>{f.x+=f.sp;if(f.x-f.r>VW)f.x=-f.r;
      const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);
      g.addColorStop(0,'rgba(200,210,225,.16)');g.addColorStop(1,'rgba(200,210,225,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,7);ctx.fill();});
  }
  if(w==='aurora'&&dt.dark>0.2){
    for(let i=0;i<3;i++){const yy=40+i*26+Math.sin(now*0.001+i)*14;
      const g=ctx.createLinearGradient(0,yy,VW,yy+40);
      g.addColorStop(0,'rgba(70,232,200,0)');g.addColorStop(0.5,`rgba(${i%2?'120,180,255':'90,232,170'},.22)`);g.addColorStop(1,'rgba(179,136,255,0)');
      ctx.fillStyle=g;ctx.fillRect(0,yy,VW,50);}
  }
  if(lightning>0.3){ctx.fillStyle=`rgba(255,255,255,${lightning*0.4})`;ctx.fillRect(0,0,VW,VH);}
}
/* ---- DYNAMIC LIGHTING ---- offscreen darkness layer with light pools punched out */
let lightCanvas=null, lgx=null;
function punchLight(lg,x,y,r,strength){ if(x<-r||y<-r||x>VW+r||y>VH+r)return;
  const g=lg.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,`rgba(0,0,0,${strength})`);g.addColorStop(0.65,`rgba(0,0,0,${strength*0.42})`);g.addColorStop(1,'rgba(0,0,0,0)');
  lg.fillStyle=g;lg.fillRect(x-r,y-r,r*2,r*2); }
function drawLighting(){
  const dt=dayTint();
  if(dt.dark<0.04)return; // daytime — no lighting layer
  if(!lightCanvas){lightCanvas=document.createElement('canvas');}
  if(lightCanvas.width!==VW||lightCanvas.height!==VH){lightCanvas.width=VW;lightCanvas.height=VH;lgx=lightCanvas.getContext('2d');}
  const lg=lgx;
  lg.globalCompositeOperation='source-over';
  lg.clearRect(0,0,VW,VH);
  lg.fillStyle=`rgba(${dt.tint},${Math.min(0.84,dt.dark*1.4)})`;
  lg.fillRect(0,0,VW,VH);
  // punch out pools of light
  lg.globalCompositeOperation='destination-out';
  const tints=[];
  const pulse=1+Math.sin(now*0.004)*0.05;
  punchLight(lg, player.px*TILE+TILE/2-cam.x, player.py*TILE+TILE/2-cam.y, 88*pulse, 0.92);
  buildings.forEach(b=>{ const cx=(b.x+b.w/2)*TILE-cam.x, cy=(b.y+b.h/2)*TILE-cam.y;
    if(cx<-130||cy<-130||cx>VW+130||cy>VH+130)return;
    if(b.kind==='forge'){const fl=1+Math.sin(now*0.011)*0.08;punchLight(lg,cx,cy,84*fl,0.9);tints.push([cx,cy,96,'255,150,60',0.55*fl]);}
    else if(b.kind==='shrine'){punchLight(lg,cx,cy,80,0.85);tints.push([cx,cy,90,'150,120,255',0.42]);}
    else if(b.kind==='codex'){punchLight(lg,cx,cy,72,0.8);tints.push([cx,cy,80,'150,120,255',0.34]);}
    else {punchLight(lg,cx,cy,58,0.8);tints.push([cx,cy,64,'255,210,150',0.3]);} });
  nodes.forEach(n=>{ if(n.type==='crystal'&&!n.depleted){ const cx=n.x*TILE-cam.x+TILE/2, cy=n.y*TILE-cam.y+TILE/2;
    if(cx<-60||cy<-60||cx>VW+60||cy>VH+60)return; const cg=1+Math.sin(now*0.004+n.x)*0.12;
    punchLight(lg,cx,cy,40*cg,0.7); tints.push([cx,cy,46,'130,170,255',0.42]); } });
  monsters.forEach(m=>{ if(m.boss&&m.alive){ const cx=m.x*TILE-cam.x+TILE/2, cy=m.y*TILE-cam.y+TILE/2;
    if(cx<-90||cy<-90||cx>VW+90||cy>VH+90)return; punchLight(lg,cx,cy,62,0.55); tints.push([cx,cy,66,'255,70,70',0.4]); } });
  // colored warmth inside the pools
  lg.globalCompositeOperation='lighter';
  for(const s of tints){ const[cx,cy,r,col,a]=s; const g=lg.createRadialGradient(cx,cy,0,cx,cy,r);
    g.addColorStop(0,`rgba(${col},${a})`);g.addColorStop(1,`rgba(${col},0)`); lg.fillStyle=g; lg.fillRect(cx-r,cy-r,r*2,r*2); }
  lg.globalCompositeOperation='source-over';
  ctx.drawImage(lightCanvas,0,0);
}
/* ---- SCREEN EFFECTS ---- vignette, per-biome color grade, screen shake ---- */
let vignSprite=null;
function drawVignette(){
  if(!vignSprite||vignSprite.width!==VW||vignSprite.height!==VH){
    vignSprite=document.createElement('canvas');vignSprite.width=VW;vignSprite.height=VH;
    const v=vignSprite.getContext('2d');
    const g=v.createRadialGradient(VW/2,VH*0.46,Math.min(VW,VH)*0.32,VW/2,VH*0.5,Math.max(VW,VH)*0.72);
    g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(0.7,'rgba(0,0,0,0.12)');g.addColorStop(1,'rgba(4,6,12,0.5)');
    v.fillStyle=g;v.fillRect(0,0,VW,VH);
  }
  ctx.drawImage(vignSprite,0,0);
}
const BIOME_GRADE={ tundra:'120,160,210', ember:'214,92,40', crystal:'124,92,208', lake:'60,120,190', mountain:'150,160,180' };
function drawBiomeGrade(){
  const cx=Math.floor((cam.x+VW/2)/TILE), cy=Math.floor((cam.y+VH/2)/TILE);
  if(cx<0||cy<0||cx>=MW||cy>=MH)return;
  const b=biomeMap[cy][cx], col=BIOME_GRADE[b];
  if(!col)return;
  ctx.fillStyle=`rgba(${col},0.07)`; ctx.fillRect(0,0,VW,VH);
}
let shakeMag=0;
function addShake(m){ shakeMag=Math.min(10,Math.max(shakeMag,m)); }

/* ===================================================================
   PATHFINDING (BFS)
   =================================================================== */
function bfs(sx,sy,tx,ty){
  if(sx===tx&&sy===ty)return[];
  const key=(x,y)=>y*MW+x;
  const q=[[sx,sy]], prev=new Map(); prev.set(key(sx,sy),null);
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  let found=false;
  while(q.length){
    const [x,y]=q.shift();
    if(x===tx&&y===ty){found=true;break;}
    for(const[dx,dy]of dirs){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
      if(!walk[ny][nx])continue;
      if(prev.has(key(nx,ny)))continue;
      prev.set(key(nx,ny),[x,y]); q.push([nx,ny]);
    }
  }
  if(!found)return null;
  const path=[]; let c=[tx,ty];
  while(c){ path.push(c); const p=prev.get(key(c[0],c[1])); c=p; }
  path.reverse(); path.shift(); // drop start
  return path;
}
function nearestWalkAdj(x,y){ // nearest walkable tile adjacent to (x,y)
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  for(const[dx,dy]of dirs){const nx=x+dx,ny=y+dy; if(nx>=0&&ny>=0&&nx<MW&&ny<MH&&walk[ny][nx])return[nx,ny];}
  return null;
}
let pendingInteract=null; // {kind,obj}
function moveTo(tx,ty,interact){
  const sx=Math.round(player.px), sy=Math.round(player.py);
  let path=bfs(sx,sy,tx,ty);
  if(path===null){ // target maybe unwalkable -> go adjacent
    const adj=nearestWalkAdj(tx,ty);
    if(adj){ path=bfs(sx,sy,adj[0],adj[1]); }
  }
  if(path&&path.length){ player.path=path; player.moving=true; pendingInteract=interact||null; }
  else if(path&&path.length===0&&interact){ pendingInteract=interact; tryInteract(); }
}
function stepPlayer(dt){
  if(!player.path.length){player.moving=false; if(pendingInteract)tryInteract(); return;}
  const [nx,ny]=player.path[0];
  const dx=nx-player.px, dy=ny-player.py;
  const d=Math.hypot(dx,dy);
  if(dx>0.05)player.face='right';else if(dx<-0.05)player.face='left';
  else if(dy>0.05)player.face='down';else if(dy<-0.05)player.face='up';
  const sp=4.2*dt;
  if(d<=sp){ player.px=nx;player.py=ny;player.path.shift();
    player.tx=nx;player.ty=ny; S.px=nx;S.py=ny;
    visitBiome(nx,ny);
    // mid-path monster contact?
    checkAmbush();
  } else { player.px+=dx/d*sp; player.py+=dy/d*sp; }
  player.bob=Math.abs(Math.sin(now*0.012))*2.5;
}
let lastAmbBiome=null;
function visitBiome(x,y){ if(!inb(x,y))return; const b=biomeMap[y]&&biomeMap[y][x]; if(!b)return;
  if(b!==lastAmbBiome){ lastAmbBiome=b; setAmbientForBiome(b); }
  if(!S.bestiary.biomes[b]){ S.bestiary.biomes[b]=true; updateObjective('reach', b, 1); } }
function checkAmbush(){
  const px=Math.round(player.px),py=Math.round(player.py);
  for(const m of monsters){ if(m.alive&&dist(px,py,m.x,m.y)<=1){ startEncounter(m); return; } }
}

/* ===================================================================
   MONSTER + NPC WANDER
   =================================================================== */
function wander(e,dt,region){
  e.t-=dt;
  if(e.t<=0){
    e.t=1.5+Math.random()*3;
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    const[dx,dy]=dirs[Math.random()*4|0];
    const nx=Math.round(e.x)+dx, ny=Math.round(e.y)+dy;
    if(nx>=0&&ny>=0&&nx<MW&&ny<MH&&walk[ny][nx]&&dist(nx,ny,e.bx,e.by)<=region&&!monAt(nx,ny)){
      e.tgX=nx;e.tgY=ny; e.face=dx>0?'right':dx<0?'left':dy>0?'down':'up';
    }
  }
  if(e.tgX!==undefined){
    const dx=e.tgX-e.x,dy=e.tgY-e.y,d=Math.hypot(dx,dy),sp=1.6*dt;
    if(d<=sp){e.x=e.tgX;e.y=e.tgY;e.tgX=undefined;}else{e.x+=dx/d*sp;e.y+=dy/d*sp;}
  }
}
function updateEntities(dt){
  if(player.busy)return;
  monsters.forEach(m=>{if(m.alive)wander(m,dt,7);});
  npcs.forEach(n=>{wander(n,dt,2);});
  // monster contact (aggro within 1 tile of player when player idle too)
  checkAmbush();
}

/* ===================================================================
   MAIN RENDER
   =================================================================== */
let now=performance.now(), last=now;
// dev perf hook — render-time (ms, device-independent CPU cost) + fps
const perf={rt:0, rtAvg:0, fps:0, _frames:0, _t0:now};
window.__perf=perf;
// synchronous render benchmark — times N render() calls (visibility-independent CPU cost)
window.__bench=(n=80)=>{ const t0=performance.now(); for(let i=0;i<n;i++){ now=performance.now(); render(); } return +((performance.now()-t0)/n).toFixed(3); };
window.__tp=(x,y)=>{ player.px=player.tx=x; player.py=player.ty=y; S.px=x; S.py=y; player.path=[]; player.moving=false; return [x,y]; };
window.__spawnFx=(type,frames)=>{ const wx=player.px*TILE+TILE/2, wy=player.py*TILE+TILE-10;
  if(type==='ring')burstRing(wx,wy,'#ffd479',20,110); else if(type==='motes')burstMotes(wx,wy,'#9be8ff',8); else burstSpray(wx,wy,'#9bd66a',16);
  for(let k=0;k<(frames||5);k++){ now=performance.now(); updateParticles(0.03); render(); } return 'fx '+type; };
window.__time=(t)=>{ S.clock=t; now=performance.now(); render(); return 'clock='+t+' ('+timeLabel()+')'; };
function render(){
  if(interior){ renderInterior(); drawFade(); return; }
  updateCam();
  ctx.save();
  if(shakeMag>0.2){ ctx.translate((Math.random()*2-1)*shakeMag,(Math.random()*2-1)*shakeMag); }
  drawTileLayer();
  const x0=Math.floor(cam.x/TILE), y0=Math.floor(cam.y/TILE);
  const x1=Math.min(MW,x0+Math.ceil(VW/TILE)+2), y1=Math.min(MH,y0+Math.ceil(VH/TILE)+2);
  // visibility cull window (tiles)
  const vis=(ex,ey)=>ex>=x0-2&&ex<=x1+1&&ey>=y0-2&&ey<=y1+1;
  // fishing / ice spots (on water, drawn before depth-sort objects)
  nodes.forEach(n=>{ if((n.type==='fish'||n.type==='ice')&&!n.depleted&&vis(n.x,n.y))drawFishSpot(n.x*TILE-cam.x,n.y*TILE-cam.y,n.type==='ice'); });

  // depth-sorted drawable objects (culled)
  const draws=[];
  nodes.forEach(n=>{ if(n.depleted||n.type==='fish'||n.type==='ice'||!vis(n.x,n.y))return;
    draws.push({y:n.y, fn:()=>{const px=n.x*TILE-cam.x,py=n.y*TILE-cam.y;
      if(n.type==='tree')drawTree(px,py,n.biome); else if(n.type==='rock')drawRock(px,py,n.biome);
      else if(n.type==='crystal')drawCrystal(px,py); else if(n.type==='tablet')drawTablet(px,py,n); else if(n.type==='bonfire')drawBonfire(px,py,n); else drawPlant(px,py,n.biome);}}); });
  buildings.forEach(b=>{ if(vis(b.x,b.y)||vis(b.x+b.w,b.y+b.h))draws.push({y:b.y+b.h-1, fn:()=>drawBuilding(b)}); });
  npcs.forEach(n=>{ if(vis(n.bx,n.by))draws.push({y:n.by, fn:()=>drawAvatar(ctx,n.bx*TILE-cam.x+TILE/2,n.by*TILE-cam.y+TILE-2,1,{kind:'npc',skin:n.skin,cloak:n.cloak,hair:'#2a2030',weapon:false},n.face,0)}); });
  monsters.forEach(m=>{ if(!m.alive||!vis(m.x,m.y))return;
    draws.push({y:m.y, fn:()=>{ const sc=m.boss?1.7:(m.elite?1.32:1);
      const cx2=m.x*TILE-cam.x+TILE/2, cy2=m.y*TILE-cam.y+TILE-2;
      if(m.elite)drawGlow(ctx,cx2,cy2-9,'#ffb43a',13+Math.sin(now*0.005+m.x)*3,0.5); // elite aura
      drawAvatar(ctx,cx2,cy2,sc,monSpec(m),m.face,Math.sin(now*0.006+m.x)*1.5);
      if(m.boss){ ctx.fillStyle='rgba(255,210,90,.95)';ctx.font='bold 9px sans-serif';ctx.textAlign='center';
        ctx.fillText('☠ '+m.boss.name.split(/[ ,]/)[0]+' Lv'+m.lvl, cx2, m.y*TILE-cam.y-8); }
      else if(m.elite){ ctx.fillStyle='#ffd24a';ctx.font='bold 8.5px sans-serif';ctx.textAlign='center';
        ctx.fillText('★ '+m.eliteName+' Lv'+m.lvl, cx2, m.y*TILE-cam.y-9); }
      else { ctx.fillStyle='rgba(255,90,122,.9)';ctx.font='8px sans-serif';ctx.textAlign='center';
        ctx.fillText('Lv'+m.lvl, cx2, m.y*TILE-cam.y+2); } }}); });
  draws.push({y:player.py, fn:()=>drawAvatar(ctx,player.px*TILE-cam.x+TILE/2,player.py*TILE-cam.y+TILE-2,1.05,wardenSpec(),player.face,player.moving?player.bob:0)});
  if(caelun&&caelun.active&&vis(caelun.x,caelun.y))draws.push({y:caelun.y, fn:()=>{ const cx=caelun.x*TILE-cam.x+TILE/2, cy=caelun.y*TILE-cam.y+TILE-2;
    for(let k=0;k<5;k++){ const a=now*0.001+k; drawGlow(ctx,cx+Math.cos(a)*8,cy-18+Math.sin(a*1.3)*10,'#7a3bd4',2.5,0.5); }
    drawAvatar(ctx,cx,cy,1.05,CAELUN_SPEC,caelun.face,Math.sin(now*0.004)*1.2);
    ctx.fillStyle='rgba(179,136,255,.95)';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText('✦ Caelun', cx, caelun.y*TILE-cam.y-8); }});
  draws.sort((a,b)=>a.y-b.y).forEach(d=>d.fn());

  // destination marker
  if(player.moving&&player.path.length){const t=player.path[player.path.length-1];
    ctx.strokeStyle='rgba(70,232,200,.8)';ctx.lineWidth=2;
    const r=4+Math.sin(now*0.01)*2;
    ctx.beginPath();ctx.arc(t[0]*TILE-cam.x+TILE/2,t[1]*TILE-cam.y+TILE/2,r,0,7);ctx.stroke();}

  drawGatherArc();
  drawLighting();
  drawWeatherOverlay();
  drawParticles(ctx, cam.x, cam.y);
  ctx.restore();
  drawBiomeGrade();
  drawVignette();
  drawMinimap();
  drawFade();
}
// ---- MINIMAP ----
let miniBase=null;
function buildMiniBase(){
  miniBase=document.createElement('canvas'); miniBase.width=MW; miniBase.height=MH;
  const mc=miniBase.getContext('2d');
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const t=grid[y][x]; let c;
    if(t===T_WATER)c='#2767b0'; else if(t===T_DEEP)c='#16407a'; else if(t===T_SAND)c='#c9b079';
    else if(t===T_PATH)c='#7a7e8c'; else if(t===T_ICE)c='#add2ea'; else if(t===T_LAVA)c='#d6552a';
    else if(t===T_SNOW)c='#c6d4e4'; else if(t===T_ASH)c='#39302d'; else if(t===T_CRYST)c='#3a3068';
    else c=BIOMES[biomeMap[y][x]].col;
    mc.fillStyle=c; mc.fillRect(x,y,1,1);
  }
}
function drawMinimap(){
  if(!miniBase)buildMiniBase();
  const MM=104, MH2=Math.round(MM*MH/MW), pad=6;
  const ox=VW-MM-pad-2, oy=(window.SAFE_TOP||52)+6;
  ctx.save();
  // frame
  ctx.fillStyle='rgba(8,14,28,.72)';roundRect(ox-3,oy-3,MM+6,MH2+6,7);ctx.fill();
  ctx.strokeStyle='rgba(120,150,200,.5)';ctx.lineWidth=1.4;ctx.stroke();
  ctx.save();roundRect(ox,oy,MM,MH2,4);ctx.clip();
  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=.92;ctx.drawImage(miniBase,ox,oy,MM,MH2);ctx.globalAlpha=1;
  const sx=MM/MW, sy=MH2/MH;
  // bosses (defeated bosses hidden)
  monsters.forEach(m=>{ if(m.boss&&m.alive){ ctx.fillStyle='#ffd24a';
    ctx.beginPath();ctx.arc(ox+m.x*sx,oy+m.y*sy,2.2,0,7);ctx.fill(); } });
  // buildings (town marker)
  ctx.fillStyle='rgba(255,255,255,.6)';buildings.forEach(b=>{ctx.fillRect(ox+b.x*sx,oy+b.y*sy,2,2);});
  // viewport rect
  ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1;
  ctx.strokeRect(ox+(cam.x/TILE)*sx,oy+(cam.y/TILE)*sy,(VW/TILE)*sx,(VH/TILE)*sy);
  // player
  const pulse=2.5+Math.sin(now*0.006);
  ctx.fillStyle='#46e8c8';ctx.strokeStyle='#06203a';ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(ox+player.px*sx,oy+player.py*sy,pulse,0,7);ctx.fill();ctx.stroke();
  ctx.restore();
  ctx.restore();
}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function loop(){
  now=performance.now(); let dt=(now-last)/1000; last=now; dt=Math.min(dt,0.05);
  updateFade(dt);
  if(interior){ if(!fadeBusy()||fade.dir===-1)stepInterior(dt); }
  else if(!player.busy){ stepPlayer(dt); updateEntities(dt); }
  updateParticles(dt);
  if(!player.busy)updateExposure(dt);
  if(storyQueue.length)processStoryQueue();
  if(dlg&&dlg.typing)dlgTick(dt);
  if(shakeMag>0)shakeMag=Math.max(0,shakeMag-dt*42);
  updateWeather(dt);
  const _r0=performance.now(); render(); const _rt=performance.now()-_r0;
  perf.rt=_rt; perf.rtAvg=perf.rtAvg?perf.rtAvg*0.92+_rt*0.08:_rt;
  perf._frames++; if(now-perf._t0>=1000){ perf.fps=Math.round(perf._frames*1000/(now-perf._t0)); perf._frames=0; perf._t0=now; }
  hudTick++;
  if(hudTick%18===0) updateHUD();
  requestAnimationFrame(loop);
}
let hudTick=0;

/* ===================================================================
   INPUT — tap to move / interact
   =================================================================== */
cv.addEventListener('pointerdown',e=>{
  maybeStartAudio();
  const rect=cv.getBoundingClientRect();
  const sx=e.clientX-rect.left, sy=e.clientY-rect.top;
  if(interior){ interiorTap(sx,sy); return; }
  if(player.busy)return;
  const wx=Math.floor((sx+cam.x)/TILE), wy=Math.floor((sy+cam.y)/TILE);
  if(wx<0||wy<0||wx>=MW||wy>=MH)return;
  if(caelun&&caelun.active&&wx===caelun.x&&wy===caelun.y){ moveTo(wx,wy,{kind:'caelun'}); return; }
  const m=monAt(wx,wy);
  if(m){ moveTo(wx,wy,{kind:'monster',obj:m}); return; }
  const n=nodeAt(wx,wy);
  if(n){ moveTo(wx,wy,{kind:'node',obj:n}); return; }
  const np=npcAt(wx,wy);
  if(np){ moveTo(wx,wy,{kind:'npc',obj:np}); return; }
  const b=buildingAt(wx,wy);
  if(b){ moveTo(wx,wy,{kind:'building',obj:b}); return; }
  if(walk[wy][wx]){ moveTo(wx,wy,null); }
  else{ const adj=nearestWalkAdj(wx,wy); if(adj)moveTo(adj[0],adj[1],null); }
});
// dialogue / vision overlays advance on tap (ignore taps on choice buttons)
$('#dlg').addEventListener('pointerdown',e=>{ if(e.target.closest('#dlg-choices'))return; dlgAdvance(); });
$('#vision').addEventListener('pointerdown',()=>visionAdvance());

function tryInteract(){
  const it=pendingInteract; pendingInteract=null;
  if(!it)return;
  const px=Math.round(player.px),py=Math.round(player.py);
  if(it.kind==='monster'){ if(it.obj.alive&&dist(px,py,it.obj.x,it.obj.y)<=1.5)startEncounter(it.obj); return; }
  if(it.kind==='node'){ const n=it.obj; if(n.depleted)return;
    if(dist(px,py,n.x,n.y)<=1.5){ face(n.x,n.y);
      if(n.type==='fish'||n.type==='ice')startFishing(n);
      else if(n.type==='tablet')readTablet(n);
      else if(n.type==='bonfire')restAtBonfire(n);
      else gatherNode(n); } return; }
  if(it.kind==='npc'){ if(dist(px,py,Math.round(it.obj.bx),Math.round(it.obj.by))<=1.8){face(it.obj.bx,it.obj.by);talkNPC(it.obj);} return; }
  if(it.kind==='caelun'){ if(caelun&&dist(px,py,caelun.x,caelun.y)<=1.8)caelunTalk(); return; }
  if(it.kind==='building'){ openBuilding(it.obj); return; }
}
function face(tx,ty){const dx=tx-player.px,dy=ty-player.py;
  if(Math.abs(dx)>Math.abs(dy))player.face=dx>0?'right':'left';else player.face=dy>0?'down':'up';}

/* ===================================================================
   GATHERING
   =================================================================== */
function gainXp(skill,amt){
  S.activeSkill=skill;
  const s=S.skills[skill]||(S.skills[skill]={xp:0});
  const before=levelOf(s.xp); s.xp+=amt; const after=levelOf(s.xp);
  if(after>before){ toast(`${SKILLS.find(k=>k.id===skill).n} reached Level ${after}! 🎉`);
    burstRing(player.px*TILE+TILE/2, player.py*TILE+TILE-14, '#ffd479', 18, 110); sfx('levelup');
    const ms=(MILESTONES[skill]||[]).find(m=>m.lvl>before&&m.lvl<=after);
    if(ms)setTimeout(()=>toast('🏆 '+(SKILLS.find(k=>k.id===skill).n)+' mastery: '+ms.n+' unlocked!'),700); }
  updateObjective('skill_level', skill, after);
}
function skillBonus(skill){let b=0;for(const slot of['weapon','armor','relic']){const g=S.equip[slot]&&GEAR[S.equip[slot]];if(g&&g.sk&&g.sk[skill])b+=g.sk[skill];}return b;}
function gatherCol(skid,crystal){ return crystal?'#c89bff':skid==='mining'?'#ffd479':skid==='woodcutting'?'#9bd66a':'#b388ff'; }
// floating "+N" text anchored to a world node (screen-space, short-lived)
function floatNode(n,txt,col){
  const sx=n.x*TILE-cam.x+TILE/2, sy=n.y*TILE-cam.y+TILE/2-14;
  const el=document.createElement('div');
  el.textContent=txt;
  el.style.cssText=`position:absolute;z-index:5;left:${sx}px;top:${sy}px;transform:translateX(-50%);color:${col};font-weight:800;font-size:13px;pointer-events:none;text-shadow:0 1px 4px rgba(0,0,0,.85);transition:transform .9s ease,opacity .9s ease;`;
  $('#phone').appendChild(el);
  requestAnimationFrame(()=>{el.style.transform='translateX(-50%) translateY(-36px)';el.style.opacity='0';});
  setTimeout(()=>el.remove(),920);
}
let gathering=null; // {node,start,dur,col,ic}
function gatherNode(n){
  player.busy=true;
  const crystal=n.type==='crystal';
  const sk=crystal?SKILLS.find(s=>s.id==='mining'):SKILLS.find(s=>s.node===n.type);
  const lvl=skillLvl(sk.id);
  const col=gatherCol(sk.id,crystal);
  const dur=900+Math.random()*400;
  gathering={node:n, start:now, dur, col, ic:sk.ic}; // progress arc replaces the text prompt
  setTimeout(()=>{
    let yld=sk.base+Math.floor(lvl/8)+skillBonus(sk.id);
    if(lvl>=10)yld+=1;                       // milestone: +1 yield at skill Lv 10
    yld=Math.round(yld*(1+setBonus().gather)); // Astralite/Crystalweave gather bonus
    S.res[sk.res]+=yld;
    if(n.type==='plant'&&Math.random()<0.5)S.res.bio+=1;
    if(n.type==='rock'&&Math.random()<0.12)S.res.dust+=1;
    if(crystal){ const sh=1+Math.floor(lvl/12); S.res.shard+=sh; if(Math.random()<0.3)S.res.dust+=1; }
    gainXp(sk.id,9+lvl*2+(crystal?6:0));
    S.quests.gather=(S.quests.gather||0)+1;
    updateObjective('gather', sk.res, yld);
    gathering=null;
    // deplete with a poof, respawn with a sparkle
    n.depleted=1; burstMotes(n.x*TILE+TILE/2, n.y*TILE+TILE-8, '#aeb6c8', 6);
    setTimeout(()=>{ n.depleted=0; burstMotes(n.x*TILE+TILE/2, n.y*TILE+TILE-8, col, 7); }, 8000+Math.random()*6000);
    player.busy=false; save(); updateHUD();
    floatNode(n, `+${yld} ${crystal?'+✦':sk.resn}`, col);
    burstWorld(n.x,n.y, col); sfx('pickup');
  },dur);
}
function drawGatherArc(){
  if(!gathering)return;
  const n=gathering.node, cx=n.x*TILE-cam.x+TILE/2, cy=n.y*TILE-cam.y+TILE/2-18;
  const k=Math.min(1,(now-gathering.start)/gathering.dur);
  ctx.save(); ctx.lineWidth=3.2; ctx.lineCap='round';
  ctx.fillStyle='rgba(8,12,22,.7)'; ctx.beginPath(); ctx.arc(cx,cy,13,0,7); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.15)'; ctx.beginPath(); ctx.arc(cx,cy,13,0,7); ctx.stroke();
  ctx.strokeStyle=gathering.col; ctx.beginPath(); ctx.arc(cx,cy,13,-Math.PI/2,-Math.PI/2+k*Math.PI*2); ctx.stroke();
  ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#fff';
  ctx.fillText(gathering.ic||'⛏️', cx, cy+0.5);
  ctx.restore();
}

/* ===================================================================
   FISHING MINIGAME
   =================================================================== */
let fish=null;
function startFishing(n){
  player.busy=true;
  modal(`<div id="fishwrap"><h2>🎣 Aether Fishing</h2>
    <div class="muted" id="fishhint">Wait for a bite…</div>
    <canvas id="fishcv" width="300" height="300"></canvas>
    <div class="muted"><b style="color:var(--teal)">Hold &amp; slide</b> up/down to steer the basket — keep the <b style="color:#9be8ff">glowing fish</b> inside it. Let go and it sinks!</div>
    <button class="btn ghost" style="margin-top:8px" onclick="cancelFishing()">Leave</button></div>`,true);
  const fcv=$('#fishcv'), fx=fcv.getContext('2d');
  const wlvl=skillLvl('fishing');
  const wet=['rain','storm'].includes(curWeather());
  fish={node:n,fcv,fx,state:'bite',
    biteTimer:0.6+Math.random()*1.6,
    basketY:150, targetY:150, holding:false,
    fishY:150, fishV:0, fishTarget:150,
    progress:0, basketH:54+Math.min(30,wlvl), wet, lvl:wlvl, raf:0, t:performance.now()};
  fcv.addEventListener('pointerdown',fishDown);
  fcv.addEventListener('pointermove',fishMove);
  window.addEventListener('pointerup',fishUp);
  fishLoop();
}
function fishPointerY(e){const r=fish.fcv.getBoundingClientRect();return clamp((e.clientY-r.top)*(300/r.height),30,250);}
function fishDown(e){if(!fish)return;fish.holding=true;fish.targetY=fishPointerY(e);e.preventDefault();}
function fishMove(e){if(!fish||!fish.holding)return;fish.targetY=fishPointerY(e);e.preventDefault();}
function fishUp(){if(fish)fish.holding=false;}
function cancelFishing(){ if(fish){endFishing(false);} }
function fishLoop(){
  if(!fish)return;
  const t=performance.now(), dt=Math.min(0.05,(t-fish.t)/1000); fish.t=t;
  const f=fish, g=f.fx, W=300,H=300;
  if(f.state==='bite'){
    f.biteTimer-=dt;
    if(f.biteTimer<=0){ f.state='reel'; $('#fishhint').innerHTML='<b style="color:var(--gold)">A bite! Reel it in!</b>'; }
  } else if(f.state==='reel'){
    // fish wanders
    f.fishV+=(Math.random()-0.5)*60*dt;
    if(Math.random()<0.02)f.fishTarget=40+Math.random()*200;
    f.fishV+=( (f.fishTarget-f.fishY)*0.5 )*dt; f.fishV*=0.92;
    f.fishY=clamp(f.fishY+f.fishV,30,250);
    // basket physics — hold & slide: ease toward finger; sinks when released
    if(f.holding){ f.basketY += (f.targetY-f.basketY)*Math.min(1,11*dt); }
    else { f.basketY += 95*dt; }
    f.basketY=clamp(f.basketY,30,250);
    const inBasket = f.fishY>f.basketY-f.basketH/2 && f.fishY<f.basketY+f.basketH/2;
    f.progress += (inBasket? 0.34 : -0.22)*dt*(f.wet?1.25:1);
    f.progress=clamp(f.progress,0,1);
    if(f.progress>=1){ endFishing(true); return; }
    if(f.progress<=0 && t-f._failStart>0){ /* allow */ }
  }
  // draw
  g.clearRect(0,0,W,H);
  // water bg gradient
  const wg=g.createLinearGradient(0,0,0,H);wg.addColorStop(0,'#0a3a5e');wg.addColorStop(1,'#052238');
  g.fillStyle=wg;g.fillRect(0,0,W,H);
  for(let i=0;i<5;i++){g.strokeStyle='rgba(255,255,255,.05)';g.beginPath();
    g.moveTo(0,40+i*55+Math.sin(t*0.002+i)*6);g.lineTo(W,40+i*55+Math.cos(t*0.002+i)*6);g.stroke();}
  // track
  const tx=W-54;
  g.fillStyle='rgba(0,0,0,.3)';g.fillRect(tx,20,40,260);
  if(f.state==='reel'){
    // basket
    g.fillStyle='rgba(70,232,200,.28)';g.fillRect(tx,f.basketY-f.basketH/2,40,f.basketH);
    g.strokeStyle='var(--teal)';g.strokeStyle='#46e8c8';g.lineWidth=3;g.strokeRect(tx,f.basketY-f.basketH/2,40,f.basketH);
    // fish marker
    g.save();g.translate(tx+20,f.fishY);
    drawGlow(g,0,0,'#9be8ff',8,0.8);
    g.fillStyle='#9be8ff';
    g.beginPath();g.ellipse(0,0,10,6,0,0,7);g.fill();
    g.beginPath();g.moveTo(8,0);g.lineTo(15,-5);g.lineTo(15,5);g.closePath();g.fill();g.restore();
    // progress bar (left)
    g.fillStyle='rgba(0,0,0,.3)';g.fillRect(20,20,18,260);
    g.fillStyle='#5ce6a4';g.fillRect(20,20+260*(1-f.progress),18,260*f.progress);
  } else {
    // bobber
    g.save();g.translate(tx+20,150+Math.sin(t*0.005)*6);
    g.fillStyle='#ff5a7a';g.beginPath();g.arc(0,0,8,0,7);g.fill();
    g.fillStyle='#fff';g.fillRect(-8,-1,16,2);g.restore();
    g.fillStyle='rgba(255,255,255,.5)';g.font='12px sans-serif';g.textAlign='center';
    g.fillText('…',tx+20,110);
  }
  fish.raf=requestAnimationFrame(fishLoop);
}
function endFishing(success){
  if(!fish)return;
  cancelAnimationFrame(fish.raf);
  if($('#fishcv')){$('#fishcv').removeEventListener('pointerdown',fishDown);$('#fishcv').removeEventListener('pointermove',fishMove);}
  window.removeEventListener('pointerup',fishUp);
  const n=fish.node, lvl=fish.lvl, wet=fish.wet;
  fish=null; closeModal(); player.busy=false;
  if(success){
    let yld=1+Math.floor(lvl/6)+skillBonus('fishing'); if(wet)yld=Math.ceil(yld*1.5);
    S.res.fish+=yld;
    let bonus='';
    if(Math.random()<0.25+lvl*0.01){S.res.shard+=1;bonus=' +1✦';}
    if(curWeather()==='aurora'){S.res.shard+=1;bonus+=' +1✦(aurora)';}
    gainXp('fishing',14+lvl*2);
    S.quests.gather=(S.quests.gather||0)+1;
    updateObjective('gather','fish',yld);
    n.depleted=1; setTimeout(()=>{n.depleted=0;},6000);
    save();updateHUD();
    toast(`Caught ${yld} Fish 🐟${bonus}`); burstWorld(n.x,n.y,'#9be8ff');
  } else { toast('The line went slack…'); }
}

/* world particle burst — canvas particles anchored in world space */
function burstWorld(tx,ty,col){
  burstSpray(tx*TILE+TILE/2, ty*TILE+TILE/2, col, 12);
}

/* ===================================================================
   UI HELPERS
   =================================================================== */
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1900);}
let promptTimer;
function showPrompt(msg,ms){const p=$('#prompt');p.textContent=msg;p.classList.add('show');clearTimeout(promptTimer);if(ms)promptTimer=setTimeout(()=>p.classList.remove('show'),ms);}
function hidePrompt(){$('#prompt').classList.remove('show');}
function modal(html,noClose){
  const mb=$('#mbox'), me=$('#modal');
  const refreshing=me.classList.contains('show');           // re-render of an already-open panel
  const prevScroll=refreshing?mb.scrollTop:0;
  mb.innerHTML=(noClose?'':'<span class="close" onclick="closeModal()">✕</span>')+html;
  me.classList.add('show');
  if(refreshing){ mb.scrollTop=prevScroll;                  // keep the player where they were
    mb.classList.remove('refresh'); void mb.offsetWidth; mb.classList.add('refresh'); }
  else mb.classList.remove('refresh');
}
// brief highlight pulse on a freshly-rendered element to confirm an action landed
function flashEl(sel,gold){ const el=typeof sel==='string'?$(sel):sel; if(!el)return;
  const c=gold?'flash-gold':'flash'; el.classList.remove(c); void el.offsetWidth; el.classList.add(c); }
function closeModal(){$('#modal').classList.remove('show');if(fish){cancelAnimationFrame(fish.raf);fish=null;player.busy=false;}}

/* ===================================================================
   WARDEN STATS
   =================================================================== */
function activeSets(){ const eq=[S.equip.weapon,S.equip.armor,S.equip.relic]; return GEAR_SETS.filter(s=>s.pieces.every(p=>eq.includes(p))); }
function setBonus(){ const b={atkPct:0,hpPct:0,teamAtk:0,gather:0}; activeSets().forEach(s=>{for(const k in s.b)b[k]=(b[k]||0)+s.b[k];}); return b; }
function wardenStats(){
  const wpn=S.equip.weapon&&GEAR[S.equip.weapon], arm=S.equip.armor&&GEAR[S.equip.armor], rel=S.equip.relic&&GEAR[S.equip.relic];
  const cl=combatLevel();
  let atk=16+cl*2.8, hp=130+cl*10, teamAtk=0;
  [wpn,arm,rel].forEach(g=>{if(g){atk+=g.atk||0;hp+=g.hp||0;teamAtk+=g.teamAtk||0;}});
  // combat milestone: Warden's Nerve (+5% dmg at combat 10)
  if(cl>=10)atk*=1.05;
  const sb=setBonus(); atk*=(1+sb.atkPct); hp*=(1+sb.hpPct); teamAtk+=sb.teamAtk;
  return {atk:Math.round(atk),hp:Math.round(hp),teamAtk,cl,sets:activeSets()};
}
/* ---- BIOME EXPOSURE (tundra cold / ember heat) ---- */
let exposure=100, expState='';
function hasWard(type){ const r=S.equip.relic&&GEAR[S.equip.relic]; return !!(r&&r.ward===type); }
function nearBonfire(){ const px=Math.round(player.px),py=Math.round(player.py);
  return nodes.some(n=>n.type==='bonfire'&&Math.abs(n.x-px)<=2&&Math.abs(n.y-py)<=2); }
function lavaAdj(px,py){ for(const[dx,dy]of[[0,0],[1,0],[-1,0],[0,1],[0,-1]]){ const x=px+dx,y=py+dy; if(inb(x,y)&&grid[y][x]===T_LAVA)return true; } return false; }
function updateExposure(dt){
  if(interior||inBattle||dlg||vision){ return; }
  const px=Math.round(player.px),py=Math.round(player.py);
  const b=(biomeMap[py]&&biomeMap[py][px])||'';
  let hazard=''; if(b==='tundra'&&!hasWard('cold'))hazard='cold'; else if(b==='ember'&&!hasWard('heat'))hazard='heat';
  if(nearBonfire()){ exposure=Math.min(100,exposure+40*dt); expState=(exposure>=100)?'':hazard; }
  else if(hazard){ const rate=(hazard==='heat'&&lavaAdj(px,py))?9:4.2; exposure=Math.max(0,exposure-rate*dt); expState=hazard;
    if(exposure<=0){ exposure=100; expState=''; const s=safeSpawn(39,43); S.px=s[0];S.py=s[1];player.px=player.tx=s[0];player.py=player.ty=s[1];player.path=[];player.moving=false; save();
      toast(hazard==='cold'?'The cold drives you back to Skyhaven. ❄':'The heat drives you back to Skyhaven. 🔥'); } }
  else { if(exposure<100)exposure=Math.min(100,exposure+16*dt); expState=''; }
  updateExpBar();
}
let _expShown=null;
function updateExpBar(){ const el=$('#expbar'); if(!el)return;
  if(!expState){ if(_expShown!==''){el.classList.remove('show');_expShown='';} return; }
  el.className='show '+expState; _expShown=expState;
  el.innerHTML=`<span class="exp-ic">${expState==='cold'?'❄':'🔥'}</span><div class="exp-track"><div class="exp-fill" style="width:${Math.max(0,exposure)}%"></div></div>`;
}
let hudLastLvl=null;
function setRes(sel,val){const el=$(sel);if(!el)return; val=Math.floor(val);
  const prev=el._v==null?val:el._v;
  if(prev===val){ el.textContent=fmt(val); el._v=val; return; }
  el._v=val;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  const from=prev, start=performance.now(), dur=420;
  cancelAnimationFrame(el._raf||0);
  const step=t=>{ const k=Math.min(1,(t-start)/dur); const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    el.textContent=fmt(from+(val-from)*e); if(k<1)el._raf=requestAnimationFrame(step); else el.textContent=fmt(val); };
  el._raf=requestAnimationFrame(step);
}
function updateHUD(){
  setRes('#r-astral',S.res.astral);
  setRes('#r-shard',S.res.shard);
  setRes('#r-ore',S.res.ore);
  setRes('#r-wood',S.res.wood);
  $('#env-time').textContent=timeLabel();
  $('#env-weather').textContent={clear:'☀ Clear',cloud:'☁ Cloudy',rain:'🌧 Rain',fog:'🌫 Fog',aurora:'🌌 Aurora',storm:'⛈ Storm'}[curWeather()];
  $('#env-day').textContent='Day '+S.day;
  const w=wardenStats();
  const lvlEl=$('#w-lvl');
  if(hudLastLvl!=null&&w.cl>hudLastLvl){ lvlEl.classList.remove('pulse'); void lvlEl.offsetWidth; lvlEl.classList.add('pulse'); }
  hudLastLvl=w.cl;
  lvlEl.textContent='Lv '+w.cl;
  $('#w-atk').textContent=w.atk; $('#w-hp').textContent=w.hp;
  // active-skill XP bar
  const sk=S.activeSkill||'mining', def=SKILLS.find(s=>s.id===sk)||SKILLS[0];
  const xp=sk==='combat'?S.combatXp:skillXp(sk), lvl=levelOf(xp);
  const a=lvlReq(lvl), b=lvlReq(lvl+1), prog=lvl>=99?1:Math.max(0,Math.min(1,(xp-a)/(b-a)));
  $('#xp-ic').textContent=def.ic; $('#xpfill').style.width=(prog*100)+'%'; $('#xp-lvl').textContent=lvl;
}

/* ---- custom dock icons (crisp, on-theme; replaces emoji) ---- */
function rrPath(g,x,y,w,h,r){ g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath(); }
function star4(g,cx,cy,outer,inner){ g.beginPath(); for(let k=0;k<8;k++){const a=Math.PI/4*k-Math.PI/2,r=k%2?inner:outer;g.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);} g.closePath();g.fill(); }
function drawDockIcon(g,kind){ const main='#b3bed4', acc='#46e8c8'; g.lineCap='round';g.lineJoin='round';
  if(kind==='bag'){ g.fillStyle=main; rrPath(g,-7,-2,14,11,3.5); g.fill();
    g.strokeStyle=main;g.lineWidth=1.8;g.beginPath();g.arc(0,-2,5,Math.PI,0);g.stroke();
    g.strokeStyle=acc;g.lineWidth=1.5;g.beginPath();g.moveTo(-7,2.2);g.lineTo(7,2.2);g.stroke(); }
  else if(kind==='craft'){ g.fillStyle=main;g.beginPath();g.moveTo(-8,-4);g.lineTo(8,-4);g.lineTo(8,-1);g.lineTo(3,-1);g.lineTo(4,2);g.lineTo(-3,2);g.lineTo(-2,-1);g.lineTo(-8,-1);g.closePath();g.fill();
    g.fillRect(-2,2,4,5); g.fillStyle=acc;g.fillRect(-6,7,12,2); }
  else if(kind==='skills'){ g.fillStyle=main;g.fillRect(-7.5,2,3.4,6);g.fillRect(-2,-2,3.4,10); g.fillStyle=acc;g.fillRect(3.5,-7,3.4,15); }
  else if(kind==='champs'){ g.strokeStyle=main;g.lineWidth=2.2;g.beginPath();g.moveTo(-7,7);g.lineTo(6,-6);g.moveTo(7,7);g.lineTo(-6,-6);g.stroke();
    g.strokeStyle=acc;g.lineWidth=2.2;g.beginPath();g.moveTo(-8.5,4.5);g.lineTo(-4.5,8.5);g.moveTo(8.5,4.5);g.lineTo(4.5,8.5);g.stroke(); }
  else if(kind==='summon'){ g.fillStyle=acc;star4(g,0,0,9,3.2); g.fillStyle=main;star4(g,0,0,4.6,1.5); }
  else if(kind==='menu'){ g.strokeStyle=main;g.lineWidth=2.2;g.beginPath();g.moveTo(-7,-5);g.lineTo(7,-5);g.moveTo(-7,0);g.lineTo(7,0);g.stroke();
    g.strokeStyle=acc;g.lineWidth=2.2;g.beginPath();g.moveTo(-7,5);g.lineTo(7,5);g.stroke(); } }
function paintDock(){ $$('#dock canvas[data-icon]').forEach(c=>{ const g=c.getContext('2d');g.clearRect(0,0,48,48);
  g.save();g.translate(24,24);g.scale(2,2);drawDockIcon(g,c.dataset.icon);g.restore(); }); }

/* ===================================================================
   DOCK PANELS
   =================================================================== */
$$('.dbtn').forEach(b=>b.onclick=()=>openPanel(b.dataset.p));
function openPanel(p){
  sfx('ui');
  if(p==='bag')panelBag();
  else if(p==='craft')panelCraft(null);
  else if(p==='skills')panelSkills();
  else if(p==='champs')panelChamps();
  else if(p==='summon')panelSummon();
  else if(p==='menu')panelMenu();
}

/* ---- BAG / GEAR ---- */
function panelBag(){
  const mats=['ore','wood','herb','fish','dust','bio','astral','shard'];
  const w=wardenStats();
  let slots='';
  ['weapon','armor','relic'].forEach(slot=>{
    const g=S.equip[slot]&&GEAR[S.equip[slot]];
    const glow=g?`border-color:${g.col};box-shadow:0 0 12px ${g.col}3a,inset 0 0 0 1px ${g.col}4a;`:'';
    slots+=`<div class="gearslot" style="${glow}"><canvas data-gear="${slot}" width="40" height="40"></canvas>
      <div style="flex:1"><div style="font-size:12px;font-weight:700">${g?g.name:'<span style="color:var(--dim)">— '+slot+' empty —</span>'}</div>
      <div class="muted">${g?gearDesc(g):'Craft &amp; equip gear at the Forge'}</div></div>
      ${g?`<button class="btn ghost sm" onclick="unequip('${slot}')">Unequip</button>`:''}</div>`;
  });
  modal(`<h2>Warden's Pack</h2>
    <div class="card"><h3>Equipped <span class="chip">⚔${w.atk} ❤${w.hp}${w.teamAtk?' · +'+(w.teamAtk*100).toFixed(0)+'% team atk':''}</span></h3>${slots}
      ${(w.sets&&w.sets.length)?w.sets.map(s=>`<div style="font-size:11px;color:var(--gold);margin-top:4px">⟡ <b>${s.name}</b> — ${s.desc}</div>`).join(''):''}</div>
    <div class="card"><h3>Owned Gear</h3><div id="ownedgear">${ownedGearHTML()}</div></div>
    <div class="card"><h3>Materials</h3>${mats.map(m=>`<span class="pill">${RESINFO[m]} ${fmt(S.res[m])} ${m}</span>`).join('')}</div>`);
  // draw equipped slot avatars
  $$('#mbox canvas[data-gear]').forEach(c=>{const slot=c.dataset.gear,id=S.equip[slot];const cx=c.getContext('2d');cx.clearRect(0,0,40,40);
    if(id){drawGearIcon(cx,GEAR[id]);}else{cx.fillStyle='#1a2538';cx.fillRect(0,0,40,40);}});
  drawInvCanvases();
}
function gearDesc(g){let p=[];if(g.atk)p.push('⚔+'+g.atk);if(g.hp)p.push('❤+'+g.hp);if(g.teamAtk)p.push('team +'+(g.teamAtk*100)+'%');for(const k in(g.sk||{}))p.push(SKILLS.find(s=>s.id===k).n+' +'+g.sk[k]);return p.join(' · ');}
function diffSpan(ic,v,suf){ if(!v)return ''; const up=v>0,c=up?'var(--good)':'var(--bad)';
  return `<span style="color:${c};font-weight:700">${ic} ${up?'▲':'▼'}${Math.abs(suf?+v.toFixed(0):v)}${suf||''}</span>`; }
function gearDiff(g){ const cur=S.equip[g.slot]&&GEAR[S.equip[g.slot]]; if(!cur||cur.id===g.id)return '';
  const parts=[diffSpan('⚔',(g.atk||0)-(cur.atk||0)),diffSpan('❤',(g.hp||0)-(cur.hp||0)),diffSpan('team',((g.teamAtk||0)-(cur.teamAtk||0))*100,'%')].filter(Boolean);
  return parts.length?`<div style="font-size:10px;margin-top:2px"><span class="muted">vs equipped:</span> ${parts.join(' ')}</div>`:'<div style="font-size:10px;margin-top:2px" class="muted">same as equipped</div>'; }
function ownedGearHTML(){
  if(!S.gear.length)return '<div class="muted">No gear yet. Visit the Star-Forge ⚒️</div>';
  const counts={};S.gear.forEach(id=>counts[id]=(counts[id]||0)+1);
  return Object.keys(counts).map(id=>{const g=GEAR[id];const eq=S.equip[g.slot]===id;
    const glow=eq?`border-color:${g.col};box-shadow:0 0 14px ${g.col}44,inset 0 0 0 1px ${g.col}55;`:'';
    return `<div class="gearslot" style="${glow}"><canvas class="ginv" data-g="${id}" width="40" height="40"></canvas>
      <div style="flex:1"><div style="font-size:12px;font-weight:700;${eq?'color:'+g.col:''}">${g.name} ${counts[id]>1?'×'+counts[id]:''}</div><div class="muted">${gearDesc(g)}</div>${eq?'':gearDiff(g)}</div>
      <button class="btn ${eq?'ghost':''} sm" onclick="${eq?'':`equip('${id}')`}" ${eq?'disabled':''}>${eq?'✓ Equipped':'Equip'}</button></div>`;
  }).join('');
}
function drawGearIcon(cx,g){
  cx.fillStyle='#101a2c';cx.fillRect(0,0,40,40);
  cx.save();cx.translate(20,20);
  if(g.slot==='weapon'){cx.strokeStyle=g.col;cx.lineWidth=3;cx.beginPath();cx.moveTo(-9,11);cx.lineTo(7,-11);cx.stroke();
    cx.fillStyle=g.col;cx.beginPath();cx.moveTo(7,-11);cx.lineTo(13,-9);cx.lineTo(9,-15);cx.closePath();cx.fill();
    cx.strokeStyle='#3a2a1a';cx.beginPath();cx.moveTo(-9,11);cx.lineTo(-13,15);cx.stroke();}
  else if(g.slot==='armor'){cx.fillStyle=g.col;cx.beginPath();cx.moveTo(0,-12);cx.lineTo(12,-7);cx.lineTo(10,10);cx.lineTo(0,15);cx.lineTo(-10,10);cx.lineTo(-12,-7);cx.closePath();cx.fill();
    cx.fillStyle=shade(g.col,30);cx.beginPath();cx.moveTo(0,-12);cx.lineTo(0,15);cx.lineTo(-10,10);cx.lineTo(-12,-7);cx.closePath();cx.fill();}
  else {drawGlow(cx,0,0,g.col,9,0.8);cx.fillStyle=g.col;cx.beginPath();
    for(let i=0;i<6;i++){const a=i/6*7;cx.lineTo(Math.cos(a)*11,Math.sin(a)*11);}cx.closePath();cx.fill();}
  cx.restore();
}
function equip(id){const g=GEAR[id];S.equip[g.slot]=id;save();updateHUD();panelBag();toast('Equipped '+g.name);flashEl('canvas[data-gear="'+g.slot+'"]');}
function unequip(slot){const g=S.equip[slot]&&GEAR[S.equip[slot]];S.equip[slot]=null;save();updateHUD();panelBag();toast((g?g.name:'Item')+' unequipped');flashEl('canvas[data-gear="'+slot+'"]');}
function drawInvCanvases(){$$('#mbox canvas.ginv').forEach(c=>drawGearIcon(c.getContext('2d'),GEAR[c.dataset.g]));}

/* ---- CRAFT ---- */
function nearStation(kind){ // forge or shrine within 3 tiles
  const px=Math.round(player.px),py=Math.round(player.py);
  return buildings.some(b=>b.kind===kind && px>=b.x-1&&px<=b.x+b.w&&py>=b.y-1&&py<=b.y+b.h+1);
}
function panelCraft(forceStation){
  const atForge=nearStation('forge'), atShrine=nearStation('shrine');
  const list=RECIPES.map(r=>{
    const g=GEAR[r.out], lvl=skillLvl('smithing'), ok=lvl>=r.lvl;
    const stationOk = r.station==='forge'?atForge:atShrine;
    const afford=Object.entries(r.cost).every(([k,v])=>S.res[k]>=v);
    const costHtml=Object.entries(r.cost).map(([k,v])=>`<span style="color:${S.res[k]>=v?'var(--good)':'var(--bad)'}">${RESINFO[k]||k}${v}</span>`).join(' ');
    const can=ok&&stationOk&&afford;
    let why=!ok?`Needs Smithing Lv ${r.lvl}`:!stationOk?`Go to the ${r.station==='forge'?'Star-Forge ⚒️':'Shrine ✦'}`:!afford?'Not enough materials':'Ready';
    return `<div class="recipe" data-r="${r.id}"><div class="rt"><span>${g.name}</span><span class="chip" style="color:${RAR_T(g.tier)}">T${g.tier}</span></div>
      <div class="muted">${gearDesc(g)}</div>
      <div class="cost">Cost: ${costHtml} <span style="color:var(--dim)">· ${why}</span></div>
      <button class="btn ${can?'gold':'ghost'} sm" style="width:100%" ${can?'':'disabled'} onclick="craft('${r.id}')">⚒ Forge (+25 smithing xp)</button></div>`;
  }).join('');
  modal(`<h2>Crafting</h2>
    <div class="muted" style="margin-bottom:10px">Smithing Lv ${skillLvl('smithing')} · ${atForge?'<span style="color:var(--good)">At the Star-Forge</span>':atShrine?'<span style="color:var(--good)">At the Shrine</span>':'<span style="color:var(--dim)">Stand by the Forge (weapons/armor) or Shrine (relics)</span>'}</div>
    ${list}`);
}
function RAR_T(t){return['','#b9803e','#3fb0a6','#8a6cff','#ffce54'][t];}
function craft(id){
  const r=RECIPES.find(x=>x.id===id);if(!r)return;
  if(skillLvl('smithing')<r.lvl)return toast('Smithing level too low');
  if(!(r.station==='forge'?nearStation('forge'):nearStation('shrine')))return toast('Wrong station');
  if(!Object.entries(r.cost).every(([k,v])=>S.res[k]>=v))return toast('Not enough materials');
  for(const[k,v]of Object.entries(r.cost))S.res[k]-=v;
  S.gear.push(r.out); gainXp('smithing',25);
  updateObjective('craft', r.out, 1);
  const g=GEAR[r.out]; if(!S.equip[g.slot])S.equip[g.slot]=r.out; // auto-equip if slot empty
  save();updateHUD();panelCraft();drawInvCanvases?.();
  flashEl('.recipe[data-r="'+id+'"]',true);
  burstRing(player.px*TILE+TILE/2,player.py*TILE+TILE-14,g.col,14,80); sfx('craft');
  toast('Forged '+g.name+'! 🔨');
}

/* ---- SKILLS ---- */
function panelSkills(){
  let tot=0;
  const rows=SKILLS.map(s=>{
    const xp=s.id==='combat'?S.combatXp:skillXp(s.id);
    const lvl=levelOf(xp);tot+=lvl;
    const cur=lvlReq(lvl),nxt=lvlReq(lvl+1),pct=lvl>=99?100:(xp-cur)/(nxt-cur)*100;
    const sub=s.id==='combat'?'Win battles':s.id==='smithing'?'Forge gear':`Yield +${s.base+Math.floor(lvl/8)+skillBonus(s.id)} ${s.resn}/action`;
    const ms=MILESTONES[s.id]||[]; const earned=ms.filter(m=>lvl>=m.lvl); const next=ms.find(m=>lvl<m.lvl);
    const mline=`<div style="font-size:10px;margin-top:3px"><span style="color:var(--gold)">🏆 ${earned.length?earned.map(m=>m.n).join(' · '):'—'}</span>${next?` <span class="muted">· next: ${next.n} (Lv ${next.lvl})</span>`:''}</div>`;
    return `<div class="skill"><div class="si">${s.ic}</div><div class="body">
      <div class="top"><span>${s.n} <span class="chip">Lv ${lvl}</span></span><span>${Math.floor(xp-cur)}/${Math.floor(nxt-cur)} xp</span></div>
      <div class="xpbar"><div class="xpfill" style="width:${pct}%"></div></div>
      <div class="muted" style="font-size:11px;margin-top:2px">${sub}</div>${mline}</div></div>`;
  }).join('');
  modal(`<h2>Wardencraft</h2><div class="card">${rows}</div>
    <div class="card"><h3>Total Warden Level <span class="chip">${tot}</span></h3>
    <div class="muted">Roam the skylands to raise each craft. Gear and levels both boost your yields and your power.</div></div>`);
}

/* ---- CODEX / BESTIARY ---- */
function panelCodex(){
  const B=S.bestiary;
  // biomes discovered
  const bioOrder=['meadow','plains','forest','mountain','tundra','ember','crystal','lake'];
  const bioRows=bioOrder.map(k=>{const d=B.biomes[k],bi=BIOMES[k];
    return `<div class="skill"><div class="si" style="background:${bi.col}">${d?'✓':'?'}</div><div class="body">
      <div class="top"><span>${d?bi.name:'??? Undiscovered'}</span><span class="chip ${ELEM[bi.el]?ELEM[bi.el].c:''}">${d?ELEM[bi.el].n:'—'}</span></div>
      <div class="muted" style="font-size:11px">${d?'Explored':'Walk these lands to chart them'}</div></div></div>`;}).join('');
  // bosses
  const bossRows=BOSSES.map(bo=>{const e=B.bosses['boss_'+bo.name], seen=!!e, cleared=e&&e.cleared;
    return `<div class="skill"><div class="si" style="background:${ELEM[bo.el].col}">${cleared?'☠':seen?'!':'?'}</div><div class="body">
      <div class="top"><span>${seen?bo.name:'A Lurking Terror'}</span><span class="chip">${seen?'Lv '+bo.lvl:'??'}</span></div>
      <div class="muted" style="font-size:11px">${cleared?`<span style="color:var(--good)">Defeated ×${e.kills}</span> · drops ${GEAR[bo.drop].name}`:seen?`<span style="color:var(--bad)">Undefeated</span> · ${BIOMES[bo.biome].name}`:'Rumored to haunt the wilds'}</div></div></div>`;}).join('');
  // hollow kinds encountered
  const mobKeys=Object.keys(B.mobs);
  const mobRows=mobKeys.length?mobKeys.map(k=>{const m=B.mobs[k];
    return `<div class="skill"><div class="si" style="background:${ELEM[m.el]?ELEM[m.el].col:'#555'}">${m.kills}</div><div class="body">
      <div class="top"><span>${m.name}</span><span class="chip">max Lv ${m.maxLvl}</span></div>
      <div class="muted" style="font-size:11px">Defeated ×${m.kills} · ${BIOMES[m.biome]?BIOMES[m.biome].name:m.biome}</div></div></div>`;}).join(''):`<div class="muted">No Hollow recorded yet. Walk into one to begin your log.</div>`;
  // gear discovered
  const gearTotal=Object.keys(GEAR).length, gearFound=Object.keys(B.gear).length;
  modal(`<h2>📖 Hall of Echoes</h2>
    <div class="card"><h3>Biomes <span class="chip">${Object.keys(B.biomes).length}/${bioOrder.length}</span></h3>${bioRows}</div>
    <div class="card"><h3>Biome Bosses <span class="chip">${BOSSES.filter(b=>{const e=B.bosses['boss_'+b.name];return e&&e.cleared;}).length}/${BOSSES.length}</span></h3>${bossRows}</div>
    <div class="card"><h3>Hollow Bestiary</h3>${mobRows}</div>
    <div class="card"><h3>Relics & Arms Catalogued <span class="chip">${gearFound}/${gearTotal}</span></h3>
      <div class="muted">Discover gear by crafting or claiming it from the fallen.</div></div>`);
}

/* ---- CHAMPIONS ---- */
function heroMini(id){const c=document.createElement('canvas');c.width=80;c.height=80;
  const g=c.getContext('2d');g.clearRect(0,0,80,80);drawAvatar(g,40,68,1.7,champSpec(id),'down',0);return c.toDataURL();}
function champCard(id){
  if(!id)return `<div class="empty-slot">+ empty<br>slot</div>`;
  const d=champDef(id),R=RAR[d.rar],h=S.heroes[id],lv=h?h.lvl:1,e=ELEM[d.el];
  return `<div class="hero rar-${R.c}" onclick="champDetail('${id}')">
    <span class="pip ${R.c}">${'★'.repeat(R.stars)}</span>
    <span class="elem ${e.c}" style="position:absolute;top:4px;right:4px">${e.n[0]}</span>
    <canvas data-champ="${id}" width="70" height="70"></canvas>
    <div class="nm">${d.name.split(' ')[0]}</div><div class="lv">Lv ${lv}</div></div>`;
}
function champBg(g,w,h,el){ g.clearRect(0,0,w,h);
  g.fillStyle='#0e1729'; g.fillRect(0,0,w,h);
  const c=ELEM[el].col, grd=g.createRadialGradient(w/2,h*0.4,2,w/2,h*0.55,w*0.72);
  grd.addColorStop(0,c+'66'); grd.addColorStop(0.6,c+'1f'); grd.addColorStop(1,c+'00');
  g.fillStyle=grd; g.fillRect(0,0,w,h); }
function paintChampCanvases(){$$('#mbox canvas[data-champ]').forEach(c=>{const g=c.getContext('2d');const el=champDef(c.dataset.champ).el;champBg(g,c.width,c.height,el);drawAvatar(g,c.width/2,c.height-(c.width>60?10:6),c.width>60?1.55:1.3,champSpec(c.dataset.champ),'down',0);});}
function panelChamps(){
  const owned=Object.keys(S.heroes).sort((a,b)=>RAR[champDef(b).rar].stars-RAR[champDef(a).rar].stars);
  modal(`<h2>Champions <span class="chip">${owned.length}/${POOL.length}</span></h2>
    <div class="card"><h3>Active Squad <span class="muted" style="font-weight:400;font-size:11px">(fights beside your Warden)</span></h3>
    <div class="hgrid">${S.squad.map(id=>champCard(id)).join('')}</div></div>
    <div class="card"><h3>Roster</h3><div class="hgrid">${owned.length?owned.map(id=>champCard(id)).join(''):'<div class="muted" style="grid-column:1/-1">No champions yet — visit the Wishing Pool 🌌</div>'}</div></div>`);
  paintChampCanvases();
}
function champDetail(id){
  const d=champDef(id),R=RAR[d.rar],e=ELEM[d.el],h=S.heroes[id],lv=h.lvl;
  const grow=1+(lv-1)*0.12,m=R.mult,atk=Math.round(d.atk*grow*m),hp=Math.round(d.hp*grow*m);
  const inSquad=S.squad.includes(id),upCost=Math.floor(40*Math.pow(lv,1.5));
  const legend=d.rar==='legend';
  modal(`<div style="margin:-2px 0 8px"><button class="btn ghost sm" style="padding:4px 12px" onclick="panelChamps()">‹ Champions</button>
      ${inSquad?'<span class="pill" style="color:var(--good);margin-left:6px">⚔ In Squad</span>':''}</div>
    <canvas id="cd" width="120" height="120" style="display:block;margin:4px auto;background:#0e1729;border-radius:14px;${legend?'box-shadow:0 0 22px rgba(255,206,84,.4)':'box-shadow:0 0 16px '+e.col+'55'}"></canvas>
    <h3 class="center"${legend?' style="background:linear-gradient(90deg,var(--gold),#fff3c4 45%,var(--gold));-webkit-background-clip:text;background-clip:text;color:transparent"':''}>${d.name}</h3><div class="muted center" style="margin-bottom:8px">${d.role}</div>
    <div class="center" style="margin-bottom:8px"><span class="pill"><span class="elem ${e.c}">${e.n[0]}</span> ${e.n}</span>
      <span class="pill" style="color:var(--legend)">${'★'.repeat(R.stars)}</span><span class="pill">Lv ${lv} ×${h.count}</span></div>
    <div class="statline"><span>⚔ Attack</span><b>${atk}</b></div><div class="statline"><span>❤ Health</span><b>${hp}</b></div>
    <div class="row" style="margin-top:12px">
      <button class="btn gold sm" style="flex:1" ${S.res.astral<upCost?'disabled':''} onclick="levelHero('${id}')">Ascend · ${upCost}◈</button>
      <button class="btn ${inSquad?'ghost':''} sm" style="flex:1" onclick="toggleSquad('${id}')">${inSquad?'Remove':'Deploy'}</button></div>`);
  const g=$('#cd').getContext('2d');champBg(g,120,120,d.el);drawAvatar(g,60,104,2.7,champSpec(id),'down',0);
}
function levelHero(id){const h=S.heroes[id],cost=Math.floor(40*Math.pow(h.lvl,1.5));
  if(S.res.astral<cost)return toast('Need more Astral ◈');if(h.lvl>=80)return toast('Max ascension');
  S.res.astral-=cost;h.lvl++;save();updateHUD();champDetail(id);
  toast(champDef(id).name.split(' ')[0]+' ascended to Lv '+h.lvl+' ⭐');
  $$('#mbox .statline').forEach(el=>flashEl(el));
  burstRing(player.px*TILE+TILE/2,player.py*TILE+TILE-14,'#ffd479',14,90);}
function toggleSquad(id){const i=S.squad.indexOf(id);
  if(i>=0){S.squad[i]=null;save();champDetail(id);toast('Removed from squad');}
  else{const e=S.squad.indexOf(null);if(e<0)return toast('Squad full (3 max)');S.squad[e]=id;save();champDetail(id);toast('Deployed to squad ⚔');}
  flashEl('#mbox .row .btn:last-child'); return;}

/* ---- SUMMON ---- */
function rollRarity(){S.pity++;if(S.pity>=50){S.pity=0;return'legend';}const r=Math.random()*100;
  if(r<3){S.pity=0;return'legend';}if(r<15)return'epic';if(r<45)return'rare';return'com';}
function rollHero(){const rar=rollRarity();const c=POOL.filter(p=>p.rar===rar);return c[Math.random()*c.length|0];}
function gainHero(d){if(S.heroes[d.id]){S.heroes[d.id].count++;S.heroes[d.id].lvl=clamp(S.heroes[d.id].lvl+1,1,80);return true;}
  S.heroes[d.id]={lvl:1,count:1};const e=S.squad.indexOf(null);if(e>=0&&S.squad.filter(Boolean).length<3)S.squad[e]=d.id;return false;}
function panelSummon(){
  modal(`<h2>The Wishing Pool</h2>
    <div class="card center"><canvas id="poolcv" width="120" height="80" style="background:transparent"></canvas>
    <div class="muted">Cast Starshards into the pool to call champions from the shattered Tree.</div>
    <div style="margin:10px 0 6px"><span class="pill" style="color:var(--rare)">✦ ${fmt(S.res.shard)}</span><span class="pill">Pity ${S.pity}/50</span></div>
    <div class="row"><button class="btn" style="background:linear-gradient(180deg,var(--rare),#2f6df0);color:#fff" onclick="doSummon(1)">×1<br><small>10 ✦</small></button>
    <button class="btn violet" onclick="doSummon(10)">×10<br><small>90 ✦</small></button></div>
    <div class="muted" style="margin-top:8px;font-size:11px">Guaranteed ★5 within 50 summons.</div></div>
    <div class="card"><div class="statline"><span style="color:var(--legend)">★5 Legend</span><b>3%</b></div>
    <div class="statline"><span style="color:var(--epic)">★4 Epic</span><b>12%</b></div>
    <div class="statline"><span style="color:var(--rare)">★3 Rare</span><b>30%</b></div>
    <div class="statline" style="border:none"><span style="color:var(--com)">★2 Common</span><b>55%</b></div></div>`);
}
function doSummon(n){
  const cost=n===1?10:90;
  if(S.res.shard<cost){toast('Not enough Starshards ✦');return;}
  S.res.shard-=cost;const got=[];
  for(let i=0;i<n;i++){const d=rollHero();const dupe=gainHero(d);got.push({d,dupe});S.quests.summon=(S.quests.summon||0)+1;}
  updateObjective('summon','*',n); sfx('summon');
  save();updateHUD();
  modal(`<h2 class="center" style="color:var(--gold)">✦ The Pool Answers ✦</h2>
    <div class="reveal">${got.map((g,i)=>{const R=RAR[g.d.rar];return `<div class="hero rar-${R.c}" style="animation-delay:${i*.05}s">
      <span class="pip ${R.c}" style="font-size:7px">${'★'.repeat(R.stars)}</span>
      <canvas data-champ="${g.d.id}" width="56" height="56"></canvas>
      <div class="nm" style="font-size:9px">${g.d.name.split(' ')[0]}</div>
      <div class="lv" style="font-size:8px;color:${g.dupe?'var(--good)':'var(--gold)'}">${g.dupe?'LV↑':'NEW'}</div></div>`;}).join('')}</div>
    <button class="btn gold" onclick="panelSummon()">Summon Again</button>`);
  paintChampCanvases();
}

/* ---- MENU ---- */
function panelMenu(){
  modal(`<h2>Menu</h2>
    <div class="card"><h3>The Tale</h3><div class="muted">The World-Tree <b style="color:var(--good)">Yvalethi</b> shattered across the void. You are a <b style="color:var(--teal)">Starwarden</b> — roam Skyhaven's drifting isle, gather its gifts, forge your power, summon lost champions, and drive back the <b style="color:var(--violet)">Hollow</b>.</div></div>
    <div class="card"><h3>How to Play</h3><div class="muted" style="line-height:1.7">
      • <b>Tap the ground</b> to walk there.<br>
      • <b>Tap a rock/tree/plant/crystal</b> to gather (Mining/Woodcutting/Foraging).<br>
      • <b>Tap a shimmering pool</b> to fish — <b>hold & slide</b> the basket to land the catch.<br>
      • <b>Walk into a building</b> to step inside; talk to its keeper or use its station.<br>
      • <b>Walk into a monster</b> to fight — your <b>team of 3</b> battles automatically.<br>
      • Explore <b>8 biomes</b>; each hides a <b>biome boss</b> ☠ with a legendary drop.<br>
      • Open <b>Bag</b> to equip weapons, armor & relics — they change your stats & look.<br>
      • Check <b>Menu → Quests</b> for bounties and <b>Codex</b> for your bestiary.<br>
      • Weather & day/night shift over time and affect yields.</div></div>
    <div class="card"><div class="row">
      <button class="btn gold sm" style="flex:1" onclick="panelQuests()">📜 Quests</button>
      <button class="btn violet sm" style="flex:1" onclick="panelLore()">📖 Lore</button>
      <button class="btn ghost sm" style="flex:1" onclick="panelCodex()">⚔ Bestiary</button></div></div>
    <div class="card"><button class="btn ghost sm" id="audbtn" style="width:100%;margin-bottom:8px" onclick="toggleAudio()">${S.audio?'🔊 Ambient: ON':'🔇 Ambient: OFF'}</button>
      <div class="row">
      <button class="btn sm" style="flex:1" onclick="save();toast('Saved!')">💾 Save</button>
      <button class="btn ghost sm" style="flex:1" onclick="hardReset()">⟲ Reset World</button></div></div>`);
}
/* ===================================================================
   QUEST ENGINE  (state machine — data lives in src/quests.js)
   State: S.qs[id]={s:status, o:{objId:current}} · S.flags[id]
   =================================================================== */
const QBYID=Object.fromEntries(QUESTS.map(q=>[q.id,q]));
// ---- flags ----
function setFlag(id,v=true){ if(!S.flags)S.flags={}; S.flags[id]=v; }
function getFlag(id){ return S.flags&&S.flags[id]!=null?S.flags[id]:false; }
function hasFlag(id){ return !!(S.flags&&S.flags[id]); }
// ---- conditions / status ----
function bossClearedAny(name){ const b=S.bestiary&&S.bestiary.bosses||{};
  if(name&&name!=='*')return !!(b['boss_'+name]&&b['boss_'+name].cleared);
  return Object.values(b).some(e=>e.cleared); }
function condMet(c){ switch(c.type){
  case 'quest_complete': return qStatus(c.id)>=QS.COMPLETE;
  case 'combat_level': return combatLevel()>=c.min;
  case 'skill_level': return skillLvl(c.skill)>=c.min;
  case 'flag': return hasFlag(c.id);
  case 'biome_visited': return !!(S.bestiary.biomes&&S.bestiary.biomes[c.biome]);
  case 'boss_defeated': return bossClearedAny(c.name);
  default: return true; } }
function isUnlocked(q){ return (q.unlock||[]).every(condMet); }
function qStatus(id){ const st=S.qs&&S.qs[id]; if(st)return st.s; const q=QBYID[id];
  if(!q)return QS.LOCKED; return isUnlocked(q)?QS.AVAILABLE:QS.LOCKED; }
function startQuest(q){ S.qs[q.id]={s:QS.ACTIVE,o:{}}; q.objectives.forEach(o=>S.qs[q.id].o[o.id]=0); }
// ---- engine ----
function checkUnlocks(){ if(!S.qs)S.qs={}; let changed=false;
  for(const q of QUESTS){ if(!S.qs[q.id]&&isUnlocked(q)){ startQuest(q); changed=true; toast('📜 New quest: '+q.title); } }
  // Caelun manifests once the final Act-1 quest is active
  if(S.qs['a1_voice']&&S.qs['a1_voice'].s===QS.ACTIVE&&!caelun&&!hasFlag('act_finished'))spawnCaelun();
  if(S.qs['a4_final']&&S.qs['a4_final'].s===QS.ACTIVE&&!caelun&&!hasFlag('act_finished'))spawnFinalCaelun();
  if(changed){ save(); updateQuestTracker(); }
  return changed; }
function updateObjective(type,target,amount){ if(!S.qs)return; let any=false;
  for(const q of QUESTS){ const st=S.qs[q.id]; if(!st||st.s!==QS.ACTIVE)continue;
    for(const o of q.objectives){ if(o.type!==type)continue; if(o.target!=='*'&&o.target!==target)continue;
      const cur=st.o[o.id]||0; if(cur>=o.count)continue;
      st.o[o.id]= type==='skill_level' ? Math.min(o.count,Math.max(cur,amount)) : Math.min(o.count,cur+amount);
      any=true; }
    if(st.s===QS.ACTIVE && q.objectives.every(o=>(st.o[o.id]||0)>=o.count)){ st.s=QS.COMPLETE; any=true;
      toast('✅ Quest complete: '+q.title); sfx('quest');
      if(q.auto)setTimeout(()=>{ if(S.qs[q.id]&&S.qs[q.id].s===QS.COMPLETE){ if(q.doneDlg||q.vision)storyQueue.push(q); else grantQuestRewards(q); } },60); } }
  if(any){ save(); updateQuestTracker(); } }
// story queue — plays auto-quest memory dialogue once combat/modals clear (e.g. after a boss victory)
let storyQueue=[];
function processStoryQueue(){ if(!storyQueue.length||inBattle||dlg||vision||player.busy)return;
  if($('#modal').classList.contains('show'))return;
  const q=storyQueue.shift();
  runDialogue(q.doneDlg||[], ()=>{ if(q.vision)showVision(q.vision,()=>grantQuestRewards(q)); else grantQuestRewards(q); }); }
function grantQuestRewards(q){ const r=q.rewards||{}, st=S.qs[q.id]; if(!st)return;
  if(r.astral)S.res.astral+=r.astral; if(r.shard)S.res.shard+=r.shard;
  ['ore','wood','herb','fish','dust','bio'].forEach(k=>{ if(r[k])S.res[k]=(S.res[k]||0)+r[k]; });
  (r.items||[]).forEach(it=>{ S.gear.push(it); S.bestiary.gear[it]=true; });
  (r.flags||[]).forEach(f=>setFlag(f));
  if(r.xp)gainXp(r.xp.skill,r.xp.amount);
  st.s=QS.CLAIMED;
  if(q.repeatable) startQuest(q); // bounties immediately re-offer
  save(); updateHUD(); checkUnlocks(); updateQuestTracker();
}
function claimReward(id){ const q=QBYID[id], st=S.qs&&S.qs[id];
  if(!q||!st||st.s!==QS.COMPLETE)return;
  grantQuestRewards(q);
  burstRing(player.px*TILE+TILE/2,player.py*TILE+TILE-14,'#ffd479',16,95);
  toast('Reward claimed ✦'); panelQuests();
}
function rewardStr(r){ const p=[];
  if(r.astral)p.push('◈'+r.astral); if(r.shard)p.push('✦'+r.shard);
  ['ore','wood','herb','fish','dust','bio'].forEach(k=>{ if(r[k])p.push((RESINFO[k]||k)+r[k]); });
  (r.items||[]).forEach(it=>p.push('⚔ '+GEAR[it].name));
  if(r.xp)p.push('+'+r.xp.amount+' '+r.xp.skill+' xp');
  return p.join('  '); }
function activeObjectives(){ // flat list of {q,o,cur} for ACTIVE quests, incomplete first
  const list=[]; if(!S.qs)return list;
  for(const q of QUESTS){ const st=S.qs[q.id]; if(!st||st.s!==QS.ACTIVE)continue;
    for(const o of q.objectives){ list.push({q,o,cur:st.o[o.id]||0}); } }
  return list; }
function updateQuestTracker(){ const el=$('#questtracker'); if(!el)return;
  // any claimable quest? show a claim nudge first
  const claimable=QUESTS.filter(q=>qStatus(q.id)===QS.COMPLETE).length;
  const objs=activeObjectives().filter(x=>x.cur<x.o.count).slice(0,3);
  if(!objs.length&&!claimable){ el.classList.remove('show'); el.innerHTML=''; return; }
  el.classList.add('show');
  let rows=objs.map(x=>{ const pct=Math.round(x.cur/x.o.count*100);
    return `<div class="qt-row"><div class="qt-t">${x.o.label||x.o.type} <span>${x.cur}/${x.o.count}</span></div>
      <div class="qt-bar"><div class="qt-fill" style="width:${pct}%"></div></div></div>`; }).join('');
  if(claimable)rows+=`<div class="qt-row" style="color:var(--gold)">✦ ${claimable} reward${claimable>1?'s':''} ready — tap to claim</div>`;
  el.innerHTML=`<div class="qt-h">📜 Quests</div>${rows}`;
}

/* ---- QUEST JOURNAL UI ---- */
let questTab='active';
function panelQuests(t){ if(t)questTab=t; const tab=questTab;
  const tabs=['active','completed'].map(k=>`<button class="qtab ${tab===k?'on':''}" onclick="panelQuests('${k}')">${k==='active'?'Active':'Completed'}</button>`).join('');
  let list;
  if(tab==='active'){ list=QUESTS.filter(q=>{const s=qStatus(q.id);return s===QS.ACTIVE||s===QS.COMPLETE;}); }
  else { list=QUESTS.filter(q=>qStatus(q.id)===QS.CLAIMED); }
  // group by chain
  const groups={}; list.forEach(q=>{(groups[q.chain]=groups[q.chain]||[]).push(q);});
  const order=['main','biome','npc','skill','bounty'];
  let body=order.filter(c=>groups[c]).map(c=>{
    const rows=groups[c].map(q=>questRow(q)).join('');
    return `<div class="qgroup"><div class="qgrouph">${CHAIN_LABEL[c]||c}</div>${rows}</div>`;
  }).join('');
  if(!body)body=`<div class="muted center" style="padding:20px 0">${tab==='active'?'No active quests right now — keep exploring to unlock more.':'No completed quests yet.'}</div>`;
  modal(`<h2>📜 Quest Journal</h2><div class="qtabs">${tabs}</div>${body}`);
}
function questRow(q){
  const st=S.qs[q.id]||{s:qStatus(q.id),o:{}};
  const done=st.s===QS.COMPLETE, claimed=st.s===QS.CLAIMED;
  const objs=q.objectives.map(o=>{ const cur=Math.min(o.count,st.o&&st.o[o.id]||0), pct=Math.round(cur/o.count*100), ok=cur>=o.count;
    return `<div class="qobj"><div class="qobjt">${ok?'<span style="color:var(--good)">✓</span>':'○'} ${o.label||o.type} <span class="muted">${cur}/${o.count}</span></div>
      <div class="qbar"><div class="qfill" style="width:${pct}%;${ok?'background:linear-gradient(90deg,var(--good),#39c47e)':''}"></div></div></div>`;}).join('');
  return `<div class="card ${q.chain==='main'?'glow-legend':''}" style="${claimed?'opacity:.6':''}">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
      <b>${q.title}</b>${q.repeatable?'<span class="chip">repeatable</span>':''}</div>
    <div class="muted" style="font-size:11px;margin:2px 0 7px">${q.desc}</div>
    ${objs}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:7px">
      <span style="font-size:11px;color:var(--gold)">${rewardStr(q.rewards||{})}</span>
      ${done?`<button class="btn gold sm" style="padding:4px 10px" onclick="claimReward('${q.id}')">Claim</button>`:claimed?'<span class="muted" style="font-size:11px">✓ Claimed</span>':''}
    </div></div>`;
}
function hardReset(){modal(`<h2>Reset Everything?</h2><div class="muted">This wipes all progress permanently.</div>
  <div class="row" style="margin-top:14px"><button class="btn ghost sm" style="flex:1" onclick="closeModal()">Cancel</button>
  <button class="btn sm" style="flex:1;background:linear-gradient(180deg,var(--bad),#c0394a);color:#fff" onclick="localStorage.removeItem('astrari2');location.reload()">Reset</button></div>`);}

/* ===================================================================
   DIALOGUE · VISION · CAELUN · LORE  (Act 1 story engine)
   =================================================================== */
const ROLE_SPEC={ forge:{skin:'#d8a878',cloak:'#8a4a2a'}, shrine:{skin:'#e8c8a8',cloak:'#5a3b8a'},
  market:{skin:'#caa070',cloak:'#2a6a5a'}, lore:{skin:'#e0b890',cloak:'#3a5a8a'}, codex:{skin:'#cdb0e0',cloak:'#3a4a7a'} };
function portraitSpec(port){
  if(port==='player')return wardenSpec();
  if(port==='caelun')return CAELUN_SPEC;
  const r=ROLE_SPEC[port]; if(r)return {kind:'npc',skin:r.skin,cloak:r.cloak,hair:(NPC_INFO[port]&&NPC_INFO[port].hair)||'#2a2030',weapon:false};
  return null;
}
// ---- dialogue engine ----
let dlg=null; // {lines,i,full,shown,typing,onDone}
function runDialogue(id,onDone){ const lines=Array.isArray(id)?id:DLG[id]; if(!lines){onDone&&onDone();return;}
  player.busy=true; dlg={lines,i:-1,full:'',shown:0,typing:false,onDone:onDone||null};
  $('#dlg').classList.add('show'); dlgNext(); }
function dlgNext(){ const st=dlg; if(!st)return; st.i++;
  if(st.i>=st.lines.length){ dlgEnd(); return; }
  const ln=st.lines[st.i];
  const narr=ln.sp==='NARRATOR';
  const nameEl=$('#dlg-name'), textEl=$('#dlg-text'), portWrap=$('#dlg-port'), choicesEl=$('#dlg-choices'), adv=$('#dlg-adv');
  choicesEl.innerHTML='';
  nameEl.className=narr?'narrator':(ln.port==='caelun'?'caelun':'');
  nameEl.textContent=narr?'':ln.sp;
  textEl.className=narr?'narr':'';
  // portrait
  if(ln.port==='yvalethi'){ portWrap.classList.remove('hide'); const c=$('#dlg-pc'),g=c.getContext('2d'); g.clearRect(0,0,132,132); drawYvalethi(g,66,124,0.62); }
  else { const spec=ln.port?portraitSpec(ln.port):null;
    if(spec){ portWrap.classList.remove('hide'); const c=$('#dlg-pc'),g=c.getContext('2d'); g.clearRect(0,0,132,132);
      const sg=g.createRadialGradient(66,60,4,66,70,64); sg.addColorStop(0,'rgba(40,55,90,.5)');sg.addColorStop(1,'rgba(40,55,90,0)');
      g.fillStyle=sg;g.fillRect(0,0,132,132);
      if(ln.port==='caelun'){ for(let k=0;k<7;k++){drawGlow(g,30+Math.random()*72,30+Math.random()*80,'#7a3bd4',3+Math.random()*3,0.5);} }
      drawAvatar(g,66,116,2.9,spec,'down',0); }
    else portWrap.classList.add('hide'); }
  // typewriter
  st.full=ln.text; st.shown=0; st.typing=true; textEl.textContent=''; adv.classList.add('hide');
  st._choices=ln.choices||null;
}
function dlgTick(dt){ const st=dlg; if(!st||!st.typing)return;
  st.shown=Math.min(st.full.length, st.shown + dt*60);
  $('#dlg-text').textContent=st.full.slice(0,Math.floor(st.shown));
  if(st.shown>=st.full.length){ st.typing=false; dlgReveal(); } }
function dlgReveal(){ const st=dlg; if(!st)return; st.typing=false; $('#dlg-text').textContent=st.full;
  if(st._choices){ const ce=$('#dlg-choices'); ce.innerHTML=st._choices.map((c,i)=>`<button class="btn ghost sm" onclick="dlgChoose(${i})">${c.text}</button>`).join(''); $('#dlg-adv').classList.add('hide'); }
  else $('#dlg-adv').classList.remove('hide'); }
function dlgAdvance(){ const st=dlg; if(!st)return;
  if(st.typing){ st.shown=st.full.length; dlgTick(0); dlgReveal(); return; }
  if(st._choices)return; // must choose
  dlgNext(); }
function dlgChoose(i){ const st=dlg; if(!st||!st._choices)return; const c=st._choices[i];
  if(c.set)setFlag(c.set); if(c.vision){ const v=c.vision; dlgEnd(()=>showVision(v)); return; }
  if(c.seq && DLG[c.seq]){ st.lines=st.lines.slice(0,st.i+1).concat(DLG[c.seq]); } // branch into a follow-up
  st._choices=null; dlgNext(); }
function dlgEnd(after){ const cb=dlg&&dlg.onDone; dlg=null; $('#dlg').classList.remove('show'); player.busy=false;
  if(after)after(); else if(cb)cb(); }
// ---- vision ----
let vision=null;
function showVision(id,onDone){ const v=VISIONS[id]; if(!v){onDone&&onDone();return;}
  player.busy=true; vision={id,onDone:onDone||null}; sfx('vision');
  logLore('vision',id);
  $('#vision-cap').textContent=v.caption;
  const c=$('#vision-cv'),g=c.getContext('2d'); g.clearRect(0,0,260,220);
  drawYvalethi(g,130,150,1);
  $('#vision').classList.add('show'); }
function visionAdvance(){ const cb=vision&&vision.onDone; vision=null; $('#vision').classList.remove('show'); player.busy=false; if(cb)cb(); }
function drawYvalethi(g,cx,cy,s){ // tall luminous figure
  const grd=g.createLinearGradient(cx,cy-140*s,cx,cy+20*s);
  grd.addColorStop(0,'rgba(150,255,210,0)');grd.addColorStop(.4,'rgba(120,245,190,.55)');grd.addColorStop(.75,'rgba(90,210,255,.8)');grd.addColorStop(1,'rgba(70,232,200,.2)');
  g.save();
  drawGlow(g,cx,cy-70*s,'#5ad0ff',60*s,0.5);
  g.fillStyle=grd; g.beginPath();
  g.moveTo(cx-10*s,cy); g.quadraticCurveTo(cx-22*s,cy-90*s,cx,cy-150*s); g.quadraticCurveTo(cx+22*s,cy-90*s,cx+10*s,cy); g.closePath(); g.fill();
  // head
  drawGlow(g,cx,cy-128*s,'#bfffe6',16*s,0.8);
  g.fillStyle='rgba(235,255,245,.9)'; g.beginPath(); g.arc(cx,cy-128*s,10*s,0,7); g.fill();
  // drifting motes
  for(let k=0;k<10;k++){ const a=k/10*7+now*0.0008; const rr=(40+k*4)*s;
    g.fillStyle='rgba(160,255,220,'+(0.2+0.2*Math.sin(now*0.003+k))+')';
    g.beginPath();g.arc(cx+Math.cos(a)*rr,cy-70*s+Math.sin(a*1.3)*40*s,1.6*s,0,7);g.fill(); }
  g.restore();
}
// ---- lore journal ----
function logLore(type,id){ if(!S.lore)S.lore=[]; if(!S.lore.some(e=>e.type===type&&e.id===id))S.lore.push({type,id,t:S.day}); save(); }
function panelLore(){
  const seen=S.lore||[];
  const visions=seen.filter(e=>e.type==='vision').map(e=>{const v=VISIONS[e.id];return `<div class="card glow-legend"><div style="font-weight:700;color:var(--teal)">✦ ${v.title}</div><div class="muted" style="font-style:italic;margin-top:4px;line-height:1.6">${v.caption}</div></div>`;}).join('');
  const meets=seen.filter(e=>e.type==='caelun').length?`<div class="card"><div style="font-weight:700;color:var(--violet)">☄ Caelun Drey</div><div class="muted" style="margin-top:4px">The scholar who unmade the Tree, certain it was mercy. He waits at the Edge.</div></div>`:'';
  // tablets discovered, grouped by biome
  let totalT=0, gotT=0; const tabGroups=[];
  for(const bk in TABLETS){ const all=TABLETS[bk]; const found=all.map((t,i)=>({t,i})).filter(o=>S.read&&S.read[bk+'_'+o.i]);
    totalT+=all.length; gotT+=found.length; if(!found.length)continue;
    const done=found.length===all.length;
    tabGroups.push(`<div class="qgrouph">${BIOME_LABEL[bk]||bk} <span class="chip">${found.length}/${all.length}${done?' ✓':''}</span></div>`+
      found.map(o=>`<div class="card"><div style="font-weight:700;color:#7ad0ff;font-size:12px">📜 ${o.t.title}</div><div class="muted" style="font-style:italic;margin-top:3px;line-height:1.6;font-size:12px">${o.t.text}</div></div>`).join('')); }
  const tabs=tabGroups.length?`<div class="qgrouph" style="margin-top:14px;color:var(--teal)">Lore Tablets <span class="chip">${gotT}/${totalT}</span></div>${tabGroups.join('')}`:'';
  modal(`<h2>📖 Hall of Echoes</h2><div class="muted" style="margin:-6px 0 10px">${LORE_INTRO.text}</div>
    ${visions||'<div class="muted">No visions yet. Attune to your Root Shard.</div>'}${meets}${tabs}`);
}
// ---- Caelun special encounter ----
let caelun=null;
function spawnCaelun(){ if(caelun)return; const s=nearestWalkAdj(39,51)||[39,51]; caelun={x:s[0],y:s[1],active:true,face:'up'}; }
function spawnFinalCaelun(){ if(caelun)return; const s=nearestWalkAdj(39,68)||nearestWalkAdj(39,66)||[39,67]; caelun={x:s[0],y:s[1],active:true,face:'up',final:true}; }
function caelunTalk(){ if(!caelun)return; face(caelun.x,caelun.y);
  if(caelun.final){ runDialogue('caelun_final',()=>{ const path=hasFlag('final_yvalethi')?'yvalethi':hasFlag('final_caelun')?'caelun':null; if(path)showEnding(path); else { caelun=null; } }); return; }
  runDialogue('caelun_first',()=>{ logLore('caelun','caelun_first'); caelun=null; updateObjective('caelun','*',1); toast('✦ Act I complete — the Hall of Echoes opens'); }); }
/* ---- ENDINGS (Act 4 climax) ---- */
function showEnding(path){ const e=ENDINGS[path]; if(!e)return;
  setFlag('act_finished'); setFlag('final_choice',path); logLore('ending',path); caelun=null; updateObjective('caelun_final','*',1); save();
  player.busy=true; const ov=$('#vision'); ov.className='show ending '+path; $('#vision-stage').style.display='none'; $('#vision-adv').style.display='none';
  let i=0; function step(){ if(i>=e.lines.length){ setTimeout(()=>showCredits(path),2000); return; }
    $('#vision-cap').innerHTML='<b style="display:block;margin-bottom:14px;font-size:15px;font-style:normal">'+e.title+'</b><div class="endline">'+e.lines[i]+'</div>';
    i++; setTimeout(step,2900); }
  step(); }
function showCredits(path){ const ov=$('#vision'); ov.classList.remove('show'); ov.className=''; $('#vision-stage').style.display=''; $('#vision-adv').style.display=''; player.busy=false;
  sfx(path==='yvalethi'?'victory':'defeat');
  modal(`<h2 class="center gold">✦ ASTRARI ✦</h2>
    <div class="center muted" style="line-height:1.9">Echoes of the Verdant Stars<br><br>
      ${path==='yvalethi'?'You chose the long work. The rebuilding begins, and it is yours to carry.':'You chose the quiet. The world rests at last — complete, peaceful, and empty.'}<br><br>
      <b style="color:var(--teal)">Thank you for playing.</b><br>
      <span style="font-size:11px">Skyhaven still drifts. The Watch continues —<br>roam on, hunt the elites, master your crafts, or begin anew.</span></div>
    <button class="btn gold" onclick="closeModal()">Continue the Watch</button>`); }
/* ---- NPC + BUILDINGS ---- */
function concludeQuest(q,n){ // play done dialogue + vision, then grant
  runDialogue(q.doneDlg||[],()=>{ if(q.vision)showVision(q.vision,()=>turnInQuest(q,n)); else turnInQuest(q,n); });
}
const TOWN_LINES=[
  'They say the shard at your belt still remembers the Tree. Lucky thing. Most of us only remember the fear.',
  'Borin set three places at supper last night. Same as every night. We don’t say anything.',
  'My grandmother walked south once, toward the ring. Came back quiet. Lived forty more years and never told us what she saw.',
  'The Aurora’s out tonight. Old folk say it’s the Tree dreaming. I just think it’s pretty.',
  'You’re the one Lune’s been waiting for, aren’t you? She’s been waiting twenty years. Don’t take it personally.',
  'Careful in the north. The cold up there doesn’t kill you fast. It just keeps you company until you stop.',
  'Quill swears the Hollow walk the old trade roads. Gives me chills. He maps them anyway. For business, he says.',
];
function talkNPC(n){
  const role=n.role;
  if(role==='townsfolk'){ const line=TOWN_LINES[(Math.random()*TOWN_LINES.length)|0];
    modal(`<h2>Townsperson</h2><div class="card"><div class="muted" style="font-style:italic;line-height:1.7">“${line}”</div></div>`); return; }
  const q=QUESTS.find(q=>q.npc===role && (qStatus(q.id)===QS.ACTIVE||qStatus(q.id)===QS.COMPLETE));
  if(q){ const st=S.qs[q.id];
    if(st.s===QS.COMPLETE && !q.auto){ if(role)updateObjective('talk',role,1); concludeQuest(q,n); return; }
    if(st.s===QS.ACTIVE && !st.told && q.startDlg){ st.told=1; save();
      runDialogue(q.startDlg,()=>{ if(role)updateObjective('talk',role,1);
        const s2=S.qs[q.id];
        if(s2.s===QS.COMPLETE && !q.auto){ if(q.doneDlg)concludeQuest(q,n); else turnInQuest(q,n); }  // single-talk quest finishes now
        else npcServices(n); });
      return; }
  }
  if(role)updateObjective('talk',role,1);
  const arc='arc_'+role;
  if(DLG[arc] && !(q&&q.startDlg)){ runDialogue(arc,()=>npcServices(n)); return; }
  npcServices(n);
}
function turnInQuest(q,n){ if(S.qs[q.id]&&S.qs[q.id].s===QS.COMPLETE){ grantQuestRewards(q); burstRing(player.px*TILE+TILE/2,player.py*TILE+TILE-14,'#ffd479',16,95); toast('✦ '+q.title+' — complete'); }
  npcServices(n); }
function npcServices(n){ const role=n.role;
  if(role==='market'||role==='forge'||role==='shrine'){
    modal(`<h2>${n.name}</h2><div class="muted" style="margin:-6px 0 10px">${(NPC_INFO[role]&&NPC_INFO[role].title)||''}</div>
      ${role==='market'?`<button class="btn gold" onclick="sellMats()">Sell 10 Ore + 10 Wood → 8 ✦</button>`:''}
      ${role==='forge'?`<button class="btn" onclick="closeModal();panelCraft()">Open the Star-Forge ⚒</button>`:''}
      ${role==='shrine'?`<button class="btn violet" onclick="closeModal();panelCraft()">Approach the Shrine ✦</button>`:''}`);
  }
}
function sellMats(){if(S.res.ore<10||S.res.wood<10)return toast('Need 10 ore & 10 wood');
  S.res.ore-=10;S.res.wood-=10;S.res.shard+=8;save();updateHUD();toast('Sold for 8 ✦');panelBag&&closeModal();}
function openBuilding(b){ enterInterior(b); }

/* ===================================================================
   BUILDING INTERIORS — Pokémon-style walk-in with a fade transition
   =================================================================== */
const INTERIORS={
  forge:{name:'The Star-Forge',floor:'#41342c',floor2:'#372b24',wall:'#241a14',rug:'#7a2f24',accent:'#ff8a3a',
    station:{x:4,y:1,icon:'🔨',label:'Anvil',action:'craft'}, deco:[{x:1,y:1,t:'furnace'},{x:7,y:1,t:'barrel'}],
    npc:{x:5,y:2,name:'Smith Borin',skin:'#d8a878',cloak:'#8a4a2a',hair:'#3a2218',role:'forge'}},
  shrine:{name:'Shrine of Yvalethi',floor:'#2c3550',floor2:'#262e46',wall:'#1a2236',rug:'#4a3b8a',accent:'#b388ff',
    station:{x:4,y:1,icon:'✦',label:'Altar',action:'craft'}, deco:[{x:1,y:1,t:'candle'},{x:7,y:1,t:'candle'}],
    npc:{x:5,y:2,name:'Priestess Vael',skin:'#e8c8a8',cloak:'#5a3b8a',hair:'#2a1f3a',role:'shrine'}},
  market:{name:'Skyhaven Market',floor:'#3a4030',floor2:'#333929',wall:'#23281a',rug:'#2a6a5a',accent:'#6ad0a0',
    station:{x:4,y:1,icon:'⚖',label:'Stall',action:'market'}, deco:[{x:1,y:1,t:'barrel'},{x:7,y:1,t:'barrel'}],
    npc:{x:3,y:2,name:'Trader Quill',skin:'#caa070',cloak:'#2a6a5a',hair:'#3a2a1a',role:'market'}},
  codex:{name:'Hall of Echoes',floor:'#332b48','floor2':'#2c2540',wall:'#211b33',rug:'#3a4a7a',accent:'#9be8ff',
    station:{x:4,y:1,icon:'📖',label:'Codex',action:'codex'}, deco:[{x:1,y:1,t:'shelf'},{x:7,y:1,t:'shelf'}],
    npc:{x:5,y:2,name:'Archivist Lune',skin:'#cdb0e0',cloak:'#3a4a7a',hair:'#241a3a',role:'codex'}},
  house:{name:'Warden Lodge',floor:'#43392f',floor2:'#3a3127',wall:'#26201a',rug:'#3a5a8a',accent:'#ffd479',
    station:{x:4,y:1,icon:'🛏',label:'Rest',action:'rest'}, deco:[{x:1,y:1,t:'shelf'},{x:7,y:2,t:'barrel'}],
    npc:null},
};
let interior=null, pendingIn=null;
let fade={a:0,dir:0,mid:null};
function startFade(mid){ if(fade.dir!==0)return; fade.dir=1; fade.mid=mid||null; }
function updateFade(dt){
  if(fade.dir===1){ fade.a=Math.min(1,fade.a+dt*3.4); if(fade.a>=1){ if(fade.mid){const m=fade.mid;fade.mid=null;m();} fade.dir=-1; } }
  else if(fade.dir===-1){ fade.a=Math.max(0,fade.a-dt*3.0); if(fade.a<=0)fade.dir=0; }
}
function fadeBusy(){return fade.dir!==0;}
function bfsGrid(sx,sy,tx,ty,W,H,pass){
  if(sx===tx&&sy===ty)return[];
  const key=(x,y)=>y*W+x; const q=[[sx,sy]],prev=new Map();prev.set(key(sx,sy),null);
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];let found=false;
  while(q.length){const[x,y]=q.shift();if(x===tx&&y===ty){found=true;break;}
    for(const[dx,dy]of dirs){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;if(!pass(nx,ny))continue;if(prev.has(key(nx,ny)))continue;prev.set(key(nx,ny),[x,y]);q.push([nx,ny]);}}
  if(!found)return null;const path=[];let c=[tx,ty];while(c){path.push(c);c=prev.get(key(c[0],c[1]));}path.reverse();path.shift();return path;
}
function enterInterior(b){
  if(fadeBusy()||interior)return;
  const def=INTERIORS[b.kind]||INTERIORS.house;
  startFade(()=>{
    const W=9,H=7;
    const solid=(x,y)=> x===0||y===0||x===W-1||y===H-1; // border walls (door gap handled below)
    const exit={x:4,y:H-1};
    interior={b,def,W,H,exit,
      station:def.station, npc:def.npc, deco:def.deco||[],
      pl:{px:4,py:H-2,tx:4,ty:H-2,face:'up',path:[],moving:false,bob:0},
      solidFn:(x,y)=>{ if(x===exit.x&&y===exit.y)return false; if(solid(x,y))return true;
        if(def.station&&def.station.x===x&&def.station.y===y)return true;
        if(def.npc&&def.npc.x===x&&def.npc.y===y)return true;
        for(const d of (def.deco||[]))if(d.x===x&&d.y===y)return true; return false; }};
  });
}
function exitInterior(){
  if(fadeBusy())return;
  startFade(()=>{ interior=null; });
}
function stepInterior(dt){
  const I=interior, p=I.pl;
  if(!p.path.length){ p.moving=false;
    if(pendingIn){ const act=pendingIn; pendingIn=null; doInteriorAction(act); }
    return; }
  const [nx,ny]=p.path[0]; const dx=nx-p.px, dy=ny-p.py, d=Math.hypot(dx,dy);
  if(dx>0.05)p.face='right';else if(dx<-0.05)p.face='left';else if(dy>0.05)p.face='down';else if(dy<-0.05)p.face='up';
  const sp=5.0*dt;
  if(d<=sp){ p.px=nx;p.py=ny;p.tx=nx;p.ty=ny;p.path.shift();
    if(nx===I.exit.x&&ny===I.exit.y){ p.path=[]; exitInterior(); return; }
  } else { p.px+=dx/d*sp; p.py+=dy/d*sp; }
  p.bob=Math.abs(Math.sin(now*0.012))*2;
}
function doInteriorAction(act){
  if(act==='craft')panelCraft();
  else if(act==='market')talkNPC({name:interior.def.name,role:'market'});
  else if(act==='codex')panelCodex();
  else if(act==='rest'){ toast('You rest at the Lodge. The Warden is renewed. 🛏'); }
  else if(act==='npc'&&interior.npc)talkNPC({name:interior.npc.name,role:interior.npc.role});
}
function interiorTap(sx,sy){
  const I=interior; if(!I||fadeBusy())return;
  const tx=Math.floor((sx-I.ox)/I.itile), ty=Math.floor((sy-I.oy)/I.itile);
  if(tx<0||ty<0||tx>=I.W||ty>=I.H)return;
  // tapping the station, npc, or exit routes to that tile (adjacent) + action
  let dest=null, act=null;
  if(I.station&&tx===I.station.x&&ty===I.station.y){ dest=[I.station.x,I.station.y+1]; act='craft'===I.station.action?'craft':I.station.action; }
  else if(I.npc&&tx===I.npc.x&&ty===I.npc.y){ dest=[I.npc.x,I.npc.y+1]; act='npc'; }
  else if(tx===I.exit.x&&ty===I.exit.y){ dest=[I.exit.x,I.exit.y]; act=null; }
  else if(!I.solidFn(tx,ty)){ dest=[tx,ty]; }
  if(!dest)return;
  const path=bfsGrid(Math.round(I.pl.px),Math.round(I.pl.py),dest[0],dest[1],I.W,I.H,(x,y)=>!I.solidFn(x,y));
  if(path){ I.pl.path=path; I.pl.moving=true; pendingIn=act; if(path.length===0&&act){pendingIn=null;doInteriorAction(act);} }
}
function renderInterior(){
  const I=interior;
  const itile=Math.min(Math.floor((VW-24)/I.W), Math.floor((VH-220)/I.H));
  I.itile=itile; const ox=Math.round((VW-I.W*itile)/2), oy=Math.round((VH-I.H*itile)/2); I.ox=ox; I.oy=oy;
  ctx.fillStyle='#05070d';ctx.fillRect(0,0,VW,VH);
  // floor + walls
  for(let y=0;y<I.H;y++)for(let x=0;x<I.W;x++){
    const px=ox+x*itile, py=oy+y*itile, border=x===0||y===0||x===I.W-1||y===I.H-1;
    if(border&&!(x===I.exit.x&&y===I.H-1)){
      ctx.fillStyle=I.def.wall;ctx.fillRect(px,py,itile,itile);
      ctx.fillStyle=shade(I.def.wall,18);ctx.fillRect(px,py,itile,4);
      ctx.fillStyle=shade(I.def.wall,-18);ctx.fillRect(px,py+itile-3,itile,3);
    } else {
      ctx.fillStyle=((x+y)&1)?I.def.floor:I.def.floor2;ctx.fillRect(px,py,itile,itile);
      ctx.fillStyle='rgba(0,0,0,.06)';ctx.fillRect(px,py,itile,1);
    }
  }
  // rug under station
  ctx.fillStyle=I.def.rug;ctx.globalAlpha=.35;
  ctx.fillRect(ox+(I.W>>1)*itile-itile, oy+itile-2, itile*3, itile*3);ctx.globalAlpha=1;
  // exit mat
  const ex=ox+I.exit.x*itile, ey=oy+I.exit.y*itile;
  ctx.fillStyle='#0a0d14';ctx.fillRect(ex,ey,itile,itile);
  ctx.fillStyle=I.def.accent;ctx.globalAlpha=.5+0.25*Math.sin(now*0.005);
  ctx.font=Math.round(itile*0.5)+'px serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('▼',ex+itile/2,ey+itile/2);ctx.globalAlpha=1;
  // deco
  for(const d of I.deco){ drawInteriorDeco(d,ox+d.x*itile,oy+d.y*itile,itile,I.def); }
  // depth-sorted: station, npc, player
  const objs=[];
  if(I.station)objs.push({y:I.station.y,fn:()=>drawStation(I.station,ox+I.station.x*itile,oy+I.station.y*itile,itile,I.def)});
  if(I.npc)objs.push({y:I.npc.y,fn:()=>drawAvatar(ctx,ox+I.npc.x*itile+itile/2,oy+I.npc.y*itile+itile-4,itile/26,{kind:'npc',skin:I.npc.skin,cloak:I.npc.cloak,hair:I.npc.hair,weapon:false},'down',0)});
  objs.push({y:I.pl.py+0.5,fn:()=>drawAvatar(ctx,ox+I.pl.px*itile+itile/2,oy+I.pl.py*itile+itile-4,itile/26*1.02,wardenSpec(),I.pl.face,I.pl.moving?I.pl.bob:0)});
  objs.sort((a,b)=>a.y-b.y).forEach(o=>o.fn());
  ctx.textBaseline='alphabetic';
  // title banner
  ctx.fillStyle='rgba(8,12,22,.8)';roundRect(ox,oy-34,I.W*itile,26,7);ctx.fill();
  ctx.fillStyle=I.def.accent;ctx.font='bold 13px sans-serif';ctx.textAlign='center';
  ctx.fillText(I.def.name,VW/2,oy-16);
  ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='10px sans-serif';
  ctx.fillText('Tap the ▼ mat to leave',VW/2,oy+I.H*itile+20);
}
function drawStation(st,px,py,it,def){
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(px+it/2,py+it-4,it*0.34,it*0.13,0,0,7);ctx.fill();
  ctx.fillStyle=shade(def.wall,30);ctx.fillRect(px+it*0.2,py+it*0.42,it*0.6,it*0.5);
  ctx.fillStyle=def.accent;ctx.save();ctx.globalAlpha=.35+0.25*Math.sin(now*0.006);
  ctx.beginPath();ctx.arc(px+it/2,py+it*0.42,it*0.28,0,7);ctx.fill();ctx.restore();
  ctx.fillStyle='#fff';ctx.font=Math.round(it*0.42)+'px serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(st.icon,px+it/2,py+it*0.44);
  ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='bold 9px sans-serif';ctx.fillText(st.label,px+it/2,py-4);
}
function drawInteriorDeco(d,px,py,it,def){
  ctx.textAlign='center';ctx.textBaseline='middle';
  if(d.t==='furnace'){ ctx.fillStyle='#2a2018';ctx.fillRect(px+it*0.2,py+it*0.3,it*0.6,it*0.6);
    ctx.fillStyle='rgba(255,140,50,'+(0.5+0.3*Math.sin(now*0.006))+')';ctx.beginPath();ctx.arc(px+it/2,py+it*0.62,it*0.18,0,7);ctx.fill(); }
  else { const ic={barrel:'🛢',candle:'🕯',shelf:'📚'}[d.t]||'📦';
    ctx.font=Math.round(it*0.55)+'px serif';ctx.fillStyle='#fff';ctx.fillText(ic,px+it/2,py+it*0.55); }
}
function drawFade(){ if(fade.a<=0)return; ctx.save();ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle='rgba(0,0,0,'+fade.a+')';ctx.fillRect(0,0,VW,VH);ctx.restore(); }

/* ===================================================================
   COMBAT — walk into enemy → auto battle
   =================================================================== */
function elemMult(a,b){if(ELEM[a].beats===b)return 1.5;if(ELEM[b].beats===a)return 0.7;return 1;}
// status effect each element can inflict (burn/poison DoT, freeze/curse/dazzle weaken)
const STATUS={
  ember:{id:'burn',n:'Burn',ic:'🔥',col:'#ff7a3a',dot:0.055,dur:3},
  flora:{id:'poison',n:'Poison',ic:'🜂',col:'#7ad06a',dot:0.045,dur:4},
  flux:{id:'freeze',n:'Freeze',ic:'❄',col:'#7fd4ff',atkDown:0.4,skip:0.35,dur:2},
  void:{id:'curse',n:'Curse',ic:'☠',col:'#a06cff',atkDown:0.35,dur:3},
  light:{id:'dazzle',n:'Dazzle',ic:'✦',col:'#ffd24a',atkDown:0.22,dur:2},
};
function rollLoot(m){
  const lv=m.lvl, mats={};
  const add=(k,n)=>{if(n>0)mats[k]=(mats[k]||0)+n;};
  add('dust', 1+Math.floor(lv/2)+(Math.random()<.5?1:0));
  if(Math.random()<0.65) add('ore', 1+Math.floor(lv/3));
  if(Math.random()<0.55) add('wood', 1+Math.floor(lv/3));
  if(Math.random()<0.40) add('herb', 1+Math.floor(lv/4));
  if(Math.random()<0.30) add('bio', 1+Math.floor(lv/4));
  if(Math.random()<0.18) add('fish', 1);
  // gear drop — chance + tier scale with level
  let gear=null;
  if(Math.random()<0.05+lv*0.009){
    let tier= lv<8?1: lv<18?2:3;
    if(Math.random()<0.15) tier=Math.min(3,tier+1);
    const pool=Object.values(GEAR).filter(g=>g.tier===tier);
    gear=pool[Math.random()*pool.length|0].id;
  }
  return {mats, gear};
}
let inBattle=false;
function startEncounter(m){
  if(inBattle||player.busy)return;
  inBattle=true;player.busy=true;player.path=[];player.moving=false;
  addShake(m.boss?9:m.elite?7:5); // impact jolt as the clash begins
  const w=wardenStats();
  const isBoss=!!m.boss;
  const allies=[{name:'You (Warden)',spec:wardenSpec(),el:'light',atk:Math.round(w.atk*(1+w.teamAtk)),hp:w.hp,maxhp:w.hp,alive:true,warden:true,status:null}];
  // STRONG team of 3 — champions get an "elite" boost since the squad is small
  S.squad.filter(Boolean).forEach(id=>{const d=champDef(id),h=S.heroes[id],lv=h.lvl,grow=1+(lv-1)*0.09,mu=RAR[d.rar].mult,ELITE=1.35;
    allies.push({name:d.name.split(' ')[0],spec:champSpec(id),el:d.el,atk:Math.round(d.atk*grow*mu*ELITE*(1+w.teamAtk)),hp:Math.round(d.hp*grow*mu*ELITE),maxhp:Math.round(d.hp*grow*mu*ELITE),alive:true,status:null});});
  // foe group scales with monster level AND the warden's level (they keep pace), plus region danger
  const region=(m.bx>=40)?4:(m.bx<=6?2:0);
  const base=Math.max(m.lvl, combatLevel()-2+region);
  const foes=[];
  // ~5 foes (3 vs 5). Bosses bring a stronger, larger pack.
  const cnt=isBoss?6:(m.elite?5:5);
  const leadName=isBoss?m.boss.name.split(/[ ,]/)[0]:(m.elite?m.eliteName:(m.biome&&VARIANTS[m.biome]?'Hollow '+(m.variant||'Spawn'):'Hollow Spawn'));
  for(let i=0;i<cnt;i++){const lead=i===0;const el=lead?m.el:Object.keys(ELEM)[(base+i)%5];
    const lv=Math.max(1,base-(lead?0:1+(i%3)));
    const eliteMul=m.elite&&lead?1.4:1;
    const bossMul=isBoss&&lead?2.0:1;
    const hp=Math.round((80+lv*50)*(lead?1.5:1)*bossMul*eliteMul);
    foes.push({name:lead?leadName:'Hollow Spawn',
      spec:{kind:'monster',cloak:ELEM[el].col,glow:(isBoss||m.elite)&&lead?'#ffd24a':'#ff5a7a',vidx:lead?(m.vidx||0):0,elite:m.elite&&lead},el,
      atk:Math.round((11+lv*6.5)*(lead?1.3:1)*(isBoss&&lead?1.5:1)*eliteMul),hp,maxhp:hp,alive:true,status:null,lead});}
  // ---- champion synergies (Session 9) ----
  const champs=S.squad.filter(Boolean).map(id=>champDef(id));
  let synAtk=1, synHp=1, synMsg='';
  if(champs.length>=3){
    const els={}; champs.forEach(c=>els[c.el]=(els[c.el]||0)+1);
    const maxEl=Object.keys(els).reduce((a,b)=>els[b]>els[a]?b:a,champs[0].el);
    if(els[maxEl]>=3){ synAtk*=1.20; synMsg='Elemental Harmony · '+ELEM[maxEl].n+' — +20% attack'; }
    if(champs.every(c=>c.rar==='legend')){ synAtk*=1.15; synHp*=1.15; synMsg='★ Starborn Trio — +15% all stats'; }
  }
  if(synAtk!==1||synHp!==1)allies.forEach(u=>{ u.atk=Math.round(u.atk*synAtk); u.hp=Math.round(u.hp*synHp); u.maxhp=Math.round(u.maxhp*synHp); });
  battleData={allies,foes,mon:m,eff:base,isBoss,elite:m.elite,synMsg};
  showBattleModal();
}
let battleData=null;
function unitRow(u,side,i){
  const pct=u.hp/u.maxhp*100;
  return `<div class="unit ${side==='foe'?'foe':''}${u.hp/u.maxhp<0.3?' low':''}" id="bu-${side}-${i}" style="${u.alive?'':'opacity:.3;filter:grayscale(1)'}">
    <canvas data-u="${side}-${i}" width="26" height="32"></canvas>
    <div style="flex:1;min-width:0"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.name} <span class="elem ${ELEM[u.el].c}" style="width:12px;height:12px;line-height:12px;font-size:8px">${ELEM[u.el].n[0]}</span></div>
    <div class="hpbar"><div class="hpghost" style="width:${pct}%"></div><div class="hpfill" style="width:${pct}%"></div></div></div>
    <span class="stbadge"></span></div>`;
}
function showBattleModal(){
  const {allies,foes,mon}=battleData;
  const title=battleData.isBoss?`<span style="color:var(--gold)">☠ ${mon.boss.name}</span> · Lv ${mon.lvl}`:`Skirmish · Lv ${battleData.eff||mon.lvl} Hollow`;
  const bossU=battleData.isBoss?(foes.find(f=>f.lead)||foes[0]):null;
  battleData.bossU=bossU;
  const bossBar=bossU?`<div class="bossbar"><div class="bn"><span>☠ ${mon.boss.name.split(/[ ,]/)[0]}</span><span id="bosshp">${bossU.hp} / ${bossU.maxhp}</span></div>
      <div class="bb"><div class="bf" id="bossfill" style="width:100%"></div></div></div>`:'';
  modal(`<h2 class="${battleData.isBoss?'gold':''}">${title}</h2>${bossBar}
    <div class="arena" id="arena"><div class="side" id="ba">${allies.map((u,i)=>unitRow(u,'ally',i)).join('')}</div>
      <div class="vs">VS</div><div class="side" id="bf">${foes.map((u,i)=>unitRow(u,'foe',i)).join('')}</div></div>
    <div id="blog"></div>
    <div class="row" style="margin-top:8px"><button class="btn" id="bfight">⚔ Fight</button>
      <button class="btn ghost sm" id="bflee" style="flex:0 0 auto">Flee</button></div>`,true);
  paintBattleCanvases();
  $('#bfight').onclick=()=>{$('#bfight').disabled=true;$('#bflee').disabled=true;resolveBattle();};
  $('#bflee').onclick=()=>endBattle(false,true);
}
function paintBattleCanvases(){const{allies,foes}=battleData;
  $$('#mbox canvas[data-u]').forEach(c=>{const[side,i]=c.dataset.u.split('-');const u=(side==='ally'?allies:foes)[+i];
    const g=c.getContext('2d');g.clearRect(0,0,26,32);drawAvatar(g,13,30,0.92,u.spec,'down',0);});}
function blog(m){const l=$('#blog');if(l){l.innerHTML+=m+'<br>';l.scrollTop=l.scrollHeight;}}
function floatB(side,i,txt,col,cls){const el=$('#bu-'+side+'-'+i);if(!el)return;
  const f=document.createElement('div');f.className='float-dmg'+(cls?' '+cls:'');f.textContent=txt;f.style.color=col;f.style.top='0';el.appendChild(f);setTimeout(()=>f.remove(),1100);}
function sparkB(side,i,col,n){const el=$('#bu-'+side+'-'+i);if(!el)return;
  el.animate?el.animate([{transform:'translateX(0)'},{transform:'translateX(-3px)'},{transform:'translateX(3px)'},{transform:'translateX(0)'}],{duration:160}):0;
  for(let k=0;k<(n||6);k++){const sp=document.createElement('div');const ang=Math.random()*6.28,dist=7+Math.random()*15;
    sp.style.cssText=`position:absolute;left:50%;top:42%;width:3px;height:3px;border-radius:1px;background:${col};box-shadow:0 0 4px ${col};pointer-events:none;z-index:4;transition:transform .42s ease-out,opacity .42s;`;
    el.appendChild(sp);
    requestAnimationFrame(()=>{sp.style.transform=`translate(${Math.cos(ang)*dist}px,${Math.sin(ang)*dist}px)`;sp.style.opacity='0';});
    setTimeout(()=>sp.remove(),440);}}
function arenaFlash(col,big){const a=$('#arena');if(!a)return;
  const f=document.createElement('div');f.style.cssText=`position:absolute;inset:0;background:${col};border-radius:14px;pointer-events:none;z-index:5;opacity:.0;transition:opacity .07s;`;
  a.appendChild(f);requestAnimationFrame(()=>{f.style.opacity=big?'0.4':'0.22';requestAnimationFrame(()=>{f.style.transition='opacity .3s';f.style.opacity='0';});});
  setTimeout(()=>f.remove(),360);
  if(big&&a.animate)a.animate([{transform:'translateX(0)'},{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(-3px)'},{transform:'translateX(0)'}],{duration:200});}
function hpUI(side,i,u){const el=$('#bu-'+side+'-'+i);if(!el)return;
  const pct=Math.max(0,u.hp/u.maxhp*100);
  el.querySelector('.hpfill').style.width=pct+'%';
  el.querySelector('.hpghost').style.width=pct+'%';
  el.classList.toggle('low',u.alive&&u.hp/u.maxhp<0.3);
  const b=el.querySelector('.stbadge'); if(b){ if(u.status){b.textContent=u.status.ic;b.style.color=u.status.col;} else b.textContent=''; }
  if(!u.alive){el.style.opacity=.3;el.style.filter='grayscale(1)';}
  if(battleData&&battleData.bossU===u){ updateBossBar();
    if(!u._phase && u.alive && u.hp>0 && u.hp < u.maxhp*0.5){ u._phase=1; u.atk=Math.round(u.atk*1.4);
      arenaFlash('#ff8a3a',true); blog('<b style="color:var(--gold)">⚠ '+u.name+' breaks its restraint — a furious second phase begins!</b>'); } }
}
function updateBossBar(){const bu=battleData&&battleData.bossU;if(!bu)return;
  const f=$('#bossfill'); if(f)f.style.width=Math.max(0,bu.hp/bu.maxhp*100)+'%';
  const t=$('#bosshp'); if(t)t.textContent=Math.max(0,Math.ceil(bu.hp))+' / '+bu.maxhp;}
function applyStatus(u,el){const s=STATUS[el];if(!s)return;u.status={...s,dur:s.dur};}
async function resolveBattle(){
  const{allies,foes}=battleData;
  if(battleData.synMsg)blog('<b style="color:var(--gold)">⟡ '+battleData.synMsg+'</b>');
  blog('<b style="color:var(--teal)">The Hollow lunges…</b>');
  let round=0;
  while(allies.some(u=>u.alive)&&foes.some(u=>u.alive)&&round<40){round++;
    // tick damage-over-time statuses at round start
    for(const grp of[['ally',allies],['foe',foes]]){const[side,arr]=grp;
      arr.forEach((u,i)=>{ if(!u.alive||!u.status)return; const st=u.status;
        if(st.dot){const d=Math.max(1,Math.round(u.maxhp*st.dot));u.hp=Math.max(0,u.hp-d);
          floatB(side,i,st.ic+d,st.col); if(u.hp<=0)u.alive=false; hpUI(side,i,u);}
        st.dur--; if(st.dur<=0)u.status=null; });
    }
    if(!allies.some(u=>u.alive)||!foes.some(u=>u.alive))break;
    const order=[...allies.map((u,i)=>({u,side:'ally',i})),...foes.map((u,i)=>({u,side:'foe',i}))].filter(x=>x.u.alive).sort((a,b)=>b.u.atk-a.u.atk);
    for(const a of order){if(!a.u.alive)continue;
      // frozen units may skip their turn
      if(a.u.status&&a.u.status.skip&&Math.random()<a.u.status.skip){floatB(a.side,a.i,'❄ frozen',a.u.status.col);await sleep(90);continue;}
      const enemies=a.side==='ally'?foes:allies;const ts=enemies.map((u,i)=>({u,i})).filter(x=>x.u.alive);if(!ts.length)break;
      const t=ts[Math.random()*ts.length|0];const mult=elemMult(a.u.el,t.u.el);const crit=Math.random()<0.18;
      const atkDown=a.u.status&&a.u.status.atkDown?(1-a.u.status.atkDown):1;
      let dmg=Math.round(a.u.atk*atkDown*mult*(crit?1.8:1)*(0.85+Math.random()*0.3));
      t.u.hp=Math.max(0,t.u.hp-dmg);const ts2=a.side==='ally'?'foe':'ally';
      floatB(ts2,t.i,'-'+dmg+(crit?'!':''),crit?'#ffd479':mult>1?'#5ce6a4':'#ff9aa6',crit?'crit':'');
      sparkB(ts2,t.i,crit?'#ffd479':mult>1?'#5ce6a4':'#ff9aa6',crit?10:6); sfx(crit?'crit':'hit');
      if(ts2==='ally')arenaFlash('#ff3a4a',crit||dmg>t.u.maxhp*0.25); // hit flash when your team is struck
      // chance to inflict the attacker's elemental status (higher on crit / super-effective)
      if(t.u.alive&&t.u.hp>0&&Math.random()<(0.28+(crit?0.2:0)+(mult>1?0.15:0))){applyStatus(t.u,a.u.el);
        const st=STATUS[a.u.el];if(st){floatB(ts2,t.i,st.ic+st.n,st.col);blog(`<span style="color:${st.col}">${t.u.name} is afflicted with ${st.n}!</span>`);}}
      if(t.u.hp<=0)t.u.alive=false;
      hpUI(ts2,t.i,t.u);
      await sleep(110);
    }
  }
  endBattle(foes.every(u=>!u.alive),false);
}
function recordBestiary(m,defeated){
  const key=m.boss?('boss_'+m.boss.name):(m.biome+'_'+(m.variant||m.kind||'shade'));
  const bk=m.boss?S.bestiary.bosses:S.bestiary.mobs;
  const name=m.boss?m.boss.name:((BIOME_LABEL[m.biome]||m.biome||'Wild')+' '+(m.variant||'Hollow'));
  const e=bk[key]||(bk[key]={name,el:m.el,biome:m.biome,kills:0,maxLvl:0,boss:!!m.boss});
  if(m.elite)e.elite=true;
  if(defeated){e.kills++;e.maxLvl=Math.max(e.maxLvl,m.lvl);if(m.boss)e.cleared=true;}
  S.bestiary.biomes[m.biome]=true;
}
function endBattle(win,fled){
  const m=battleData.mon, isBoss=battleData.isBoss;
  recordBestiary(m,win);
  if(fled){blog('You slip away into the mist.');}
  else if(win){
    const lv=battleData.eff||m.lvl;
    const rew={astral:(20+lv*8)*(isBoss?5:1),shard:(lv%3===0?2:0)+(isBoss?12:0)};
    S.res.astral+=rew.astral;S.res.shard+=rew.shard;
    const loot=rollLoot({lvl:lv});
    if(battleData.elite && !loot.gear){ const pool=Object.keys(GEAR).filter(k=>GEAR[k].tier<=Math.min(4,1+Math.floor(lv/12))&&!/^(w_tempest|w_infernal|a_glacial|r_thornheart|r_voidheart)$/.test(k)); if(pool.length)loot.gear=pool[(Math.random()*pool.length)|0]; } // elites guarantee gear
    let lootStr='';
    for(const k in loot.mats){S.res[k]+=loot.mats[k];lootStr+=` +${loot.mats[k]}${RESINFO[k]||k}`;}
    const cxp=(12+lv*4)*(isBoss?4:1);const before=combatLevel();S.combatXp+=cxp;const after=combatLevel();
    S.quests.fight=(S.quests.fight||0)+1;
    updateObjective('kill', m.variant||m.kind||'shade', 1);
    if(m.elite)updateObjective('elite','*',1);
    if(isBoss){ updateObjective('boss_defeated','*',1); updateObjective('boss_defeated',m.boss.name,1); }
    m.alive=false;
    if(isBoss){
      // guaranteed legendary boss drop — once
      const drop=m.boss.drop;
      if(!S.bestiary.bosses['boss_'+m.boss.name].looted){ S.gear.push(drop); S.bestiary.bosses['boss_'+m.boss.name].looted=true; loot.gear=drop; }
      blog(`<b style="color:var(--gold)">☠ ${m.boss.name} falls! +${rew.astral}◈ +${rew.shard}✦${lootStr} · +${cxp} combat xp</b>`);
      // bosses return slowly and even fiercer
      setTimeout(()=>{m.alive=true;m.lvl=Math.min(60,m.lvl+3);m.maxhp=bossHp(m.lvl,m.boss);m.hp=m.maxhp;m.atk=bossAtk(m.lvl,m.boss);}, 90000);
    } else {
      // respawn fast and tougher — enemies level up quickly and chase the warden's level
      setTimeout(()=>{m.alive=true;m.lvl=Math.min(55,Math.max(m.lvl+2,combatLevel()-2));m.maxhp=bossHp(m.lvl);m.hp=m.maxhp;m.atk=bossAtk(m.lvl);}, 14000);
      blog(`<b style="color:var(--good)">✦ Victory! +${rew.astral}◈${rew.shard?' +'+rew.shard+'✦':''}${lootStr} · +${cxp} combat xp</b>`);
    }
    if(loot.gear){if(!isBoss)S.gear.push(loot.gear);S.bestiary.gear[loot.gear]=true;blog(`<b style="color:${RAR_T(GEAR[loot.gear].tier)}">⚔ Loot drop: ${GEAR[loot.gear].name}! (in your Bag)</b>`);}
    if(after>before)blog(`<b style="color:var(--gold)">Warden reached Level ${after}!</b>`);
    save();updateHUD();
    setTimeout(()=>showVictory({boss:isBoss,name:isBoss?m.boss.name.split(/[ ,]/)[0]:'',astral:rew.astral,shard:rew.shard,mats:Object.entries(loot.mats||{}),gear:loot.gear,cxp,levelUp:after>before?after:0}),650);
    return;
  } else {
    sfx('defeat');
    blog('<b style="color:var(--bad)">Defeated… you retreat to Skyhaven. Your gear and progress are safe.</b>');
    // retreat to town keep — lose nothing
    const s=safeSpawn(39,43);S.px=s[0];S.py=s[1];player.px=s[0];player.py=s[1];player.tx=s[0];player.ty=s[1];player.path=[];player.moving=false;
  }
  save();updateHUD();
  setTimeout(()=>{closeModal();finishBattle();},900);
}
function finishBattle(){inBattle=false;player.busy=false;}
function showVictory(d){
  sfx('victory');
  const rows=[];
  rows.push(`<div class="vrow"><span style="font-size:18px;color:var(--gold)">◈</span> <b>+${Math.round(d.astral)}</b> <span class="muted">Astral</span></div>`);
  if(d.shard)rows.push(`<div class="vrow"><span style="font-size:18px;color:var(--rare)">✦</span> <b>+${d.shard}</b> <span class="muted">Shards</span></div>`);
  (d.mats||[]).forEach(([k,n])=>rows.push(`<div class="vrow"><span style="font-size:16px">${RESINFO[k]||'•'}</span> <b>+${n}</b> <span class="muted">${k}</span></div>`));
  if(d.gear){const g=GEAR[d.gear];rows.push(`<div class="vrow"><span style="font-size:18px">⚔</span> <b style="color:${RAR_T(g.tier)}">${g.name}</b> <span class="muted">→ Bag</span></div>`);}
  rows.push(`<div class="vrow"><span style="font-size:16px">📈</span> <b>+${d.cxp}</b> <span class="muted">combat xp</span></div>`);
  if(d.levelUp)rows.push(`<div class="vrow" style="color:var(--gold)"><span style="font-size:16px">⭐</span> <b>Warden reached Level ${d.levelUp}!</b></div>`);
  modal(`<h2 class="${d.boss?'gold':''}">${d.boss?'☠ '+d.name+' Defeated':'✦ Victory'}</h2>
    <div style="margin:2px 0 4px">${rows.join('')}</div>
    <button class="btn gold" style="margin-top:6px" onclick="closeModal();finishBattle()">Continue ▸</button>`,true);
  $$('#mbox .vrow').forEach((r,i)=>{r.style.animationDelay=(0.06+i*0.11)+'s';});
  if(d.gear)burstRing(player.px*TILE+TILE/2,player.py*TILE+TILE-14,RAR_T(GEAR[d.gear].tier),16,90);
  setTimeout(()=>{ if(inBattle&&$('#modal').classList.contains('show')){closeModal();finishBattle();} }, 4200);
}

/* ===================================================================
   AMBIENT AUDIO  (procedural, no external files)
   =================================================================== */
const audio={ctx:null,master:null,windGain:null,nodes:[],started:false};
function initAudio(){
  if(audio.ctx)return;
  const C=window.AudioContext||window.webkitAudioContext; if(!C)return;
  const ctx=new C(); audio.ctx=ctx;
  const master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination); audio.master=master;
  // warm low drone (two sines through a slowly sweeping lowpass)
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=520; lp.Q.value=0.4; lp.connect(master); audio.lp=lp;
  [110,164.81].forEach(f=>{const o=ctx.createOscillator();o.type='sine';o.frequency.value=f;
    const g=ctx.createGain();g.gain.value=0.13;o.connect(g);g.connect(lp);o.start();audio.nodes.push(o);});
  const lfo=ctx.createOscillator();lfo.type='sine';lfo.frequency.value=0.05;
  const lfoG=ctx.createGain();lfoG.gain.value=160;lfo.connect(lfoG);lfoG.connect(lp.frequency);lfo.start();audio.nodes.push(lfo);
  // soft wind (filtered noise)
  const n=ctx.sampleRate*2, buf=ctx.createBuffer(1,n,ctx.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  const noise=ctx.createBufferSource();noise.buffer=buf;noise.loop=true;
  const nf=ctx.createBiquadFilter();nf.type='bandpass';nf.frequency.value=480;nf.Q.value=0.6;
  const ng=ctx.createGain();ng.gain.value=0.03;audio.windGain=ng;
  noise.connect(nf);nf.connect(ng);ng.connect(master);noise.start();audio.nodes.push(noise);
}
function setAudio(on){
  initAudio(); if(!audio.ctx)return;
  if(audio.ctx.state==='suspended')audio.ctx.resume();
  S.audio=on; save();
  audio.master.gain.cancelScheduledValues(audio.ctx.currentTime);
  audio.master.gain.linearRampToValueAtTime(on?0.42:0, audio.ctx.currentTime+1.2);
  if(on)setAmbientForWeather();
}
function setAmbientForWeather(){
  if(!audio.ctx||!audio.windGain)return;
  const w=curWeather();
  const tgt=w==='storm'?0.12:w==='rain'?0.085:w==='fog'?0.055:w==='cloud'?0.042:0.028;
  audio.windGain.gain.linearRampToValueAtTime(tgt,audio.ctx.currentTime+2);
}
function maybeStartAudio(){ if(audio.started)return; audio.started=true; if(S.audio)setAudio(true); }
function toggleAudio(){ audio.started=true; setAudio(!S.audio); const b=$('#audbtn'); if(b)b.textContent=S.audio?'🔊 Ambient: ON':'🔇 Ambient: OFF'; }
/* ---- procedural SFX (Session 10) ---- */
function sfxTone(freq,dur,type,vol,slideTo){ if(!S.audio||!audio.ctx)return; const ctx=audio.ctx; if(ctx.state==='suspended')ctx.resume();
  const o=ctx.createOscillator(),g=ctx.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(freq,ctx.currentTime);
  if(slideTo)o.frequency.exponentialRampToValueAtTime(slideTo,ctx.currentTime+dur);
  g.gain.setValueAtTime(0.0008,ctx.currentTime); g.gain.linearRampToValueAtTime(vol||0.18,ctx.currentTime+0.012); g.gain.exponentialRampToValueAtTime(0.0006,ctx.currentTime+dur);
  o.connect(g); g.connect(audio.master||ctx.destination); o.start(); o.stop(ctx.currentTime+dur+0.03); }
function sfxArp(notes,type,vol,step){ notes.forEach((f,i)=>setTimeout(()=>sfxTone(f,0.2,type,vol),i*(step||80))); }
function sfx(kind){ if(!S.audio||!audio.ctx)return;
  switch(kind){
    case 'pickup': sfxTone(620,0.12,'sine',0.13,940); break;
    case 'hit': sfxTone(155,0.08,'square',0.12,95); break;
    case 'crit': sfxTone(880,0.14,'sawtooth',0.14,1340); break;
    case 'ui': sfxTone(460,0.05,'sine',0.08); break;
    case 'levelup': sfxArp([523,659,784,1047],'triangle',0.14,70); break;
    case 'victory': sfxArp([523,659,784,1047,1319],'triangle',0.16,95); break;
    case 'defeat': sfxArp([330,247,196],'sine',0.16,130); break;
    case 'quest': sfxArp([784,1047],'triangle',0.15,95); break;
    case 'summon': sfxTone(380,0.55,'sine',0.1,1700); break;
    case 'craft': sfxTone(190,0.12,'square',0.13,150); setTimeout(()=>sfxTone(680,0.1,'sine',0.1),95); break;
    case 'vision': sfxArp([523,784,1047,1568],'sine',0.1,180); break;
  } }
// biome ambient — tilt the drone's lowpass + wind toward each biome's character
const BIOME_AUDIO={ tundra:{lp:360,wind:0.07}, crystal:{lp:760,wind:0.04}, ember:{lp:300,wind:0.06},
  forest:{lp:480,wind:0.05}, mountain:{lp:560,wind:0.055}, lake:{lp:620,wind:0.05}, meadow:{lp:520,wind:0.03}, plains:{lp:540,wind:0.035}, town:{lp:540,wind:0.03} };
function setAmbientForBiome(b){ if(!audio.ctx||!audio.lp)return; const a=BIOME_AUDIO[b]||BIOME_AUDIO.meadow;
  audio.lp.frequency.cancelScheduledValues(audio.ctx.currentTime);
  audio.lp.frequency.linearRampToValueAtTime(a.lp,audio.ctx.currentTime+3);
  if(audio.windGain)audio.windGain.gain.linearRampToValueAtTime(a.wind,audio.ctx.currentTime+3); }

/* ===================================================================
   BOOT
   =================================================================== */
function applyIdle(){
  const now=Date.now();let sec=clamp((now-(S.lastSeen||now))/1000,0,12*3600);
  if(sec<30)return null;
  const tl=SKILLS.reduce((a,s)=>a+(s.res?skillLvl(s.id):0),0);
  const r={astral:(0.8+tl*0.05)*sec,ore:(0.4+tl*0.03)*sec,wood:(0.4+tl*0.03)*sec,shard:(0.04+tl*0.003)*sec+10};
  S.res.astral+=r.astral;S.res.ore+=r.ore;S.res.wood+=r.wood;S.res.shard+=r.shard;
  return {sec,r};
}
function welcome(){
  const idle=applyIdle();
  if(S.firstRun){
    S.firstRun=false;S.res.shard+=90;save();
    modal(`<h2 class="center" style="color:var(--gold)">Welcome, Starwarden</h2>
      <div class="card"><div class="muted" style="line-height:1.8">
      You wake on <b style="color:var(--teal)">Skyhaven</b>, a drifting isle among the shattered Verdant Stars.<br><br>
      🚶 <b>Tap the ground</b> to walk.<br>
      ⛏️ <b>Tap rocks, trees & plants</b> to gather.<br>
      🎣 <b>Tap shimmering pools</b> on the lake to fish.<br>
      👾 <b>Walk into Hollow monsters</b> (south) to battle.<br>
      ⚒️ <b>Craft</b> gear at the Forge, <b>equip</b> it in your Bag.<br>
      🌌 Here's <b>90 Starshards</b> to summon your first champions.</div></div>
      <button class="btn gold" onclick="closeModal();panelSummon()">Begin the Watch</button>`);
  } else if(idle){
    modal(`<h2 class="center">Welcome Back</h2><div class="card center"><div class="muted">While away (${fmtT(idle.sec)}) your isle gathered:</div>
      <div style="margin:10px 0;font-size:13px">+${fmt(idle.r.astral)}◈ &nbsp; +${fmt(idle.r.ore)}⛁ &nbsp; +${fmt(idle.r.wood)}🪵 &nbsp; +${fmt(idle.r.shard)}✦</div>
      <button class="btn gold" onclick="closeModal()">Collect</button></div>`);
  }
}
function fmtT(s){s=Math.floor(s);const h=s/3600|0,m=s%3600/60|0;return(h?h+'h ':'')+m+'m';}

// Expose functions used by inline HTML on* handlers. Since the game is now an
// ES module, these are module-scoped and otherwise invisible to inline onclick=.
Object.assign(window, {
  closeModal, cancelFishing, champDetail, claimReward, craft, doSummon, equip, unequip,
  hardReset, levelHero, panelCodex, panelChamps, panelQuests, panelSummon, sellMats, toggleAudio, toggleSquad, save,
  finishBattle, dlgChoose, panelLore,
});

if(!S.qs)S.qs={}; if(!S.flags)S.flags={};
visitBiome(S.px,S.py);   // record starting biome
checkUnlocks();          // offer starter quests
updateQuestTracker();
paintDock();
updateHUD();
welcome();
requestAnimationFrame(loop);
setInterval(save,15000);
window.addEventListener('beforeunload',save);

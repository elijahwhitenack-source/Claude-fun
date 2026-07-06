// ASTRARI — isometric ¾ top-down roguelike dungeon crawler (Three.js).
// Tiny safe hub → procedural dungeon floors. Joystick/WASD movement (no tap-to-move).
import * as THREE from 'three';

// ---------- renderer / scene ----------
const cv = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e141f);
scene.fog = new THREE.Fog(0x0e141f, 22, 48);

// isometric orthographic follow camera
let viewSize = 10;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const CAM_OFF = new THREE.Vector3(13, 16, 13);         // fixed ¾ iso angle
function setCamFrustum(){ const a = innerWidth / innerHeight;
  camera.left = -viewSize * a; camera.right = viewSize * a; camera.top = viewSize; camera.bottom = -viewSize;
  camera.updateProjectionMatrix(); }
// camera-relative ground axes (movement mapped to screen)
const FWD = new THREE.Vector3(-CAM_OFF.x, 0, -CAM_OFF.z).normalize();   // "up/away on screen"
const RIGHT = new THREE.Vector3(FWD.z, 0, -FWD.x).normalize();           // screen-right

// lighting
scene.add(new THREE.HemisphereLight(0x9fc0ff, 0x2a3040, 0.85));
const sun = new THREE.DirectionalLight(0xfff0d8, 0.95); sun.position.set(8, 18, 6); scene.add(sun);
scene.add(new THREE.AmbientLight(0x5a6a86, 0.35));

// ---------- materials ----------
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.95, ...o });
const MAT = {
  hubFloor: M(0x4c9d47), hubFloor2: M(0x428a3e), hubWall: M(0x6b6f7d), hubTrim: M(0xffce6a),
  dFloor: M(0x3a3550), dFloor2: M(0x322e47), dWall: M(0x4a4560), dWallTop: M(0x5a5570),
  stairs: M(0x7ad0ff, { emissive: 0x2a6a9a, emissiveIntensity: 0.5 }),
  chest: M(0x8a5a2a), chestLid: M(0xffce6a),
  heroSkin: M(0xf0d0a8), heroCloak: M(0x3a6f8a), heroTrim: M(0xffd479), heroHair: M(0x2a3a52),
  enemy: M(0x8a3bd4, { emissive: 0x3a1a6a, emissiveIntensity: 0.4 }), enemyEye: M(0x9be8ff, { emissive: 0x6fd0ff, emissiveIntensity: 1 }),
  portal: M(0x8a6cff, { emissive: 0x5a3bd4, emissiveIntensity: 0.9 }),
};
const box = new THREE.BoxGeometry(1, 1, 1);
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
function instanced(positions, mat, y, sy){
  const inst = new THREE.InstancedMesh(box, mat, Math.max(1, positions.length)); inst.frustumCulled = false;
  for (let i = 0; i < positions.length; i++){ _p.set(positions[i][0] + 0.5, y, positions[i][1] + 0.5); _s.set(1, sy, 1);
    _m.compose(_p, _q, _s); inst.setMatrixAt(i, _m); }
  inst.count = positions.length; inst.instanceMatrix.needsUpdate = true; return inst;
}

// ---------- hero ----------
const hero = { x: 0, z: 0, dir: 0, hp: 60, maxhp: 60, atk: 14, gold: 0, group: new THREE.Group() };
(function buildHero(){
  const g = hero.group;
  const legs = new THREE.Mesh(box, MAT.heroCloak); legs.scale.set(0.42, 0.42, 0.42); legs.position.y = 0.22; g.add(legs);
  const body = new THREE.Mesh(box, MAT.heroCloak); body.scale.set(0.52, 0.55, 0.4); body.position.y = 0.66; g.add(body);
  const trim = new THREE.Mesh(box, MAT.heroTrim); trim.scale.set(0.54, 0.12, 0.42); trim.position.y = 0.5; g.add(trim);
  const head = new THREE.Mesh(box, MAT.heroSkin); head.scale.set(0.42, 0.42, 0.42); head.position.y = 1.12; g.add(head);
  const hair = new THREE.Mesh(box, MAT.heroHair); hair.scale.set(0.46, 0.2, 0.46); hair.position.y = 1.32; g.add(hair);
  const nose = new THREE.Mesh(box, MAT.heroSkin); nose.scale.set(0.12, 0.12, 0.14); nose.position.set(0, 1.1, 0.24); g.add(nose);
  scene.add(g);
})();
const heroLight = new THREE.PointLight(0xffe6b0, 0.9, 12, 2); scene.add(heroLight);

// ---------- world state ----------
let grid = [], GW = 0, GH = 0, mode = 'hub', depth = 0;
let levelGroup = new THREE.Group(); scene.add(levelGroup);
let features = [];   // {type,gx,gz,mesh,...}
let enemies = [];    // {name,x,z,hp,maxhp,atk,mesh,alive}
const rng = (() => { let s = 20260604 >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();

function clearLevel(){
  scene.remove(levelGroup);
  levelGroup.traverse(o => { if (o.geometry && o.geometry !== box) o.geometry.dispose(); });
  levelGroup = new THREE.Group(); scene.add(levelGroup);
  for (const en of enemies) scene.remove(en.mesh);
  features = []; enemies = [];
}
function walkable(wx, wz){ const gx = Math.floor(wx), gz = Math.floor(wz);
  return gx >= 0 && gz >= 0 && gx < GW && gz < GH && grid[gz][gx] === 1; }

// ---------- HUB ----------
function buildHub(){
  clearLevel(); mode = 'hub'; depth = 0;
  GW = 22; GH = 22; grid = [];
  const floors = [], walls = [];
  for (let z = 0; z < GH; z++){ grid[z] = [];
    for (let x = 0; x < GW; x++){ const edge = x === 0 || z === 0 || x === GW - 1 || z === GH - 1;
      grid[z][x] = edge ? 0 : 1; (edge ? walls : floors).push([x, z]); } }
  levelGroup.add(instanced(floors.filter((_, i) => i % 2 === 0), MAT.hubFloor, -0.25, 0.5));
  levelGroup.add(instanced(floors.filter((_, i) => i % 2 === 1), MAT.hubFloor2, -0.25, 0.5));
  levelGroup.add(instanced(walls, MAT.hubWall, 1.0, 2.6));
  const hut = (gx, gz, col) => { const b = new THREE.Mesh(box, M(col)); b.scale.set(2.4, 2.2, 2.4); b.position.set(gx + 0.5, 1.1, gz + 0.5); levelGroup.add(b);
    const roof = new THREE.Mesh(box, MAT.hubTrim); roof.scale.set(2.9, 0.5, 2.9); roof.position.set(gx + 0.5, 2.35, gz + 0.5); levelGroup.add(roof);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) if (grid[gz + j]) grid[gz + j][gx + i] = 0; };
  hut(4, 4, 0x8a5a3a); hut(15, 4, 0x5a5a8a); hut(4, 15, 0x4a7a5a);
  const px = 15, pz = 15;
  const portal = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.28, 8, 20), MAT.portal); portal.position.set(px + 0.5, 1.2, pz + 0.5);
  levelGroup.add(portal); features.push({ type: 'portal', gx: px, gz: pz, mesh: portal });
  const pl = new THREE.PointLight(0x8a6cff, 1.4, 10, 2); pl.position.set(px + 0.5, 1.4, pz + 0.5); levelGroup.add(pl);
  hero.x = GW / 2; hero.z = GH / 2 + 3; hero.hp = hero.maxhp; updateHp();
  setFloorName('Skyhaven', 'the safe hub — no enemies'); syncCam(true);
}

// ---------- PROCEDURAL DUNGEON ----------
function genDungeon(d){
  clearLevel(); mode = 'dungeon'; depth = d;
  GW = 40; GH = 40; grid = [];
  for (let z = 0; z < GH; z++) grid[z] = new Array(GW).fill(0);
  const rooms = [], nRooms = 6 + Math.min(6, d);
  for (let i = 0; i < nRooms * 4 && rooms.length < nRooms; i++){
    const w = 5 + (rng() * 5 | 0), h = 5 + (rng() * 5 | 0);
    const x = 1 + (rng() * (GW - w - 2) | 0), z = 1 + (rng() * (GH - h - 2) | 0);
    if (rooms.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && z < r.z + r.h + 1 && z + h + 1 > r.z)) continue;
    rooms.push({ x, z, w, h, cx: x + (w >> 1), cz: z + (h >> 1) });
    for (let zz = z; zz < z + h; zz++) for (let xx = x; xx < x + w; xx++) grid[zz][xx] = 1;
  }
  const carveH = (x0, x1, z) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) grid[z][x] = 1; };
  const carveV = (z0, z1, x) => { for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) grid[z][x] = 1; };
  for (let i = 1; i < rooms.length; i++){ const a = rooms[i - 1], b = rooms[i];
    if (rng() < 0.5){ carveH(a.cx, b.cx, a.cz); carveV(a.cz, b.cz, b.cx); } else { carveV(a.cz, b.cz, a.cx); carveH(a.cx, b.cx, b.cz); } }
  const floors1 = [], floors2 = [], walls = [], wtops = [];
  for (let z = 0; z < GH; z++) for (let x = 0; x < GW; x++){
    if (grid[z][x] === 1){ ((x + z) & 1 ? floors2 : floors1).push([x, z]); }
    else { let adj = false; for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
        const nx = x + dx, nz = z + dz; if (nx >= 0 && nz >= 0 && nx < GW && nz < GH && grid[nz][nx] === 1){ adj = true; break; } }
      if (adj){ walls.push([x, z]); wtops.push([x, z]); } } }
  levelGroup.add(instanced(floors1, MAT.dFloor, -0.25, 0.5), instanced(floors2, MAT.dFloor2, -0.25, 0.5));
  levelGroup.add(instanced(walls, MAT.dWall, 1.0, 2.6), instanced(wtops, MAT.dWallTop, 2.35, 0.3));
  const first = rooms[0]; hero.x = first.cx + 0.5; hero.z = first.cz + 0.5;
  let far = rooms[rooms.length - 1] || first, best = -1;
  for (const r of rooms){ const dd = (r.cx - first.cx) ** 2 + (r.cz - first.cz) ** 2; if (dd > best){ best = dd; far = r; } }
  const st = new THREE.Mesh(box, MAT.stairs); st.scale.set(1.4, 0.5, 1.4); st.position.set(far.cx + 0.5, 0.1, far.cz + 0.5);
  levelGroup.add(st); features.push({ type: 'stairs', gx: far.cx, gz: far.cz, mesh: st });
  const sl = new THREE.PointLight(0x6fd0ff, 1.1, 9, 2); sl.position.set(far.cx + 0.5, 1.2, far.cz + 0.5); levelGroup.add(sl);
  if (rooms.length > 2){ const cr = rooms[1 + (rng() * (rooms.length - 2) | 0)];
    const ch = new THREE.Group(); const base = new THREE.Mesh(box, MAT.chest); base.scale.set(0.8, 0.55, 0.6); base.position.y = 0.28;
    const lid = new THREE.Mesh(box, MAT.chestLid); lid.scale.set(0.86, 0.25, 0.66); lid.position.y = 0.62; ch.add(base, lid);
    const gx = Math.min(GW - 2, cr.cx + 1), gz = cr.cz; ch.position.set(gx + 0.5, 0, gz + 0.5); levelGroup.add(ch);
    features.push({ type: 'chest', gx, gz, mesh: ch, opened: false }); }
  const eCount = 3 + Math.min(9, d + 1);
  for (let i = 0; i < eCount; i++){ const r = rooms[1 + (rng() * (rooms.length - 1) | 0)]; if (!r) break;
    spawnEnemy(r.x + 1 + rng() * (r.w - 2), r.z + 1 + rng() * (r.h - 2), d); }
  setFloorName('The Depths · Floor ' + d, rooms.length + ' chambers'); syncCam(true);
}
function spawnEnemy(x, z, d){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), MAT.enemy); body.position.y = 0.6; g.add(body);
  const e1 = new THREE.Mesh(box, MAT.enemyEye); e1.scale.set(0.12, 0.12, 0.12); e1.position.set(-0.16, 0.66, 0.4);
  const e2 = e1.clone(); e2.position.x = 0.16; g.add(e1, e2);
  g.position.set(x, 0, z); scene.add(g);
  const lvl = d + (rng() * 3 | 0);
  enemies.push({ name: ['Drifter', 'Mourner', 'Seeker', 'Wraith'][rng() * 4 | 0] + ' Lv' + lvl,
    x, z, hp: 26 + lvl * 10, maxhp: 26 + lvl * 10, atk: 6 + lvl * 3, gold: 5 + lvl * 4,
    mesh: g, body, alive: true, bob: rng() * 6 });
}

// ---------- input ----------
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyE') interact(); });
addEventListener('keyup', e => { keys[e.code] = false; });
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const move = { x: 0, z: 0 };
const stickEl = document.getElementById('stick'), knob = document.getElementById('knob'), ring = document.getElementById('ring');
let mt = null;
stickEl.addEventListener('touchstart', e => { const t = e.changedTouches[0]; mt = t.identifier;
  ring._ox = t.clientX; ring._oy = t.clientY; ring.style.left = knob.style.left = t.clientX + 'px'; ring.style.top = knob.style.top = t.clientY + 'px';
  ring.style.opacity = knob.style.opacity = '1'; e.preventDefault(); }, { passive: false });
stickEl.addEventListener('touchmove', e => { for (const t of e.changedTouches){ if (t.identifier !== mt) continue;
  let dx = t.clientX - ring._ox, dy = t.clientY - ring._oy; const d = Math.hypot(dx, dy), max = 48;
  if (d > max){ dx = dx / d * max; dy = dy / d * max; } knob.style.left = (ring._ox + dx) + 'px'; knob.style.top = (ring._oy + dy) + 'px';
  move.x = dx / max; move.z = -dy / max; } e.preventDefault(); }, { passive: false });
const endStick = e => { for (const t of e.changedTouches) if (t.identifier === mt){ mt = null; move.x = move.z = 0; knob.style.opacity = ring.style.opacity = '0'; } };
stickEl.addEventListener('touchend', endStick); stickEl.addEventListener('touchcancel', endStick);
document.getElementById('fab-act').addEventListener('touchstart', e => { e.preventDefault(); interact(); });

// ---------- movement + collision ----------
const R = 0.32, SPEED = 5.4;
function tryMove(nx, nz){
  if (walkable(nx - R, hero.z - R) && walkable(nx + R, hero.z - R) && walkable(nx - R, hero.z + R) && walkable(nx + R, hero.z + R)) hero.x = nx;
  if (walkable(hero.x - R, nz - R) && walkable(hero.x + R, nz - R) && walkable(hero.x - R, nz + R) && walkable(hero.x + R, nz + R)) hero.z = nz;
}
let state = 'play'; // play | battle | dead
function update(dt){
  if (state !== 'play') return;
  let ix = 0, iz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) iz += 1; if (keys['KeyS'] || keys['ArrowDown']) iz -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) ix += 1; if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
  if (isTouch){ ix += move.x; iz += move.z; }
  const len = Math.hypot(ix, iz);
  if (len > 0.06){ const nrm = Math.min(1, len); ix /= len; iz /= len;
    const wx = RIGHT.x * ix + FWD.x * iz, wz = RIGHT.z * ix + FWD.z * iz;
    tryMove(hero.x + wx * SPEED * dt * nrm, hero.z + wz * SPEED * dt * nrm);
    hero.dir = Math.atan2(wx, wz);
  }
  hero.group.rotation.y += (hero.dir - hero.group.rotation.y) * Math.min(1, dt * 14);
  hero.group.position.set(hero.x, len > 0.06 ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.08 : 0, hero.z);
  heroLight.position.set(hero.x, 2.2, hero.z);
  for (const en of enemies){ if (!en.alive) continue;
    en.bob += dt * 3; en.mesh.position.y = 0.05 + Math.abs(Math.sin(en.bob)) * 0.1; en.body.rotation.y += dt * 1.2;
    const dx = hero.x - en.x, dz = hero.z - en.z, dd = Math.hypot(dx, dz) || 1;
    if (dd < 8 && dd > 0.75){ const s = 2.6 * dt / dd; const ex = en.x + dx * s, ez = en.z + dz * s;
      if (walkable(ex, en.z)) en.x = ex; if (walkable(en.x, ez)) en.z = ez; en.mesh.position.x = en.x; en.mesh.position.z = en.z; }
    if (dd <= 0.78){ openBattle(en); break; }
  }
  updatePrompt();
}

// ---------- interact / prompt ----------
function nearFeature(){ for (const f of features){ if (f.opened) continue;
  if (Math.hypot(hero.x - (f.gx + 0.5), hero.z - (f.gz + 0.5)) < 1.4) return f; } return null; }
const promptEl = document.getElementById('prompt');
function updatePrompt(){ const f = nearFeature();
  if (f){ promptEl.textContent = f.type === 'portal' ? '✦ Descend into the Depths (E)' : f.type === 'stairs' ? '▼ Go deeper (E)' : '✦ Open chest (E)';
    promptEl.classList.add('show'); } else promptEl.classList.remove('show'); }
function interact(){ if (state !== 'play') return; const f = nearFeature(); if (!f) return;
  if (f.type === 'portal') fadeTo(() => genDungeon(1));
  else if (f.type === 'stairs') fadeTo(() => genDungeon(depth + 1));
  else if (f.type === 'chest'){ f.opened = true; f.mesh.children[1].position.y = 0.5; f.mesh.children[1].rotation.x = -0.8;
    const g = 20 + depth * 12 + (rng() * 30 | 0); hero.gold += g; save(); flashName('✦ +' + g + ' gold'); }
}

// ---------- battle (simple auto-resolve for now; full panel port later) ----------
let curEnemy = null;
const battleEl = document.getElementById('battle'), blogEl = document.getElementById('blog'), btitle = document.getElementById('btitle');
const bf = document.getElementById('bfight');
function openBattle(en){ if (state !== 'play') return; state = 'battle'; curEnemy = en;
  btitle.textContent = 'A ' + en.name + ' blocks your path'; blogEl.innerHTML = ''; bf.textContent = '⚔ Fight'; bf.disabled = false;
  bf.onclick = runBattle; battleEl.style.display = 'flex'; }
function log(s){ blogEl.innerHTML += s + '<br>'; blogEl.scrollTop = blogEl.scrollHeight; }
function runBattle(){ bf.disabled = true; const en = curEnemy;
  const step = () => {
    const dmg = Math.round(hero.atk * (0.85 + Math.random() * 0.3)); en.hp -= dmg;
    log(`You strike the ${en.name.split(' ')[0]} for <b style="color:#5ce6a4">${dmg}</b>.`);
    if (en.hp <= 0){ en.alive = false; scene.remove(en.mesh); hero.gold += en.gold; save();
      log(`<b style="color:#ffd479">The Hollow dissolves. +${en.gold} gold.</b>`);
      bf.textContent = 'Continue'; bf.disabled = false;
      bf.onclick = () => { battleEl.style.display = 'none'; state = 'play'; }; return; }
    const edmg = Math.round(en.atk * (0.85 + Math.random() * 0.3)); hero.hp = Math.max(0, hero.hp - edmg); updateHp();
    log(`${en.name.split(' ')[0]} hits you for <b style="color:#ff7a8a">${edmg}</b>.`);
    if (hero.hp <= 0){ log(`<b style="color:#ff8a8a">You are overwhelmed…</b>`); setTimeout(die, 700); return; }
    setTimeout(step, 520);
  };
  setTimeout(step, 220);
}
function die(){ state = 'dead'; battleEl.style.display = 'none'; document.getElementById('dead').style.display = 'flex'; }
document.getElementById('revive-btn').onclick = () => { document.getElementById('dead').style.display = 'none'; hero.hp = hero.maxhp; state = 'play'; fadeTo(() => buildHub()); };

// ---------- fade transition ----------
let fade = 0, fadeDir = 0, fadeCb = null;
const fadeEl = document.createElement('div');
fadeEl.style.cssText = 'position:fixed;inset:0;z-index:20;background:#05070d;opacity:0;pointer-events:none;';
document.body.appendChild(fadeEl);
function fadeTo(cb){ if (fadeDir) return; fadeDir = 1; fadeCb = cb; }
function updateFade(dt){ if (fadeDir === 1){ fade = Math.min(1, fade + dt * 3); fadeEl.style.opacity = fade;
    if (fade >= 1){ fadeCb && fadeCb(); fadeCb = null; fadeDir = -1; } }
  else if (fadeDir === -1){ fade = Math.max(0, fade - dt * 2.4); fadeEl.style.opacity = fade; if (fade <= 0) fadeDir = 0; } }

// ---------- camera ----------
function syncCam(snap){ const tx = hero.x, tz = hero.z; const desired = _p.set(tx + CAM_OFF.x, CAM_OFF.y, tz + CAM_OFF.z);
  if (snap) camera.position.copy(desired); else camera.position.lerp(desired, 0.12); camera.lookAt(tx, 0.6, tz); }

// ---------- HUD ----------
const hudEl = document.getElementById('hud'), hpfill = document.getElementById('hpfill'), floornameEl = document.getElementById('floorname');
function updateHud(){ hudEl.innerHTML = `<span class="gold">✦ ${hero.gold}</span> gold${mode === 'dungeon' ? ' · Floor ' + depth : ''}<br><span class="hp">❤ ${hero.hp}/${hero.maxhp}</span>`; }
function updateHp(){ hpfill.style.width = Math.max(0, hero.hp / hero.maxhp * 100) + '%'; updateHud(); }
let nameT = 0;
function setFloorName(a, b){ floornameEl.innerHTML = a + (b ? `<br><span style="font-size:11px;opacity:.8">${b}</span>` : ''); floornameEl.classList.add('show'); nameT = 2.6; }
function flashName(s){ floornameEl.innerHTML = s; floornameEl.classList.add('show'); nameT = 1.6; }

// ---------- save ----------
function save(){ try { localStorage.setItem('astrari3d', JSON.stringify({ gold: hero.gold })); } catch (e) {} updateHud(); }
try { const s = JSON.parse(localStorage.getItem('astrari3d') || '{}'); if (s.gold) hero.gold = s.gold; } catch (e) {}

// ---------- boot ----------
function resize(){ renderer.setSize(innerWidth, innerHeight); viewSize = Math.max(8, Math.min(12, innerHeight / 78)); setCamFrustum(); }
addEventListener('resize', resize); resize();
buildHub();
document.getElementById('start-btn').onclick = () => { document.getElementById('start').style.display = 'none';
  if (isTouch){ stickEl.style.display = 'block'; document.getElementById('fab-act').style.display = 'flex'; } };
if (isTouch) document.getElementById('start-sub').innerHTML = 'Move with the <b>left thumbstick</b>. Reach the glowing <b>portal</b> and tap <b>✦</b> to descend. Bump a Hollow to fight; find the <b>▼</b> stairs to go deeper.';

let last = performance.now();
function loop(){ const now = performance.now(); let dt = (now - last) / 1000; last = now; dt = Math.min(dt, 0.05);
  update(dt); updateFade(dt); syncCam(false);
  if (nameT > 0 && (nameT -= dt) <= 0) floornameEl.classList.remove('show');
  for (const f of features){ if (f.type === 'portal') f.mesh.rotation.z += dt * 0.8; else if (f.type === 'stairs') f.mesh.rotation.y += dt * 0.6; }
  renderer.render(scene, camera); requestAnimationFrame(loop);
}
loop();

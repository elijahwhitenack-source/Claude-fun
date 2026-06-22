// ASTRARI 3D — first-person voxel/low-poly world (Three.js).
// Fresh first-person build; the 2D game stays at index.html.
import * as THREE from 'three';

const cv = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const SKY = new THREE.Color(0x8ecaff);
renderer.setClearColor(SKY);

const scene = new THREE.Scene();
scene.background = SKY.clone();
scene.fog = new THREE.Fog(SKY.clone(), 38, 120);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 400);
// player rig: yawObject (Y rotation) holds the camera (which gets X pitch)
const yaw = new THREE.Object3D();
scene.add(yaw);
yaw.add(camera);
const EYE = 1.7;

// ---------- lighting ----------
const hemi = new THREE.HemisphereLight(0xbfe0ff, 0x4a6638, 0.95); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d4, 1.05); sun.position.set(0.5, 1, 0.3).multiplyScalar(60); scene.add(sun);
scene.add(new THREE.AmbientLight(0x6a7a90, 0.25));

// ---------- value noise ----------
function hash(x, z){ const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, z){
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, z){ return vnoise(x * 0.045, z * 0.045) * 9 + vnoise(x * 0.12, z * 0.12) * 3 + vnoise(x * 0.3, z * 0.3) * 1; }

// ---------- world ----------
const N = 72, HALF = N / 2, SEA = 2, BASE = -6;
const heights = [];           // top surface y per column (integer)
const biome = [];             // biome id per column
function genHeights(){
  for (let x = 0; x < N; x++){ heights[x] = []; biome[x] = [];
    for (let z = 0; z < N; z++){
      // island falloff so the map is a contained isle (smaller, focused world)
      const dx = (x - HALF) / HALF, dz = (z - HALF) / HALF;
      const edge = Math.max(0, 1 - (dx * dx + dz * dz) * 1.05);
      let h = fbm(x, z) * edge - (1 - edge) * 8;
      h = Math.round(h);
      heights[x][z] = h;
      biome[x][z] = h >= 7 ? 'snow' : h >= 5 ? 'stone' : h <= SEA ? 'sand' : h >= 4 ? 'forest' : 'meadow';
    }
  }
}
genHeights();

function colAt(wx, wz){ // grid col from world coords
  const gx = Math.round(wx + HALF), gz = Math.round(wz + HALF);
  if (gx < 0 || gz < 0 || gx >= N || gz >= N) return null;
  return [gx, gz];
}
function heightAt(wx, wz){ const c = colAt(wx, wz); return c ? heights[c[0]][c[1]] : BASE; }
function biomeAt(wx, wz){ const c = colAt(wx, wz); return c ? biome[c[0]][c[1]] : 'meadow'; }

// material palette (flat-shaded, low-poly)
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.96, ...o });
const PAL = {
  meadow: M(0x5cb450), meadow2: M(0x4c9d44), forest: M(0x2f7d40), stone: M(0x8b8e93),
  snow: M(0xeef5fc), sand: M(0xe4d49c), dirt: M(0x7a5a36),
};
const box = new THREE.BoxGeometry(1, 1, 1);
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

// build solid voxel columns as InstancedMesh per palette colour (cheap, few draw calls)
function buildTerrain(){
  const groups = {};
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++){
    const h = heights[x][z]; let key = biome[x][z];
    if (key === 'meadow') key = ((x + z) & 1) ? 'meadow' : 'meadow2';
    (groups[key] || (groups[key] = [])).push([x, z, h]);
  }
  for (const key in groups){
    const list = groups[key], inst = new THREE.InstancedMesh(box, PAL[key], list.length);
    inst.frustumCulled = false;
    for (let i = 0; i < list.length; i++){
      const [x, z, h] = list[i], colH = h - BASE;
      _p.set(x - HALF, (h + BASE) / 2 + 0.5, z - HALF);
      _s.set(1, colH, 1);
      _m.compose(_p, _q, _s); inst.setMatrixAt(i, _m);
    }
    inst.instanceMatrix.needsUpdate = true; scene.add(inst);
  }
}
buildTerrain();

// water plane
const water = new THREE.Mesh(new THREE.PlaneGeometry(N + 8, N + 8),
  new THREE.MeshStandardMaterial({ color: 0x2f7fd0, transparent: true, opacity: 0.82, roughness: 0.4, metalness: 0.1 }));
water.rotation.x = -Math.PI / 2; water.position.y = SEA + 0.55; scene.add(water);

// trees (blocky trunk + stacked leaf cubes)
const trunkMat = M(0x6b4a2a), leafMat = M(0x3f8f4a), leafMat2 = M(0x57b260);
const decor = new THREE.Group(); scene.add(decor);
const rng = (() => { let s = 1337; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
const crystals = [];
function placeDecor(){
  for (let i = 0; i < 90; i++){
    const x = 2 + (rng() * (N - 4) | 0), z = 2 + (rng() * (N - 4) | 0), h = heights[x][z], b = biome[x][z];
    if (b !== 'meadow' && b !== 'forest') continue;
    const wx = x - HALF, wz = z - HALF;
    const tr = new THREE.Mesh(box, trunkMat); tr.scale.set(0.5, 2.2, 0.5); tr.position.set(wx, h + 1.1, wz); decor.add(tr);
    const tiers = b === 'forest' ? 4 : 3;
    for (let k = 0; k < tiers; k++){ const lf = new THREE.Mesh(box, (k & 1) ? leafMat2 : leafMat);
      const sc = 2.5 - k * 0.5; lf.scale.set(sc, 1, sc); lf.position.set(wx, h + 2.4 + k * 0.85, wz); decor.add(lf); }
  }
  // celestial crystals (ASTRARI identity) — emissive, gently bobbing
  const crMat = new THREE.MeshStandardMaterial({ color: 0x8a6cff, emissive: 0x5a3bd4, emissiveIntensity: 0.7, flatShading: true, roughness: 0.3 });
  for (let i = 0; i < 10; i++){
    const x = 4 + (rng() * (N - 8) | 0), z = 4 + (rng() * (N - 8) | 0), h = heights[x][z];
    if (h <= SEA) continue;
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.85), crMat);
    cr.scale.y = 1.8; cr.position.set(x - HALF, h + 1.6, z - HALF); decor.add(cr); crystals.push(cr);
  }
}
placeDecor();

// clouds
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, transparent: true, opacity: 0.92 });
const clouds = new THREE.Group(); scene.add(clouds);
for (let i = 0; i < 9; i++){ const c = new THREE.Mesh(box, cloudMat);
  c.scale.set(4 + rng() * 6, 1.4, 3 + rng() * 4); c.position.set((rng() - 0.5) * 90, 22 + rng() * 8, (rng() - 0.5) * 90); clouds.add(c); }

// ---------- player ----------
const player = { x: 0, z: 0, y: 0, vy: 0, grounded: false, pitch: 0, bob: 0 };
// spawn at the lush meadow/forest column nearest the centre (inviting opening view)
(function spawn(){ let best = 1e9, bx = HALF, bz = HALF;
  for (let x = HALF - 14; x < HALF + 14; x++) for (let z = HALF - 14; z < HALF + 14; z++){
    const b = biome[x][z]; if ((b === 'meadow' || b === 'forest') && heights[x][z] > SEA){
      const d = (x - HALF) ** 2 + (z - HALF) ** 2; if (d < best){ best = d; bx = x; bz = z; } } }
  player.x = bx - HALF; player.z = bz - HALF; player.y = heights[bx][bz] + EYE;
})();
// place the rig at spawn immediately (so the world is visible before pointer-lock)
player.pitch = -0.26;
yaw.position.set(player.x, player.y, player.z);
camera.rotation.x = player.pitch;

// ---------- controls ----------
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });

const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
let locked = false;
const lockMsg = document.getElementById('lock-msg');
const SENS = 0.0024;

// desktop: pointer lock + mouse look
if (!isTouch){
  lockMsg.addEventListener('click', () => cv.requestPointerLock());
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === cv; lockMsg.style.display = locked ? 'none' : 'flex';
  });
  addEventListener('mousemove', e => { if (!locked) return;
    yaw.rotation.y -= e.movementX * SENS;
    player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * SENS));
  });
} else {
  // mobile: hide pointer-lock prompt, show touch controls
  document.getElementById('lock-sub').textContent = 'Left side to move · drag right side to look · ✦ to interact.';
  lockMsg.querySelector('.play').textContent = 'Begin';
  lockMsg.addEventListener('click', () => { lockMsg.style.display = 'none'; locked = true;
    document.getElementById('stick').style.display = 'block';
    document.querySelectorAll('.fab').forEach(f => f.style.display = 'flex'); });
}

// touch: left half = move stick, right half = look
const stickEl = document.getElementById('stick'), knob = document.getElementById('knob'), ring = document.getElementById('ring');
let moveTouch = null, moveVec = { x: 0, y: 0 }, lookTouch = null, lastLook = null;
function onTouchStart(e){
  for (const t of e.changedTouches){
    if (t.clientX < innerWidth * 0.46 && moveTouch === null){
      moveTouch = t.identifier; ring.style.left = knob.style.left = t.clientX + 'px';
      ring.style.top = knob.style.top = t.clientY + 'px'; ring.style.opacity = knob.style.opacity = '1'; ring._ox = t.clientX; ring._oy = t.clientY;
    } else if (t.clientX >= innerWidth * 0.46 && lookTouch === null){
      lookTouch = t.identifier; lastLook = { x: t.clientX, y: t.clientY };
    }
  }
}
function onTouchMove(e){
  for (const t of e.changedTouches){
    if (t.identifier === moveTouch){
      let dx = t.clientX - ring._ox, dy = t.clientY - ring._oy; const d = Math.hypot(dx, dy), max = 46;
      if (d > max){ dx = dx / d * max; dy = dy / d * max; }
      knob.style.left = (ring._ox + dx) + 'px'; knob.style.top = (ring._oy + dy) + 'px';
      moveVec.x = dx / max; moveVec.y = dy / max;
    } else if (t.identifier === lookTouch){
      yaw.rotation.y -= (t.clientX - lastLook.x) * 0.005;
      player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - (t.clientY - lastLook.y) * 0.005));
      lastLook = { x: t.clientX, y: t.clientY };
    }
  }
  e.preventDefault();
}
function onTouchEnd(e){
  for (const t of e.changedTouches){
    if (t.identifier === moveTouch){ moveTouch = null; moveVec.x = moveVec.y = 0; knob.style.opacity = ring.style.opacity = '0'; }
    if (t.identifier === lookTouch){ lookTouch = null; }
  }
}
cv.addEventListener('touchstart', onTouchStart, { passive: false });
cv.addEventListener('touchmove', onTouchMove, { passive: false });
cv.addEventListener('touchend', onTouchEnd);
cv.addEventListener('touchcancel', onTouchEnd);

let wantJump = false;
document.getElementById('fab-jump').addEventListener('touchstart', e => { e.preventDefault(); wantJump = true; });
document.getElementById('fab-act').addEventListener('touchstart', e => { e.preventDefault(); interact(); });

function interact(){ flashHud('✦ Nothing here yet — systems coming online…'); }

// ---------- movement + physics ----------
const SPEED = 6.2, JUMP = 7.6, GRAV = 22, MAXSTEP = 1.4;
function tryMove(nx, nz){
  // per-axis cliff blocking: can't step up more than MAXSTEP
  const footH = heightAt(player.x, player.z);
  if (Math.abs(nx - player.x) > 1e-4){ const h = heightAt(nx, player.z); if (h - footH <= MAXSTEP) player.x = nx; }
  if (Math.abs(nz - player.z) > 1e-4){ const h = heightAt(player.x, nz); if (h - footH <= MAXSTEP) player.z = nz; }
  const lim = HALF - 1.2; player.x = Math.max(-lim, Math.min(lim, player.x)); player.z = Math.max(-lim, Math.min(lim, player.z));
}
function update(dt){
  // movement input
  let mf = 0, ms = 0;
  if (keys['KeyW'] || keys['ArrowUp']) mf += 1; if (keys['KeyS'] || keys['ArrowDown']) mf -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) ms += 1; if (keys['KeyA'] || keys['ArrowLeft']) ms -= 1;
  if (isTouch){ mf += -moveVec.y; ms += moveVec.x; }
  const len = Math.hypot(mf, ms); if (len > 1){ mf /= len; ms /= len; }
  const yawA = yaw.rotation.y;
  const fx = -Math.sin(yawA), fz = -Math.cos(yawA), rx = Math.cos(yawA), rz = -Math.sin(yawA);
  const moving = len > 0.05;
  if (moving){ tryMove(player.x + (fx * mf + rx * ms) * SPEED * dt, player.z + (fz * mf + rz * ms) * SPEED * dt); }
  // gravity / jump
  const groundY = heightAt(player.x, player.z) + EYE;
  if ((keys['Space'] || wantJump) && player.grounded){ player.vy = JUMP; player.grounded = false; }
  wantJump = false;
  player.vy -= GRAV * dt; player.y += player.vy * dt;
  if (player.y <= groundY){ player.y = groundY; player.vy = 0; player.grounded = true; }
  // head-bob
  player.bob = moving && player.grounded ? Math.sin(performance.now() * 0.011) * 0.09 : player.bob * 0.85;
  // apply to rig
  yaw.position.set(player.x, player.y + player.bob, player.z);
  camera.rotation.x = player.pitch;
}

// ---------- HUD ----------
const hud = document.getElementById('hud'), biomeEl = document.getElementById('biome');
const BIOME_NAME = { meadow: 'Verdant Meadow', forest: 'Whispering Forest', stone: 'Skybound Peaks', snow: 'Frostpeak Tundra', sand: 'Aether Shore' };
let lastBiome = '', biomeT = 0, hudT = 0;
function flashHud(msg){ hud.dataset.msg = msg; hud._t = 2.2; }
function updateHud(dt){
  const b = biomeAt(player.x, player.z);
  if (b !== lastBiome){ lastBiome = b; biomeEl.textContent = BIOME_NAME[b] || b; biomeEl.classList.add('show'); biomeT = 2.4; }
  if (biomeT > 0 && (biomeT -= dt) <= 0) biomeEl.classList.remove('show');
  hudT += dt; if (hudT > 0.2){ hudT = 0;
    let s = `<b>ASTRARI 3D</b> · ${BIOME_NAME[b] || b}`;
    if (hud._t > 0){ hud._t -= 0.2; s += `<br>${hud.dataset.msg}`; }
    hud.innerHTML = s;
  }
}

// ---------- loop ----------
function resize(){ camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }
addEventListener('resize', resize); resize();

let last = performance.now();
document.getElementById('loading').style.display = 'none';
function loop(){
  const now = performance.now(); let dt = (now - last) / 1000; last = now; dt = Math.min(dt, 0.05);
  if (locked) update(dt);
  updateHud(dt);
  water.material.opacity = 0.74 + 0.08 * Math.sin(now * 0.001);
  for (const cr of crystals){ cr.rotation.y += dt * 0.8; cr.position.y += Math.sin(now * 0.002 + cr.position.x) * 0.004; }
  clouds.position.x = (now * 0.0008) % 20;
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

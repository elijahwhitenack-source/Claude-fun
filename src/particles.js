/* Pooled particle system — 500 pre-allocated particles, no per-frame allocation.
   World-space coordinates (pixels); drawn relative to the camera. */
const N = 500;
const P = new Array(N);
for (let i = 0; i < N; i++) P[i] = { a: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, col: '#fff', size: 2, g: 0, fade: 1 };
let head = 0;

export function spawnParticle(x, y, vx, vy, life, col, size, grav, fade) {
  const p = P[head]; head = (head + 1) % N;
  p.a = 1; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
  p.life = life; p.max = life; p.col = col; p.size = size; p.g = grav || 0; p.fade = fade == null ? 1 : fade;
}

export function updateParticles(dt) {
  for (let i = 0; i < N; i++) {
    const p = P[i]; if (!p.a) continue;
    p.life -= dt; if (p.life <= 0) { p.a = 0; continue; }
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}

// Draw active particles, batched by color to limit fillStyle changes.
export function drawParticles(ctx, camX, camY) {
  let anyActive = false;
  for (let i = 0; i < N; i++) if (P[i].a) { anyActive = true; break; }
  if (!anyActive) return;
  const groups = new Map();
  for (let i = 0; i < N; i++) {
    const p = P[i]; if (!p.a) continue;
    let arr = groups.get(p.col); if (!arr) { arr = []; groups.set(p.col, arr); }
    arr.push(p);
  }
  for (const [col, arr] of groups) {
    ctx.fillStyle = col;
    for (const p of arr) {
      const t = p.life / p.max;
      ctx.globalAlpha = p.fade ? Math.min(1, t * 1.6) : 1;
      const s = p.size * (0.4 + t * 0.6);
      ctx.fillRect(p.x - camX - s / 2, p.y - camY - s / 2, s, s);
    }
  }
  ctx.globalAlpha = 1;
}

// Convenience bursts ---------------------------------------------------------
const TAU = Math.PI * 2;

// upward spray (gathering)
export function burstSpray(x, y, col, count = 10) {
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const sp = 30 + Math.random() * 70;
    spawnParticle(x + (Math.random() - 0.5) * 8, y, Math.cos(ang) * sp, Math.sin(ang) * sp - 20,
      0.5 + Math.random() * 0.5, col, 2 + Math.random() * 2, 140);
  }
}

// radial pop (level-up, impacts)
export function burstRing(x, y, col, count = 14, speed = 90) {
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * TAU + Math.random() * 0.3;
    const sp = speed * (0.6 + Math.random() * 0.6);
    spawnParticle(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp, 0.6 + Math.random() * 0.4, col, 2 + Math.random() * 2, 30);
  }
}

// gentle rising motes (ambient sparkle, node respawn)
export function burstMotes(x, y, col, count = 6) {
  for (let i = 0; i < count; i++) {
    spawnParticle(x + (Math.random() - 0.5) * 16, y + (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 12, -10 - Math.random() * 20, 0.8 + Math.random() * 0.6, col, 1.5 + Math.random() * 1.5, -8);
  }
}

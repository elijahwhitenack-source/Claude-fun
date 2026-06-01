// One-off PWA icon generator: renders an ASTRARI emblem SVG to PNG at 192 & 512.
// Run: node scripts/make-icons.mjs  (requires sharp; not a build/runtime dependency)
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const SZ = 512, C = SZ / 2;

function starPath(cx, cy, points, outer, inner, rot = 0) {
  let d = '';
  for (let k = 0; k < points * 2; k++) {
    const ang = (Math.PI / points) * k - Math.PI / 2 + rot;
    const r = k % 2 === 0 ? outer : inner;
    d += (k === 0 ? 'M' : 'L') + (cx + Math.cos(ang) * r).toFixed(1) + ' ' + (cy + Math.sin(ang) * r).toFixed(1) + ' ';
  }
  return d + 'Z';
}

// deterministic starfield
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
let stars = '';
for (let i = 0; i < 70; i++) {
  stars += `<circle cx="${(rnd() * SZ).toFixed(1)}" cy="${(rnd() * SZ).toFixed(1)}" r="${(rnd() * 1.6 + 0.4).toFixed(2)}" fill="#cfe0ff" opacity="${(0.2 + rnd() * 0.5).toFixed(2)}"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SZ}" height="${SZ}" viewBox="0 0 ${SZ} ${SZ}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#15213f"/>
      <stop offset="55%" stop-color="#0a1124"/>
      <stop offset="100%" stop-color="#04060c"/>
    </radialGradient>
    <radialGradient id="core" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fffbe8"/>
      <stop offset="50%" stop-color="#ffe9a8"/>
      <stop offset="100%" stop-color="#ffd479" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="10" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${SZ}" height="${SZ}" rx="96" fill="url(#bg)"/>
  ${stars}
  <path d="${starPath(C, C, 4, SZ * 0.34, SZ * 0.075, Math.PI / 4)}" fill="#46e8c8" opacity="0.55"/>
  <path d="${starPath(C, C, 4, SZ * 0.40, SZ * 0.12)}" fill="#46e8c8" filter="url(#glow)"/>
  <path d="${starPath(C, C, 4, SZ * 0.248, SZ * 0.074)}" fill="#ffd479" filter="url(#glow)"/>
  <circle cx="${C}" cy="${C}" r="${SZ * 0.14}" fill="url(#core)"/>
</svg>`;

const buf = Buffer.from(svg);
for (const size of [192, 512]) {
  await sharp(buf).resize(size, size).png().toFile(`public/icon-${size}.png`);
  console.log('wrote public/icon-' + size + '.png');
}

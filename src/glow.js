/* Cached glow sprites — a fast replacement for ctx.shadowBlur (which is very
   expensive on mobile when set per-draw). Pre-renders a radial-gradient halo
   per color+radius and blits it. Colors must be 6-digit hex (e.g. '#9be8ff'). */
const cache = new Map();

export function glowSprite(col, radius) {
  radius = Math.max(2, Math.round(radius));
  const key = col + '|' + radius;
  let c = cache.get(key);
  if (c) return c;
  const size = radius * 4;
  c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, radius * 1.6);
  g.addColorStop(0, col);
  g.addColorStop(0.45, col + '80');
  g.addColorStop(1, col + '00');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  cache.set(key, c);
  return c;
}

// Blit a glow centered at (x,y). Optional alpha multiplies the current globalAlpha.
export function drawGlow(g, x, y, col, radius, alpha) {
  const s = glowSprite(col, radius);
  if (alpha != null) {
    const a = g.globalAlpha;
    g.globalAlpha = a * alpha;
    g.drawImage(s, x - s.width / 2, y - s.height / 2);
    g.globalAlpha = a;
  } else {
    g.drawImage(s, x - s.width / 2, y - s.height / 2);
  }
}

/* Pure utility helpers — no game state, safe to import anywhere. */
export const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const fmt=n=>{n=Math.floor(n);if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'k';return''+n;};
export const dist=(ax,ay,bx,by)=>Math.abs(ax-bx)+Math.abs(ay-by);
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function shade(col,amt){ // lighten/darken hex → rgb()
  const c=col.replace('#',''); let r=parseInt(c.substr(0,2),16),g=parseInt(c.substr(2,2),16),b=parseInt(c.substr(4,2),16);
  r=clamp(r+amt,0,255);g=clamp(g+amt,0,255);b=clamp(b+amt,0,255);
  return `rgb(${r|0},${g|0},${b|0})`;
}

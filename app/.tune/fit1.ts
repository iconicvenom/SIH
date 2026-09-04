import { createNoise2D } from 'simplex-noise';
import seedrandom from 'seedrandom';
import { MINES } from '/Users/vignesh/Projects/SIH/app/src/data/mines.ts';
import { lonLatToWorld } from '/Users/vignesh/Projects/SIH/app/src/lib/geo.ts';

const pts = MINES.map((m) => lonLatToWorld(m.lon, m.lat));
const n = pts.length;
const cx = pts.reduce((s, p) => s + p[0], 0) / n;
const cz = pts.reduce((s, p) => s + p[1], 0) / n;
let sxx = 0, szz = 0, sxz = 0;
for (const [x, z] of pts) { const dx = x - cx, dz = z - cz; sxx += dx*dx; szz += dz*dz; sxz += dx*dz; }
sxx/=n; szz/=n; sxz/=n;
const A = 0.5 * Math.atan2(2*sxz, sxx - szz);
const ca = Math.cos(A), sa = Math.sin(A);
const uv = pts.map(([x,z]) => { const dx=x-cx, dz=z-cz; return [dx*ca+dz*sa, -dx*sa+dz*ca] as [number,number]; });

const noise = createNoise2D(seedrandom('26009'));

function maxResidual(wave: number, p0: number, pAmp: number, pFreq: number, pSeedY: number) {
  let worst = 0;
  for (const [u, v] of uv) {
    const phase = p0 + pAmp * noise(u * pFreq, pSeedY);
    const psi = (v - phase) / wave;
    const vk = (psi - Math.round(psi)) * wave;
    worst = Math.max(worst, Math.abs(vk));
  }
  return worst;
}
function residuals(wave: number, p0: number, pAmp: number, pFreq: number, pSeedY: number) {
  return uv.map(([u, v], i) => {
    const phase = p0 + pAmp * noise(u * pFreq, pSeedY);
    const psi = (v - phase) / wave;
    const vk = (psi - Math.round(psi)) * wave;
    return `${MINES[i].id}:${vk.toFixed(1)}`;
  }).join(' ');
}

let best = { s: 1e9, wave: 0, p0: 0, pAmp: 0, pFreq: 0, pSeedY: 0 };
const rng = seedrandom('search');
for (let iter = 0; iter < 400000; iter++) {
  const wave = 55 + rng() * 90;
  const p0 = -60 + rng() * 120;
  const pAmp = rng() * 45;
  const pFreq = 0.0004 + rng() * 0.0030;
  const pSeedY = rng() * 100;
  const s = maxResidual(wave, p0, pAmp, pFreq, pSeedY);
  if (s < best.s) best = { s, wave, p0, pAmp, pFreq, pSeedY };
}
console.log('best max|vk| =', best.s.toFixed(2));
console.log(JSON.stringify(best, null, 0));
console.log(residuals(best.wave, best.p0, best.pAmp, best.pFreq, best.pSeedY));

import { generateSite, mineCellIndex } from '../src/data/generate.ts';
import { MINES } from '../src/data/mines.ts';
import { GRID, gridToWorld, lonLatToWorld, worldToGrid } from '../src/lib/geo.ts';
const site = generateSite();
const p = site.prospectivity;
const sorted = Float32Array.from(p).sort();
const pct=(v:number)=>{let lo=0,hi=sorted.length;while(lo<hi){const m=(lo+hi)>>1;if(sorted[m]<v)lo=m+1;else hi=m;}return (sorted.length-lo)/sorted.length;};
// probe the field along a depth column to separate amp from the depth envelope
for (let i=0;i<MINES.length;i++){
  const idx = mineCellIndex(i);
  const gx = idx % GRID, gz = (idx/GRID)|0;
  const [x,z]=gridToWorld(gx,gz);
  let best=0; for(let d=0;d<=240;d+=1){const q=site.probabilityAt(x,z,d); if(q>best)best=q;}
  console.log(`${MINES[i].id.padEnd(11)} p=${p[idx].toFixed(3)} maxOverDepth=${best.toFixed(3)} pct=${(pct(p[idx])*100).toFixed(2)}%`);
}
// distribution of p among top cells
let above=[0,0,0,0]; const th=[0.3,0.5,0.7,0.85];
for(let i=0;i<p.length;i++) th.forEach((t,k)=>{if(p[i]>t)above[k]++;});
console.log('cells >0.3/.5/.7/.85:',above.join('/'));
console.log('p at 95th pct:',sorted[Math.floor(sorted.length*0.95)].toFixed(3));

import { generateSite, mineCellIndex } from '../src/data/generate.ts';
import { MINES } from '../src/data/mines.ts';
import { GRID } from '../src/lib/geo.ts';
const site = generateSite();
const p = site.prospectivity;
const sorted = Float32Array.from(p).sort();
const pct = (v: number) => { let lo=0,hi=sorted.length; while(lo<hi){const m=(lo+hi)>>1; if(sorted[m]<v)lo=m+1;else hi=m;} return (sorted.length-lo)/sorted.length; };
let worst=0,wid='';
for (let i=0;i<MINES.length;i++){const q=pct(p[mineCellIndex(i)]); if(q>worst){worst=q;wid=MINES[i].id;}}
let hot=0; for(let i=0;i<p.length;i++) if(p[i]>0.6) hot++;
// texture: CV of prospectivity among in-belt cells, + fraction of in-belt cells that are gaps
const belt:number[]=[]; for(let i=0;i<p.length;i++) if(p[i]>0.12) belt.push(p[i]);
const bm = belt.reduce((s,v)=>s+v,0)/Math.max(1,belt.length);
const bsd = Math.sqrt(belt.reduce((s,v)=>s+(v-bm)**2,0)/Math.max(1,belt.length));
// ribbon-crossing roughness: along each raster row, count sign changes of the derivative in the belt
let flips=0,scanned=0;
for(let gz=0;gz<GRID;gz++){let prev=0;for(let gx=1;gx<GRID;gx++){const d=p[gz*GRID+gx]-p[gz*GRID+gx-1];if(Math.abs(d)>0.004){if(prev!==0&&Math.sign(d)!==prev)flips++;prev=Math.sign(d);scanned++;}}}
console.log(`WORST ${wid} ${(worst*100).toFixed(2)}% | hot=${hot} | beltCells=${belt.length} beltCV=${(bsd/bm).toFixed(3)} flips=${flips}`);

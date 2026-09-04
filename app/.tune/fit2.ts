import { createNoise2D, createNoise3D } from 'simplex-noise';
import seedrandom from 'seedrandom';
import { MINES } from '../src/data/mines.ts';
import { GRID, gridToWorld, lonLatToWorld, worldToGrid } from '../src/lib/geo.ts';

const pts = MINES.map((m) => lonLatToWorld(m.lon, m.lat));
const n = pts.length;
const cx = pts.reduce((s,p)=>s+p[0],0)/n, cz = pts.reduce((s,p)=>s+p[1],0)/n;
let sxx=0,szz=0,sxz=0;
for (const [x,z] of pts){const dx=x-cx,dz=z-cz;sxx+=dx*dx;szz+=dz*dz;sxz+=dx*dz;}
sxx/=n;szz/=n;sxz/=n;
const A=0.5*Math.atan2(2*sxz,sxx-szz); const ca=Math.cos(A), sa=Math.sin(A);

const rng = seedrandom('26009');
const n2a = createNoise2D(rng); // phase drift
const n2b = createNoise2D(rng); // along-strike modulation
const n2c = createNoise2D(rng); // pocket map (2D)
const n3 = createNoise3D(rng);  // pocket 3D

const WAVE=86.004, P0=-19.517, PAMP=22.496, PFREQ=0.0023216, PSEED=0.0103;

function measure(VK:number, VENV:number, ALONG_LO:number, PM_LO:number, PM_HI:number) {
  const p = new Float32Array(GRID*GRID);
  for (let gz=0; gz<GRID; gz++) for (let gx=0; gx<GRID; gx++) {
    const [x,z] = gridToWorld(gx,gz);
    const dx=x-cx, dz=z-cz;
    const u=dx*ca+dz*sa, v=-dx*sa+dz*ca;
    const phase = P0 + PAMP*n2a(u*PFREQ, PSEED);
    const psi=(v-phase)/WAVE; const vk=(psi-Math.round(psi))*WAVE;
    const keelF=Math.exp(-0.5*(vk/VK)**2);
    const envF=Math.exp(-0.5*(v/VENV)**2);
    const alongF=ALONG_LO+(1-ALONG_LO)*(0.5+0.5*n2b(u*0.0016, v*0.0006));
    const t=0.5+0.5*n2c(x*0.0075, z*0.0075);
    const s=Math.min(1,Math.max(0,(t-PM_LO)/(PM_HI-PM_LO)));
    const pocket=s*s*(3-2*s);
    p[gz*GRID+gx]=0.985*keelF*envF*alongF*(0.35+0.65*pocket);
  }
  const sorted=Float32Array.from(p).sort();
  const pct=(val:number)=>{ // fraction of cells >= val
    let lo=0,hi=sorted.length;
    while(lo<hi){const mid=(lo+hi)>>1; if(sorted[mid]<val)lo=mid+1;else hi=mid;}
    return (sorted.length-lo)/sorted.length;
  };
  let worst=0, worstId='';
  const rows:string[]=[];
  for (let i=0;i<n;i++){
    const [gx,gz]=worldToGrid(pts[i][0],pts[i][1]);
    const val=p[gz*GRID+gx]; const q=pct(val);
    rows.push(`${MINES[i].id}:${(q*100).toFixed(2)}%/${val.toFixed(3)}`);
    if(q>worst){worst=q;worstId=MINES[i].id;}
  }
  let hot=0; for(let i=0;i<p.length;i++) if(p[i]>0.6) hot++;
  return {worst, worstId, hot, rows, p};
}

for (const VK of [11,14,17,20]) for (const VENV of [110,140,170,210]) {
  const r = measure(VK, VENV, 0.55, 0.25, 0.72);
  console.log(`VK=${VK} VENV=${VENV}  worst=${(r.worst*100).toFixed(2)}% (${r.worstId})  hot=${r.hot}`);
}
console.log();
const r = measure(14,170,0.55,0.25,0.72);
console.log(r.rows.join('\n'));

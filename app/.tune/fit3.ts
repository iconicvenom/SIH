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
const WAVE=86.004, P0=-19.517, PAMP=22.496, PFREQ=0.0023216, PSEED=0.0103;

const rng = seedrandom('26009');
const nPhase = createNoise2D(rng);
const nAlong = createNoise2D(rng);
const nWarp  = createNoise2D(rng);
const nPocket = createNoise3D(rng);

function build(opts:{VK:number;VENV:number;alongLo:number;pockLo:number;pockHi:number;pockFloor:number;usePocket:boolean;pxy:number;pd:number}) {
  const p = new Float32Array(GRID*GRID);
  const DSTEP = 5;
  for (let gz=0; gz<GRID; gz++) for (let gx=0; gx<GRID; gx++) {
    const [x,z]=gridToWorld(gx,gz);
    const dx=x-cx, dz=z-cz;
    const u=dx*ca+dz*sa, v=-dx*sa+dz*ca;
    const phase=P0+PAMP*nPhase(u*PFREQ,PSEED);
    const psi=(v-phase)/WAVE; const vk=(psi-Math.round(psi))*WAVE;
    const keelF=Math.exp(-0.5*(vk/opts.VK)**2);
    const envF=Math.exp(-0.5*(v/opts.VENV)**2);
    const alongF=opts.alongLo+(1-opts.alongLo)*(0.5+0.5*nAlong(u*0.0016,v*0.0006));
    const amp=0.985*keelF*envF*alongF;
    // horizon
    const h0=110 + 0.28*u + 0.0028*vk*vk*4 + 26*nWarp(u*0.0012, v*0.0026);
    const horizon=Math.min(240,Math.max(0,h0));
    const T=26+30*Math.exp(-0.5*(vk/40)**2);
    let best=0;
    for (let d=0; d<=240; d+=DSTEP) {
      const dist=d-horizon;
      const g=Math.exp(-0.5*(dist/T)**2);
      const band=0.55+0.45*Math.abs(Math.sin(dist*0.22));
      let pk=1;
      if (opts.usePocket) {
        const t=0.5+0.5*nPocket(x*opts.pxy, z*opts.pxy, d*opts.pd);
        const s=Math.min(1,Math.max(0,(t-opts.pockLo)/(opts.pockHi-opts.pockLo)));
        pk=opts.pockFloor+(1-opts.pockFloor)*(s*s*(3-2*s));
      }
      const val=amp*g*band*pk;
      if (val>best) best=val;
    }
    p[gz*GRID+gx]=best;
  }
  return p;
}

function report(label:string, p:Float32Array){
  const sorted=Float32Array.from(p).sort();
  const pct=(val:number)=>{let lo=0,hi=sorted.length;while(lo<hi){const m=(lo+hi)>>1;if(sorted[m]<val)lo=m+1;else hi=m;}return (sorted.length-lo)/sorted.length;};
  let worst=0,wid='';const rows:string[]=[];
  for(let i=0;i<n;i++){const [gx,gz]=worldToGrid(pts[i][0],pts[i][1]);const val=p[gz*GRID+gx];const q=pct(val);rows.push(`${MINES[i].id}:${(q*100).toFixed(2)}%`);if(q>worst){worst=q;wid=MINES[i].id;}}
  let hot=0;for(let i=0;i<p.length;i++)if(p[i]>0.6)hot++;
  let mx=0;for(let i=0;i<p.length;i++)if(p[i]>mx)mx=p[i];
  console.log(`${label}  worst=${(worst*100).toFixed(2)}% (${wid}) hot=${hot} max=${mx.toFixed(3)}`);
  console.log('   ', rows.join(' '));
}

report('struct-only VK=14 VENV=170', build({VK:14,VENV:170,alongLo:1,pockLo:0,pockHi:1,pockFloor:1,usePocket:false,pxy:0,pd:0}));
report('struct-only VK=11 VENV=140', build({VK:11,VENV:140,alongLo:1,pockLo:0,pockHi:1,pockFloor:1,usePocket:false,pxy:0,pd:0}));
report('+along .70   VK=14 VENV=170', build({VK:14,VENV:170,alongLo:0.70,pockLo:0,pockHi:1,pockFloor:1,usePocket:false,pxy:0,pd:0}));
report('+pocket3D    VK=14 VENV=170', build({VK:14,VENV:170,alongLo:0.70,pockLo:0.30,pockHi:0.70,pockFloor:0.15,usePocket:true,pxy:0.010,pd:0.020}));

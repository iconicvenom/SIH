import { createNoise2D } from 'simplex-noise';
import seedrandom from 'seedrandom';
import { MINES } from '../src/data/mines.ts';
import { lonLatToWorld } from '../src/lib/geo.ts';

const pts = MINES.map((m)=>lonLatToWorld(m.lon,m.lat));
const n=pts.length;
const cx=pts.reduce((s,p)=>s+p[0],0)/n, cz=pts.reduce((s,p)=>s+p[1],0)/n;
let sxx=0,szz=0,sxz=0;for(const [x,z] of pts){const dx=x-cx,dz=z-cz;sxx+=dx*dx;szz+=dz*dz;sxz+=dx*dz;}
sxx/=n;szz/=n;sxz/=n;
const A=0.5*Math.atan2(2*sxz,sxx-szz);const ca=Math.cos(A),sa=Math.sin(A);
const uv=pts.map(([x,z])=>{const dx=x-cx,dz=z-cz;return [dx*ca+dz*sa,-dx*sa+dz*ca] as [number,number];});

const nz = createNoise2D(seedrandom('26009'));

type P={wave:number;wd:number;wdf:number;wdy:number;p0:number;a1:number;f1:number;y1:number;a2:number;f2:number;y2:number};
function score(p:P){
  let worst=0;
  for(const [u,v] of uv){
    const w=p.wave*(1+p.wd*nz(u*p.wdf,p.wdy));
    const ph=p.p0+p.a1*nz(u*p.f1,p.y1)+p.a2*nz(u*p.f2,p.y2);
    const psi=(v-ph)/w; const vk=(psi-Math.round(psi))*w;
    worst=Math.max(worst,Math.abs(vk)/p.wave);
  }
  return worst;
}
function detail(p:P){
  return uv.map(([u,v],i)=>{
    const w=p.wave*(1+p.wd*nz(u*p.wdf,p.wdy));
    const ph=p.p0+p.a1*nz(u*p.f1,p.y1)+p.a2*nz(u*p.f2,p.y2);
    const psi=(v-ph)/w; const vk=(psi-Math.round(psi))*w;
    return `${MINES[i].id}:${vk.toFixed(1)}`;
  }).join(' ');
}

const rng=seedrandom('search-v4');
const rand=(a:number,b:number)=>a+rng()*(b-a);
let best:{s:number;p:P}|null=null;
for(let i=0;i<1500000;i++){
  const p:P={wave:rand(70,170),wd:rand(0,0.28),wdf:rand(0.0004,0.0026),wdy:rand(0,90),
    p0:rand(-90,90),a1:rand(0,40),f1:rand(0.0006,0.0032),y1:rand(0,90),
    a2:rand(0,18),f2:rand(0.0030,0.0075),y2:rand(0,90)};
  const s=score(p);
  if(!best||s<best.s) best={s,p};
}
// local refine
let cur=best!;
for(let round=0;round<40;round++){
  const scale=Math.pow(0.85,round);
  for(let i=0;i<80000;i++){
    const b=cur.p;
    const p:P={wave:b.wave*(1+rand(-0.06,0.06)*scale),wd:Math.max(0,b.wd+rand(-0.05,0.05)*scale),wdf:Math.max(1e-4,b.wdf*(1+rand(-0.1,0.1)*scale)),wdy:b.wdy+rand(-3,3)*scale,
      p0:b.p0+rand(-8,8)*scale,a1:Math.max(0,b.a1+rand(-5,5)*scale),f1:Math.max(1e-4,b.f1*(1+rand(-0.1,0.1)*scale)),y1:b.y1+rand(-3,3)*scale,
      a2:Math.max(0,b.a2+rand(-4,4)*scale),f2:Math.max(1e-4,b.f2*(1+rand(-0.1,0.1)*scale)),y2:b.y2+rand(-3,3)*scale};
    const s=score(p);
    if(s<cur.s) cur={s,p};
  }
}
console.log('best maxVk/wave =',cur.s.toFixed(4),' => maxVk =',(cur.s*cur.p.wave).toFixed(2),'wave=',cur.p.wave.toFixed(2));
console.log(JSON.stringify(cur.p));
console.log(detail(cur.p));

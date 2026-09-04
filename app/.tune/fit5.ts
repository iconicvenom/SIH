import { createNoise2D } from 'simplex-noise';
import seedrandom from 'seedrandom';
import { MINES } from '../src/data/mines.ts';
import { lonLatToWorld } from '../src/lib/geo.ts';

const pts=MINES.map(m=>lonLatToWorld(m.lon,m.lat));const n=pts.length;
const cx=pts.reduce((s,p)=>s+p[0],0)/n,cz=pts.reduce((s,p)=>s+p[1],0)/n;
let sxx=0,szz=0,sxz=0;for(const[x,z]of pts){const dx=x-cx,dz=z-cz;sxx+=dx*dx;szz+=dz*dz;sxz+=dx*dz;}
sxx/=n;szz/=n;sxz/=n;const A=0.5*Math.atan2(2*sxz,sxx-szz);const ca=Math.cos(A),sa=Math.sin(A);
const uv=pts.map(([x,z])=>{const dx=x-cx,dz=z-cz;return[dx*ca+dz*sa,-dx*sa+dz*ca] as [number,number];});
const nz=createNoise2D(seedrandom('26009'));

function mk(nOct:number){
  return (v:number[])=>{
    const wave=v[0], p0=v[1];
    let worst=0;
    for(const[u,vv]of uv){
      let ph=p0;
      for(let o=0;o<nOct;o++) ph+=v[2+o*3]*nz(u*v[3+o*3],v[4+o*3]);
      const psi=(vv-ph)/wave;const vk=(psi-Math.round(psi))*wave;
      worst=Math.max(worst,Math.abs(vk)/wave);
    }
    return worst;
  };
}
function search(nOct:number,iters:number,tag:string){
  const f=mk(nOct);
  const dim=2+nOct*3;
  const rng=seedrandom('s'+nOct);
  const rand=(a:number,b:number)=>a+rng()*(b-a);
  const sample=()=>{const v=[rand(70,175),rand(-95,95)];for(let o=0;o<nOct;o++){v.push(rand(0,42-o*12),rand(0.0006+o*0.002,0.0032+o*0.004),rand(0,90));}return v;};
  let best={s:1e9,v:sample()};
  for(let i=0;i<iters;i++){const v=sample();const s=f(v);if(s<best.s)best={s,v};}
  for(let r=0;r<50;r++){const sc=Math.pow(0.86,r);
    for(let i=0;i<60000;i++){
      const v=best.v.slice();
      for(let d=0;d<dim;d++){const mag=(d===0?6:d===1?9:(d%3===2?5:d%3===0?v[d]*0.12:3))*sc;v[d]+= (rng()*2-1)*mag;}
      v[0]=Math.max(50,v[0]);
      const s=f(v);if(s<best.s)best={s,v};
    }}
  console.log(`${tag} oct=${nOct} params=${dim}: maxVk/wave=${best.s.toFixed(4)} wave=${best.v[0].toFixed(2)} maxVk=${(best.s*best.v[0]).toFixed(2)}`);
  console.log('  ',JSON.stringify(best.v.map(x=>+x.toPrecision(7))));
  return best;
}
search(1,600000,'A');
search(2,900000,'B');

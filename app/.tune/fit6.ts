import { createNoise2D } from 'simplex-noise';
import seedrandom from 'seedrandom';
import { MINES } from '../src/data/mines.ts';
import { gridToWorld, lonLatToWorld, worldToGrid } from '../src/lib/geo.ts';

const pts=MINES.map(m=>lonLatToWorld(m.lon,m.lat));const n=pts.length;
const cx=pts.reduce((s,p)=>s+p[0],0)/n,cz=pts.reduce((s,p)=>s+p[1],0)/n;
let sxx=0,szz=0,sxz=0;for(const[x,z]of pts){const dx=x-cx,dz=z-cz;sxx+=dx*dx;szz+=dz*dz;sxz+=dx*dz;}
sxx/=n;szz/=n;sxz/=n;const A=0.5*Math.atan2(2*sxz,sxx-szz);const ca=Math.cos(A),sa=Math.sin(A);
// sample points = raster cell sample points for each mine
const samp=pts.map(([x,z])=>{const [gx,gz]=worldToGrid(x,z);return gridToWorld(gx,gz);});
const uv=samp.map(([x,z])=>{const dx=x-cx,dz=z-cz;return[dx*ca+dz*sa,-dx*sa+dz*ca] as [number,number];});
console.log('cell-centre v:', uv.map(([,v])=>v.toFixed(1)).join(' '));
const nz=createNoise2D(seedrandom('26009'));

// phase model: 2 octaves
function score(v:number[]){
  const wave=v[0];let worst=0;
  for(const[u,vv]of uv){
    const ph=v[1]+v[2]*nz(u*v[3],v[4])+v[5]*nz(u*v[6],v[7]);
    const psi=(vv-ph)/wave;const vk=(psi-Math.round(psi))*wave;
    worst=Math.max(worst,Math.abs(vk)/wave);
  }
  return worst;
}
const rng=seedrandom('fit6');
const rand=(a:number,b:number)=>a+rng()*(b-a);
const sample=()=>[rand(75,165),rand(-95,95),rand(0,42),rand(0.0006,0.0034),rand(0,90),rand(0,20),rand(0.0032,0.0080),rand(0,90)];
let best={s:1e9,v:sample()};
for(let i=0;i<2000000;i++){const v=sample();const s=score(v);if(s<best.s)best={s,v};}
for(let r=0;r<60;r++){const sc=Math.pow(0.88,r);
  for(let i=0;i<80000;i++){
    const v=best.v.slice();
    v[0]+=(rng()*2-1)*7*sc; v[1]+=(rng()*2-1)*10*sc;
    v[2]=Math.max(0,v[2]+(rng()*2-1)*6*sc); v[3]=Math.max(1e-4,v[3]*(1+(rng()*2-1)*0.12*sc)); v[4]+=(rng()*2-1)*4*sc;
    v[5]=Math.max(0,v[5]+(rng()*2-1)*4*sc); v[6]=Math.max(1e-4,v[6]*(1+(rng()*2-1)*0.12*sc)); v[7]+=(rng()*2-1)*4*sc;
    v[0]=Math.max(60,v[0]);
    const s=score(v);if(s<best.s)best={s,v};
  }}
console.log('maxVk/wave=',best.s.toFixed(5),'wave=',best.v[0].toFixed(3),'maxVk=',(best.s*best.v[0]).toFixed(2));
const rounded=best.v.map(x=>+x.toPrecision(8));
console.log('rounded score=',score(rounded).toFixed(5));
console.log(JSON.stringify(rounded));
const wave=rounded[0];
console.log(uv.map(([u,vv],i)=>{const ph=rounded[1]+rounded[2]*nz(u*rounded[3],rounded[4])+rounded[5]*nz(u*rounded[6],rounded[7]);const psi=(vv-ph)/wave;const vk=(psi-Math.round(psi))*wave;return `${MINES[i].id}:${vk.toFixed(2)}/k${Math.round(psi)}`;}).join(' '));

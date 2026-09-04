import { createNoise2D } from 'simplex-noise';
import seedrandom from 'seedrandom';
import { MINES } from '../src/data/mines.ts';
import { gridToWorld, lonLatToWorld, worldToGrid } from '../src/lib/geo.ts';

const pts=MINES.map(m=>lonLatToWorld(m.lon,m.lat));const n=pts.length;
const cx=pts.reduce((s,p)=>s+p[0],0)/n,cz=pts.reduce((s,p)=>s+p[1],0)/n;
let sxx=0,szz=0,sxz=0;for(const[x,z]of pts){const dx=x-cx,dz=z-cz;sxx+=dx*dx;szz+=dz*dz;sxz+=dx*dz;}
sxx/=n;szz/=n;sxz/=n;const A=0.5*Math.atan2(2*sxz,sxx-szz);const ca=Math.cos(A),sa=Math.sin(A);
const samp=pts.map(([x,z])=>{const[gx,gz]=worldToGrid(x,z);return gridToWorld(gx,gz);});
const uv=samp.map(([x,z])=>{const dx=x-cx,dz=z-cz;return[dx*ca+dz*sa,-dx*sa+dz*ca] as [number,number];});
const nz=createNoise2D(seedrandom('26009'));

// v = [wave, wdAmp, wdFreq, wdY, bias, a1,f1,y1, a2,f2,y2]
function ratio(v:number[]){
  let worst=0;
  for(const[u,vv]of uv){
    const w=v[0]*(1+v[1]*nz(u*v[2],v[3]));
    const ph=v[4]+v[5]*nz(u*v[6],v[7])+v[8]*nz(u*v[9],v[10]);
    const psi=(vv-ph)/w;const vk=(psi-Math.round(psi))*w;
    worst=Math.max(worst,Math.abs(vk)/v[0]);
  }
  return worst;
}
function run(tag:string, waveLo:number, waveHi:number, seed:string, iters:number){
  const rng=seedrandom(seed); const rand=(a:number,b:number)=>a+rng()*(b-a);
  const samp1=()=>[rand(waveLo,waveHi),rand(0,0.22),rand(0.0005,0.0026),rand(0,90),rand(-95,95),
                   rand(0,40),rand(0.0006,0.0032),rand(0,90),rand(0,18),rand(0.0030,0.0075),rand(0,90)];
  let best={s:1e9,v:samp1()};
  for(let i=0;i<iters;i++){const v=samp1();const s=ratio(v);if(s<best.s)best={s,v};}
  for(let r=0;r<70;r++){const sc=Math.pow(0.9,r);
    for(let i=0;i<70000;i++){
      const v=best.v.slice();
      v[0]=Math.max(waveLo,Math.min(waveHi,v[0]+(rng()*2-1)*6*sc));
      v[1]=Math.max(0,Math.min(0.25,v[1]+(rng()*2-1)*0.05*sc));
      v[2]=Math.max(1e-4,v[2]*(1+(rng()*2-1)*0.12*sc)); v[3]+=(rng()*2-1)*3*sc;
      v[4]+=(rng()*2-1)*9*sc;
      v[5]=Math.max(0,v[5]+(rng()*2-1)*5*sc); v[6]=Math.max(1e-4,v[6]*(1+(rng()*2-1)*0.12*sc)); v[7]+=(rng()*2-1)*3*sc;
      v[8]=Math.max(0,v[8]+(rng()*2-1)*4*sc); v[9]=Math.max(1e-4,v[9]*(1+(rng()*2-1)*0.12*sc)); v[10]+=(rng()*2-1)*3*sc;
      const s=ratio(v);if(s<best.s)best={s,v};
    }}
  const rounded=best.v.map(x=>+x.toPrecision(8));
  console.log(`${tag} wave[${waveLo},${waveHi}] ratio=${best.s.toFixed(5)} rounded=${ratio(rounded).toFixed(5)} wave=${rounded[0].toFixed(2)} maxVk=${(best.s*rounded[0]).toFixed(2)}`);
  console.log('   ',JSON.stringify(rounded));
  return {s:ratio(rounded),v:rounded};
}
const cands=[run('C1',80,110,'c1',900000), run('C2',110,150,'c2',900000), run('C3',150,200,'c3',900000), run('C4',60,200,'c4',1200000)];
const best=cands.reduce((a,b)=>a.s<b.s?a:b);
console.log('\nBEST ratio', best.s.toFixed(5));
console.log(JSON.stringify(best.v));
const w0=best.v[0];
console.log(uv.map(([u,vv],i)=>{
  const w=w0*(1+best.v[1]*nz(u*best.v[2],best.v[3]));
  const ph=best.v[4]+best.v[5]*nz(u*best.v[6],best.v[7])+best.v[8]*nz(u*best.v[9],best.v[10]);
  const psi=(vv-ph)/w;const vk=(psi-Math.round(psi))*w;
  return `${MINES[i].id}:${vk.toFixed(2)}/k${Math.round(psi)}`;}).join(' '));

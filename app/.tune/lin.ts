import { generateSite } from '../src/data/generate.ts';
import { GRID, worldToGrid, WORLD_SIZE } from '../src/lib/geo.ts';
const site = generateSite();
const p = site.prospectivity;
let gm=0; for(let i=0;i<p.length;i++) gm+=p[i]; gm/=p.length;
let sum=0,n=0;
const angs:number[]=[];
const axis = site.foldAxisAngleDeg;
for(const l of site.lineaments){
  for(const [x,z] of l.points){const [gx,gz]=worldToGrid(x,z);sum+=p[gz*GRID+gx];n++;}
  for(let i=1;i<l.points.length;i++){
    const dx=l.points[i][0]-l.points[i-1][0], dz=l.points[i][1]-l.points[i-1][1];
    let a=Math.atan2(dz,dx)*180/Math.PI;
    let d=a-axis; while(d>90)d-=180; while(d<-90)d+=180;
    angs.push(d);
  }
}
console.log('lineaments:',site.lineaments.length,'vertices:',n);
console.log('mean p on lineaments:',(sum/n).toFixed(4),' global mean p:',gm.toFixed(4),' lift x',(sum/n/gm).toFixed(2));
console.log('max |segment - axis| deg:',Math.max(...angs.map(Math.abs)).toFixed(1),'(limit 25)');
console.log('half world', WORLD_SIZE/2);
// SHAP variety
const cells:[number,number][]=[[199,207],[60,60],[150,80]];
for(const [gx,gz] of cells){
  const s=site.shapAt(gx,gz);
  console.log(`cell ${gx},${gz} top5:`, s.slice(0,5).map(c=>`${c.feature}=${c.value.toFixed(2)}`).join(' '), '| n=',s.length,'| negatives=',s.filter(c=>c.value<0).length);
}

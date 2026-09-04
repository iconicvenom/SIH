import { generateSite } from '../src/data/generate.ts';
import { computeSuccessCurve, computeRocAuc, computePrAuc, computeRiskRows } from '../src/lib/stats.ts';
const site = generateSite();
console.log('ROC AUC :', computeRocAuc(site).toFixed(4));
console.log('PR  AUC :', computePrAuc(site).toFixed(4), ' baseline =', (11/65536).toExponential(2));
const c = computeSuccessCurve(site);
console.log('curve pts', c.length, 'first/last', JSON.stringify(c[0]), JSON.stringify(c[c.length-1]));
for (const f of [0.01,0.02,0.05,0.10,0.20]) {
  const pt = c.reduce((best,p)=> Math.abs(p.areaFraction-f)<Math.abs(best.areaFraction-f)?p:best, c[0]);
  console.log(`  top ${(f*100).toFixed(0)}% area -> ${(pt.depositFraction*100).toFixed(1)}% of mines (at ${(pt.areaFraction*100).toFixed(2)}%)`);
}
console.log('\nRISK ROWS');
for (const r of computeRiskRows(site)) {
  console.log(`${r.risk.padEnd(5)} ${r.name.padEnd(20)} p=${r.shortfallProb.toFixed(3)} short=${r.magnitudeTonnes}t spark=${r.sparkline.length}`);
}
const bal = site.production.find(p=>p.mineId==='balaghat')!;
console.log('\nBalaghat forecast (h, plan, P50, P90):');
bal.series.slice(108,120).forEach((pt,h)=>console.log(`  h=${h} plan=${pt.plan} p50=${pt.forecastP50} p90=${pt.forecastP90} ${pt.forecastP90!<pt.plan?'MISS':''}`));

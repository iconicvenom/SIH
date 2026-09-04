import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateSite } from '../src/data/generate';
import { GRID } from '../src/lib/geo';

mkdirSync('scripts', { recursive: true });

function dumpGreyscale(data: Float32Array, min: number, max: number, path: string) {
  const png = new PNG({ width: GRID, height: GRID });
  for (let i = 0; i < GRID * GRID; i++) {
    const t = (data[i] - min) / (max - min);
    const v = Math.round(Math.min(1, Math.max(0, t)) * 255);
    png.data[i * 4] = v;
    png.data[i * 4 + 1] = v;
    png.data[i * 4 + 2] = v;
    png.data[i * 4 + 3] = 255;
  }
  writeFileSync(path, PNG.sync.write(png));
}

const site = generateSite();

dumpGreyscale(site.elevation, 250, 600, 'scripts/out-elevation.png');
dumpGreyscale(site.prospectivity, 0, 1, 'scripts/out-prospectivity.png');
dumpGreyscale(site.confidence, 0, 1, 'scripts/out-confidence.png');

console.log(`Fold axis fit to the 11 mines: ${site.foldAxisAngleDeg.toFixed(1)}°`);
console.log(`Lineaments traced: ${site.lineaments.length}`);
console.log('Wrote scripts/out-elevation.png, out-prospectivity.png, out-confidence.png');
console.log('MANUAL GATE: open out-prospectivity.png. It must show banded, elongated');
console.log('structure along one dominant diagonal — folded geology, not Perlin clouds.');

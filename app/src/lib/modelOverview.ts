import type { GeneratorOutput } from '../data/generate';
import { GRID, gridToWorld } from './geo';

export type OverviewSource = Pick<GeneratorOutput, 'prospectivity' | 'confidence' | 'probabilityAt'>;
export const PATCH_SIZE = 13;
const RADIUS = (PATCH_SIZE - 1) / 2;

export interface OverviewVoxel {
  x: number;
  z: number;
  depth: number;
  height: number;
  value: number;
}

/** Reads the same raster and 3D field used by the terrain and block model. No generated
 * display values: score is full-column; peak and visible blocks follow the depth interval.
 * A block's colour is its maximum sampled score (5 m steps), not an estimated ore volume. */
export function buildModelOverview(site: OverviewSource, gx: number, gz: number, range: [number, number], cutoff: number) {
  const index = gz * GRID + gx;
  const score = site.prospectivity[index];
  let lower = 0;
  for (const value of site.prospectivity) if (value < score) lower++;

  const [wx, wz] = gridToWorld(gx, gz);
  let peakDepth: number | null = null;
  let peakValue = 0;
  for (let depth = range[0]; depth <= range[1]; depth += 5) {
    const value = site.probabilityAt(wx, wz, depth);
    if (value > peakValue) {
      peakValue = value;
      peakDepth = depth;
    }
  }

  const patch = Array.from({ length: PATCH_SIZE * PATCH_SIZE }, (_, i) => {
    const x = gx + i % PATCH_SIZE - RADIUS;
    const z = gz + Math.floor(i / PATCH_SIZE) - RADIUS;
    if (x < 0 || z < 0 || x >= GRID || z >= GRID) return null;
    return { score: site.prospectivity[z * GRID + x], confidence: site.confidence[z * GRID + x] };
  });

  const voxels: OverviewVoxel[] = [];
  for (let z = 0; z < 7; z++) {
    for (let x = 0; x < 7; x++) {
      const cellX = gx + x * 2 - RADIUS;
      const cellZ = gz + z * 2 - RADIUS;
      if (cellX < 0 || cellZ < 0 || cellX >= GRID || cellZ >= GRID) continue;
      const [sampleX, sampleZ] = gridToWorld(cellX, cellZ);
      for (let depth = range[0]; depth < range[1] || depth === range[0]; depth += 20) {
        const height = Math.min(20, range[1] - depth);
        let value = 0;
        for (let offset = 0; offset <= height; offset += 5) {
          value = Math.max(value, site.probabilityAt(sampleX, sampleZ, depth + offset));
        }
        if (value > 0 && value >= cutoff) voxels.push({ x, z, depth, height, value });
      }
    }
  }
  // Deep blocks first, then back-to-front within each slice.
  voxels.sort((a, b) => b.depth - a.depth || a.x + a.z - b.x - b.z);
  return { score, confidence: site.confidence[index], abovePercent: lower / site.prospectivity.length * 100, peakDepth, patch, voxels };
}

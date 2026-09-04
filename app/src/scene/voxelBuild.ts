import type { GeneratorOutput } from '../data/generate';
import { WORLD_SIZE } from '../lib/geo';
import { terrainSurfaceY } from '../lib/terrainConstants';

/** Part I §3: real mining block dimensions. 64x64 footprint, 24 benches of 10m each. */
export const VOXEL_GRID_X = 64;
export const VOXEL_GRID_Z = 64;
export const VOXEL_GRID_Y = 24;
export const DEPTH_STEP = 10;
export const BLOCK_W = WORLD_SIZE / VOXEL_GRID_X;
export const BLOCK_H = 9; // leaves a hairline gap per bench so cubes read as discrete blocks
export const CANDIDATE_MIN_PROBABILITY = 0.28;
export const MAX_INSTANCES = 28000;

export interface VoxelInstances {
  count: number;
  aProbability: Float32Array;
  aConfidence: Float32Array;
  /** 0..1, normalised distance from the click point — the bloom's per-instance stagger. */
  aDelay: Float32Array;
  aTargetPos: Float32Array; // count*3
  aSourcePos: Float32Array; // count*3
  aDepthIndex: Float32Array; // 0..23
}

/**
 * Walks the 64x64x24 candidate grid, keeps blocks above the probability floor, caps at
 * MAX_INSTANCES by keeping the highest-probability blocks, and builds the buffers the
 * bloom shader interpolates between. Pure — no React, no GL. Called once per site+click,
 * never on a slider tick (Part I §8: filtering happens in the shader via discard).
 */
export function buildVoxelInstances(site: GeneratorOutput, clickWorld: [number, number]): VoxelInstances {
  interface Candidate {
    x: number;
    z: number;
    depthIdx: number;
    depthMeters: number;
    p: number;
    elevAtColumn: number;
  }

  const candidates: Candidate[] = [];
  const rasterFromColumn = (colIdx: number, gridN: number) => Math.min(255, Math.floor((colIdx / gridN) * 256));

  for (let gz = 0; gz < VOXEL_GRID_Z; gz++) {
    for (let gx = 0; gx < VOXEL_GRID_X; gx++) {
      const x = (gx / VOXEL_GRID_X - 0.5) * WORLD_SIZE;
      const z = (0.5 - gz / VOXEL_GRID_Z) * WORLD_SIZE;
      const rgx = rasterFromColumn(gx, VOXEL_GRID_X);
      const rgz = rasterFromColumn(gz, VOXEL_GRID_Z);
      const elevAtColumn = site.elevation[rgz * 256 + rgx];

      for (let d = 0; d < VOXEL_GRID_Y; d++) {
        const depthMeters = d * DEPTH_STEP + DEPTH_STEP / 2;
        const p = site.probabilityAt(x, z, depthMeters);
        if (p > CANDIDATE_MIN_PROBABILITY) {
          candidates.push({ x, z, depthIdx: d, depthMeters, p, elevAtColumn });
        }
      }
    }
  }

  candidates.sort((a, b) => b.p - a.p);
  const kept = candidates.length > MAX_INSTANCES ? candidates.slice(0, MAX_INSTANCES) : candidates;
  const count = kept.length;

  const aProbability = new Float32Array(count);
  const aConfidence = new Float32Array(count);
  const aDelay = new Float32Array(count);
  const aTargetPos = new Float32Array(count * 3);
  const aSourcePos = new Float32Array(count * 3);
  const aDepthIndex = new Float32Array(count);

  const [cx, cz] = clickWorld;
  let maxDist = 1;
  for (const c of kept) maxDist = Math.max(maxDist, Math.hypot(c.x - cx, c.z - cz));

  kept.forEach((c, i) => {
    aProbability[i] = c.p;

    const rgx = Math.min(255, Math.floor((c.x / WORLD_SIZE + 0.5) * 256));
    const rgz = Math.min(255, Math.floor((0.5 - c.z / WORLD_SIZE) * 256));
    aConfidence[i] = site.confidence[rgz * 256 + rgx];

    aDelay[i] = Math.hypot(c.x - cx, c.z - cz) / maxDist;
    aDepthIndex[i] = c.depthIdx;

    aTargetPos[i * 3] = c.x;
    aTargetPos[i * 3 + 1] = -c.depthMeters;
    aTargetPos[i * 3 + 2] = c.z;

    // Every cube starts life projected onto the terrain surface at its column — visually
    // identical to the terrain it replaces at t=0. Continuity is everything.
    aSourcePos[i * 3] = c.x;
    aSourcePos[i * 3 + 1] = terrainSurfaceY(c.elevAtColumn);
    aSourcePos[i * 3 + 2] = c.z;
  });

  return { count, aProbability, aConfidence, aDelay, aTargetPos, aSourcePos, aDepthIndex };
}

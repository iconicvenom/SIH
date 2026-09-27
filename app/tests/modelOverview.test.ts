import { describe, expect, it } from 'vitest';
import { buildModelOverview, type OverviewSource } from '../src/lib/modelOverview';
import { GRID } from '../src/lib/geo';

function source(): OverviewSource {
  const prospectivity = new Float32Array(GRID * GRID).fill(0.25);
  prospectivity[128 * GRID + 128] = 0.75;
  prospectivity[0] = 0.75;
  prospectivity[1] = 1;
  return {
    prospectivity,
    confidence: new Float32Array(GRID * GRID).fill(0.5),
    probabilityAt: (_x, _z, depth) => depth === 60 ? 0.75 : depth === 180 ? 0.5 : 0,
  };
}

describe('model overview derived readings', () => {
  it('ranks the selected cell against the region without counting ties as lower', () => {
    const result = buildModelOverview(source(), 128, 128, [0, 240], 0.28);
    expect(result.score).toBe(0.75);
    expect(result.confidence).toBe(0.5);
    expect(result.abovePercent).toBeCloseTo(100 * 65533 / 65536);
    expect(result.peakDepth).toBe(60);
  });

  it('restricts the volume and depth peak to the interval without changing the full-column score', () => {
    const result = buildModelOverview(source(), 128, 128, [120, 240], 0.6);
    expect(result.score).toBe(0.75);
    expect(result.peakDepth).toBe(180);
    expect(result.voxels).toHaveLength(0);
    const lowerCutoff = buildModelOverview(source(), 128, 128, [120, 240], 0.4);
    expect(lowerCutoff.voxels.length).toBeGreaterThan(0);
    expect(lowerCutoff.voxels.every(v => v.depth >= 120 && v.depth + v.height <= 240 && v.value >= 0.4)).toBe(true);
  });

  it('leaves off-map preview cells empty rather than repeating edge data', () => {
    const result = buildModelOverview(source(), 0, 0, [0, 240], 0.28);
    expect(result.patch.filter(cell => cell !== null)).toHaveLength(49);
    expect(result.patch[6 * 13 + 6]?.score).toBe(0.75);
    expect(result.patch[0]).toBeNull();
    expect(result.voxels.every(v => v.x >= 3 && v.z >= 3)).toBe(true);
  });

  it('reports no depth peak for an empty column and handles a single-depth slice', () => {
    const empty = source();
    empty.probabilityAt = () => 0;
    expect(buildModelOverview(empty, 128, 128, [0, 240], 0).peakDepth).toBeNull();
    expect(buildModelOverview(empty, 128, 128, [0, 240], 0).voxels).toHaveLength(0);
    const slice = buildModelOverview(source(), 128, 128, [60, 60], 0.5);
    expect(slice.peakDepth).toBe(60);
    expect(slice.voxels.length).toBeGreaterThan(0);
    expect(slice.voxels.every(v => v.depth === 60 && v.height === 0)).toBe(true);
  });
});

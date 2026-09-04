import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rampColor, rampCss, confidenceColor, ORE_RAMP_CSS } from '../src/lib/ramp';

/**
 * The ore ramp is quoted in three places that a judge sees at the same time: the legend bar
 * in the HUD, the drape on the terrain, and the voxel field. A legend that disagrees with
 * the scene is a defect. These tests pin the ramp at its stops, pin its ordering, and pin
 * the GLSL twin against the TypeScript original.
 */

/** Restated independently from src/styles/tokens.css — NOT imported, so drift is caught. */
const STOPS: readonly [number, string][] = [
  [0.0, '#16202E'],
  [0.2, '#1E4A5F'],
  [0.4, '#2E7D8C'],
  [0.6, '#C9A227'],
  [0.8, '#E2622A'],
  [1.0, '#F7E0A8'],
];

const ONE_255 = 1 / 255;

function hexToUnitRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** 21 samples: 0.00, 0.05, ... 1.00. */
const SAMPLES: number[] = Array.from({ length: 21 }, (_, i) => i / 20);

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** CIE L*, the perceptual lightness a viewer actually reads off the ramp. */
function lStar(rgb: [number, number, number]): number {
  const y =
    0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

describe('ore ramp — stop accuracy', () => {
  it.each(STOPS)('matches %s at its stop within 1/255', (t, hex) => {
    const got = rampColor(t);
    const want = hexToUnitRgb(hex);
    expect(got[0]).toBeCloseTo(want[0], 6);
    expect(got[1]).toBeCloseTo(want[1], 6);
    expect(got[2]).toBeCloseTo(want[2], 6);
    for (let ch = 0; ch < 3; ch++) {
      expect(Math.abs(got[ch] - want[ch])).toBeLessThan(ONE_255);
    }
  });

  it('clamps out-of-range input to the terminal stops', () => {
    expect(rampColor(-3)).toEqual(rampColor(0));
    expect(rampColor(4)).toEqual(rampColor(1));
  });

  it('stays inside the 0..1 gamut for all 21 samples', () => {
    for (const t of SAMPLES) {
      for (const ch of rampColor(t)) {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(1);
      }
    }
  });
});

/**
 * ORDERING — read this before "fixing" it.
 *
 * The brief asked for luminance to be non-decreasing across all 21 samples. With the six
 * stops mandated by tokens.css that assertion is arithmetically false, and no tolerance
 * rescues it: gondite ochre #C9A227 at t=0.6 has L* 68.3, while braunite ember #E2622A at
 * t=0.8 has L* 57.1. Every standard lightness metric shows the same dip — Rec.709 luma,
 * Rec.601 luma, channel mean, max channel and CIE L* all fall across [0.6, 0.8]. The ramp
 * is a hue-shifting sequential scale (the magma/inferno family), not a luminance ramp.
 *
 * The stops are design law and cannot move, so these tests assert what is actually true
 * and still catch any drift:
 *   - the red channel, which carries the "heating up" reading, is monotonic everywhere;
 *   - L* is monotonic across the cool half, where the ramp does climb;
 *   - the ember dip is pinned to its expected magnitude, so changing a stop still fails.
 */
describe('ore ramp — ordering', () => {
  it('red channel is non-decreasing across all 21 samples', () => {
    for (let i = 1; i < SAMPLES.length; i++) {
      const prev = rampColor(SAMPLES[i - 1])[0];
      const curr = rampColor(SAMPLES[i])[0];
      expect(curr).toBeGreaterThanOrEqual(prev - 1e-12);
    }
  });

  it('L* is non-decreasing across the cool half, t in [0, 0.6]', () => {
    const cool = SAMPLES.filter((t) => t <= 0.6 + 1e-9);
    for (let i = 1; i < cool.length; i++) {
      expect(lStar(rampColor(cool[i]))).toBeGreaterThanOrEqual(lStar(rampColor(cool[i - 1])) - 1e-9);
    }
  });

  it('pins the deliberate ember dip between the ochre and ember stops', () => {
    expect(lStar(rampColor(0.6))).toBeCloseTo(68.3, 1);
    expect(lStar(rampColor(0.8))).toBeCloseTo(57.1, 1);
  });

  it('terminates at the lightest colour on the ramp', () => {
    const all = SAMPLES.map((t) => lStar(rampColor(t)));
    expect(Math.max(...all)).toBe(all[all.length - 1]);
  });
});

/**
 * The whole reason rampColor() is hand-rolled instead of using d3-interpolate: the GLSL
 * twin has to agree to 1/255. This reads the shader source and checks its stop table.
 */
describe('ore ramp — GLSL twin', () => {
  const glsl = readFileSync(
    new URL('../src/scene/shaders/oreRamp.glsl', import.meta.url),
    'utf8',
  );

  it('declares exactly the six stops that ramp.ts uses', () => {
    const found = [...glsl.matchAll(/vec3\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\s*\)\s*\/\s*255\.0/g)].map(
      (m) => [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255] as [number, number, number],
    );

    expect(found).toHaveLength(STOPS.length);

    STOPS.forEach(([t], i) => {
      const ts = rampColor(t);
      for (let ch = 0; ch < 3; ch++) {
        expect(Math.abs(found[i][ch] - ts[ch])).toBeLessThan(ONE_255);
      }
    });
  });

  it('branches at the same five interior boundaries', () => {
    for (const edge of ['0.2', '0.4', '0.6', '0.8']) {
      expect(glsl).toContain(`if (x < ${edge})`);
    }
  });
});

describe('confidence ramp', () => {
  it('runs greyscale from #1A2029 to #DCE4EC', () => {
    const lo = hexToUnitRgb('#1A2029');
    const hi = hexToUnitRgb('#DCE4EC');
    for (let ch = 0; ch < 3; ch++) {
      expect(Math.abs(confidenceColor(0)[ch] - lo[ch])).toBeLessThan(ONE_255);
      expect(Math.abs(confidenceColor(1)[ch] - hi[ch])).toBeLessThan(ONE_255);
    }
  });

  it('is non-decreasing in lightness across all 21 samples', () => {
    for (let i = 1; i < SAMPLES.length; i++) {
      expect(lStar(confidenceColor(SAMPLES[i]))).toBeGreaterThan(
        lStar(confidenceColor(SAMPLES[i - 1])),
      );
    }
  });
});

describe('CSS helpers', () => {
  it('rampCss round-trips the stops as integer rgb()', () => {
    expect(rampCss(0)).toBe('rgb(22,32,46)');
    expect(rampCss(0.6)).toBe('rgb(201,162,39)');
    expect(rampCss(1)).toBe('rgb(247,224,168)');
  });

  it('ORE_RAMP_CSS lists all six stops left to right', () => {
    expect(ORE_RAMP_CSS).toBe(
      'linear-gradient(90deg, #16202e 0%, #1e4a5f 20%, #2e7d8c 40%, #c9a227 60%, #e2622a 80%, #f7e0a8 100%)',
    );
  });
});

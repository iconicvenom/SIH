import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { SPACECRAFT } from '../src/data/spacecraft';
import { regionalSatelliteAt, satelliteVisible } from '../src/lib/regionalSatelliteMotion';

describe('regional presentation motion', () => {
  const camera = new Vector3(.1977358, .309017, -.93027365).multiplyScalar(2.75);
  it('keeps all three spacecraft on the India-facing hemisphere for the entire loop', () => {
    for (let seconds = 0; seconds < 18; seconds += .1) for (const spec of SPACECRAFT) {
      const state = regionalSatelliteAt(spec.id, seconds);
      expect(state.latitude).toBeGreaterThanOrEqual(3);
      expect(state.latitude).toBeLessThanOrEqual(45);
      expect(state.longitude).toBeGreaterThanOrEqual(64);
      expect(state.longitude).toBeLessThanOrEqual(110);
      expect(satelliteVisible(state.position, camera)).toBe(true);
      expect(state.position.length()).toBeCloseTo(1 + spec.altitudeKm / 6371, 10);
      expect(new Vector3(0, 1, 0).applyQuaternion(state.orientation).dot(state.position.clone().normalize())).toBeCloseTo(-1, 9);
    }
  });
  it('moves visibly and joins the loop without a jump or attitude flip', () => {
    for (const spec of SPACECRAFT) {
      const start = regionalSatelliteAt(spec.id, 0);
      const next = regionalSatelliteAt(spec.id, 1);
      const end = regionalSatelliteAt(spec.id, 18);
      expect(start.position.distanceTo(next.position)).toBeGreaterThan(.03);
      expect(start.position.distanceTo(end.position)).toBeLessThan(1e-10);
      expect(start.orientation.angleTo(end.orientation)).toBeLessThan(1e-6);
      const a = regionalSatelliteAt(spec.id, 17.999);
      const b = regionalSatelliteAt(spec.id, .001);
      expect(a.position.distanceTo(b.position)).toBeLessThan(.001);
    }
  });
  it('hides and prevents selection through Earth after manual globe rotation', () => {
    const state = regionalSatelliteAt('sentinel-2b', 0);
    expect(satelliteVisible(state.position, state.position.clone().normalize().multiplyScalar(3))).toBe(true);
    expect(satelliteVisible(state.position, state.position.clone().normalize().multiplyScalar(-3))).toBe(false);
  });
});

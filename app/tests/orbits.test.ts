import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { SPACECRAFT, REPLAY_START, REPLAY_END } from '../src/data/spacecraft';
import { orbitAt, earthFixedToWorld, inAsiaPacific, asiaPassTime, sampleOrbit, sunDirection } from '../src/lib/orbits';

describe('dated satellite orbits', () => {
  it('maps Greenwich, east and north to the textured globe without mirroring', () => {
    expect(earthFixedToWorld({x:6371,y:0,z:0}).distanceTo(new Vector3(1,0,0))).toBeLessThan(1e-12);
    expect(earthFixedToWorld({x:0,y:6371,z:0}).distanceTo(new Vector3(0,0,-1))).toBeLessThan(1e-12);
    expect(earthFixedToWorld({x:0,y:0,z:6371}).distanceTo(new Vector3(0,1,0))).toBeLessThan(1e-12);
  });
  it.each(SPACECRAFT)('$name stays in its observed altitude band throughout the replay', spec => {
    const bounds = spec.id === 'sentinel-2b' ? [760,820] : spec.id === 'landsat-9' ? [680,740] : [490,550];
    for(let t=REPLAY_START;t<=REPLAY_END;t+=900_000) {
      const s=orbitAt(spec.id,t);
      expect(s.altitude).toBeGreaterThan(bounds[0]);
      expect(s.altitude).toBeLessThan(bounds[1]);
      expect(s.speed).toBeGreaterThan(7);
      expect(s.speed).toBeLessThan(8);
      // Earth-facing optical axis and along-track axis remain perpendicular.
      const axis = new Vector3(0,1,0).applyQuaternion(s.orientation);
      expect(axis.dot(s.position.clone().normalize())).toBeCloseTo(-1,9);
      expect(s.orientation.length()).toBeCloseTo(1,9);
    }
  });
  it('keeps the Sun vector finite and motion continuous rather than reversing a patrol', () => {
    for(let t=REPLAY_START;t<REPLAY_END;t+=3_600_000) {
      expect(sunDirection(t).length()).toBeCloseTo(1,12);
      for(const spec of SPACECRAFT) {
        const a=orbitAt(spec.id,t),b=orbitAt(spec.id,t+1000),c=orbitAt(spec.id,t+2000);
        const ab=b.position.clone().sub(a.position),bc=c.position.clone().sub(b.position);
        expect(ab.length()*6371).toBeGreaterThan(6.5);
        expect(ab.length()*6371).toBeLessThan(8.5);
        expect(ab.normalize().dot(bc.normalize())).toBeGreaterThan(.999);
      }
    }
  });
  it('clips at the dateline and regional boundary without a bridging segment', () => {
    expect(inAsiaPacific(-30,-160)).toBe(true);
    expect(inAsiaPacific(20,80)).toBe(true);
    expect(inAsiaPacific(20,-80)).toBe(false);
    expect(inAsiaPacific(80,80)).toBe(false);
    for(const spec of SPACECRAFT) {
      const t=asiaPassTime(spec.id);
      const s=orbitAt(spec.id,t);
      expect(t).toBeGreaterThanOrEqual(REPLAY_START);
      expect(t).toBeLessThan(REPLAY_END);
      expect(Math.abs(s.latitude-38)).toBeLessThan(12);
      expect(Math.abs(s.longitude-85)).toBeLessThan(12);
      const segments=sampleOrbit(spec.id,t,true);
      expect(segments.length).toBeGreaterThan(0);
      for(const segment of segments) for(let i=1;i<segment.length;i++)
        expect(segment[i].distanceTo(segment[i-1])).toBeLessThan(0.05);
    }
  });
});

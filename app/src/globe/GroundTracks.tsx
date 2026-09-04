import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useDrishti } from '../store/useDrishti';
import { SENSORS } from '../data/sensors';

/**
 * Ground tracks — the honest replacement for orbiting spacecraft. A swath footprint is
 * what actually determines whether a scene lands, so these are what earn the space theme
 * (Part III §2). Each is a great circle inclined near sun-synchronous (~98deg), offset in
 * longitude per sensor, drawn on a sphere just outside the globe surface.
 */
const INCLINATION_RAD = (98 * Math.PI) / 180;
const TRACK_RADIUS = 1.008;
const SEGMENTS = 128;

function hashUnit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

function buildTrack(raanRad: number): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = (i / SEGMENTS) * Math.PI * 2;
    const x0 = Math.cos(t);
    const y0 = Math.sin(t) * Math.sin(INCLINATION_RAD);
    const z0 = Math.sin(t) * Math.cos(INCLINATION_RAD);
    const x = x0 * Math.cos(raanRad) + z0 * Math.sin(raanRad);
    const z = -x0 * Math.sin(raanRad) + z0 * Math.cos(raanRad);
    points.push([x * TRACK_RADIUS, y0 * TRACK_RADIUS, z * TRACK_RADIUS]);
  }
  return points;
}

export function GroundTracks() {
  const view = useDrishti((s) => s.view);
  const swathsOn = useDrishti((s) => s.layers.swaths);
  const selectedSensor = useDrishti((s) => s.selectedSensor);
  const bootStage = useDrishti((s) => s.bootStage);
  const reducedMotion = useDrishti((s) => s.reducedMotion);

  const tracks = useMemo(
    () => SENSORS.map((s) => ({ id: s.id, points: buildTrack(hashUnit(s.id) * Math.PI * 2) })),
    [],
  );

  // Draw-on reveal: 900ms once the opening sequence reaches this stage, then stop moving —
  // after settling the only motion in the app is the globe rotation (Part III §6).
  // Floor of 2, never 0: drei's Line computes a (points.length - 1) * 6 buffer, so an
  // empty slice throws "Invalid typed array length: -6" the instant this mounts, before
  // bootStage ever reaches 5.
  const [revealCount, setRevealCount] = useState(reducedMotion ? SEGMENTS + 1 : 2);
  const elapsed = useRef(0);
  const done = useRef(reducedMotion);

  useFrame((_, delta) => {
    if (done.current || bootStage < 5) return;
    elapsed.current += delta * 1000;
    const t = Math.min(1, elapsed.current / 900);
    const count = Math.max(2, Math.round(t * (SEGMENTS + 1)));
    setRevealCount(count);
    if (t >= 1) done.current = true;
  });

  if (view !== 'GLOBE' || !swathsOn) return null;

  return (
    <group>
      {tracks.map((track) => {
        const highlighted = track.id === selectedSensor;
        const visible = track.points.slice(0, Math.max(2, revealCount));
        return (
          <Line
            key={track.id}
            points={visible}
            color={highlighted ? '#2E7D8C' : '#566472'}
            opacity={highlighted ? 0.9 : 0.28}
            transparent
            lineWidth={highlighted ? 1.5 : 1}
          />
        );
      })}
    </group>
  );
}

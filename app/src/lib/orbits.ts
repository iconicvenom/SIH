import { twoline2satrec, propagate, gstime, eciToEcf, eciToGeodetic, sunPos, jday } from 'satellite.js';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { SPACECRAFT, REPLAY_START, REPLAY_END, type SpacecraftId } from '../data/spacecraft';

export const EARTH_RADIUS_KM = 6371;
const records = new Map(SPACECRAFT.map(s => [s.id, twoline2satrec(...s.tle)]));

/** ECF X = Greenwich, Y = 90 E, Z = north. Globe uses X, north Y, WEST Z. */
export function earthFixedToWorld(p: { x: number; y: number; z: number }): Vector3 {
  return new Vector3(p.x, p.z, -p.y).divideScalar(EARTH_RADIUS_KM);
}

export function orbitAt(id: SpacecraftId, timeMs: number) {
  const record = records.get(id)!;
  const date = new Date(timeMs);
  const pv = propagate(record, date);
  if (!pv) throw new Error(`Cannot propagate ${id}: ${record.error}`);
  const gmst = gstime(date);
  const gd = eciToGeodetic(pv.position, gmst);
  const position = earthFixedToWorld(eciToEcf(pv.position, gmst));
  // Inertial velocity expressed in the Earth-fixed frame sets local orbital attitude.
  const velocity = earthFixedToWorld(eciToEcf(pv.velocity, gmst));
  const outward = position.clone().normalize();
  const along = velocity.clone().addScaledVector(outward, -velocity.dot(outward)).normalize();
  const cross = new Vector3().crossVectors(outward, along).normalize();
  // Model +Y = nadir, +Z = along-track. This is nominal LVLH, not attitude telemetry.
  const orientation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(
    cross.clone().negate(), outward.clone().negate(), along,
  ));
  return {
    position, orientation, altitude: gd.height,
    latitude: gd.latitude * 180 / Math.PI, longitude: gd.longitude * 180 / Math.PI,
    speed: Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z),
    period: 2 * Math.PI / record.no, inclination: record.inclo * 180 / Math.PI,
  };
}

export function sunDirection(timeMs: number): Vector3 {
  const date = new Date(timeMs);
  const [x,y,z] = sunPos(jday(date)).rsun;
  return earthFixedToWorld(eciToEcf({x,y,z}, gstime(date))).normalize();
}

/** Longitudes wrap through 180° so the South Pacific is included. */
export function inAsiaPacific(latitude: number, longitude: number): boolean {
  const east = (longitude + 360) % 360;
  return latitude >= -60 && latitude <= 65 && east >= 45 && east <= 225;
}

export function sampleOrbit(id: SpacecraftId, timeMs: number, regional: boolean) {
  const periodMs = orbitAt(id, timeMs).period * 60_000;
  const segments: Vector3[][] = [];
  let current: Vector3[] = [];
  // Earth-fixed trajectory: each sample uses its OWN sidereal time. Rotating one
  // inertial ellipse once would incorrectly close the ground-relative track.
  for (let i = 0; i <= 240; i++) {
    const state = orbitAt(id, timeMs + (i / 240 - 0.15) * periodMs);
    if (!regional || inAsiaPacific(state.latitude, state.longitude)) {
      current.push(state.position);
    } else if (current.length) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

/** Pick an actual pass near India within the dated replay, without moving the orbit. */
export function asiaPassTime(id: SpacecraftId): number {
  let bestTime = REPLAY_START;
  let bestDistance = Infinity;
  for (let t = REPLAY_START; t < REPLAY_END; t += 30_000) {
    const s = orbitAt(id, t);
    const distance = (s.latitude - 38) ** 2 + (s.longitude - 85) ** 2;
    if (distance < bestDistance) { bestDistance = distance; bestTime = t; }
  }
  return bestTime;
}

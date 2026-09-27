import { Matrix4, Quaternion, Vector3 } from 'three';
import { SPACECRAFT, type SpacecraftId } from '../data/spacecraft';

const RAD = Math.PI / 180;
const ROUTES: Record<SpacecraftId, { longitude: number; phase: number }> = {
  'sentinel-2b': { longitude: 72, phase: 0.2 },
  'landsat-9': { longitude: 87, phase: 2.3 },
  'cartosat-3': { longitude: 102, phase: 4.4 },
};

/** Presentation animation, intentionally NOT orbital propagation. Three staggered,
 * continuous loops keep every spacecraft around India and its southern waters.
 * One circuit takes 18 seconds; there are no resets, teleports or hidden far-side laps. */
export function regionalSatelliteAt(id: SpacecraftId, seconds: number) {
  const route = ROUTES[id];
  const spec = SPACECRAFT.find(s => s.id === id)!;
  const theta = seconds * Math.PI * 2 / 18 + route.phase;
  const latitude = 24 + 21 * Math.cos(theta);
  const longitude = route.longitude + 8 * Math.sin(theta);
  const lat = latitude * RAD, lon = longitude * RAD;
  const dLat = -21 * Math.sin(theta) * RAD;
  const dLon = 8 * Math.cos(theta) * RAD;
  const outward = new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
  const tangent = new Vector3(
    -Math.sin(lat) * dLat * Math.cos(lon) - Math.cos(lat) * Math.sin(lon) * dLon,
    Math.cos(lat) * dLat,
    Math.sin(lat) * dLat * Math.sin(lon) - Math.cos(lat) * Math.cos(lon) * dLon,
  ).normalize();
  const nadir = outward.clone().negate();
  const cross = new Vector3().crossVectors(nadir, tangent).normalize();
  const orientation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(cross, nadir, tangent));
  return { position: outward.multiplyScalar(1 + spec.altitudeKm / 6371), orientation, latitude, longitude };
}

/** Shared by hit testing and HTML labels, so far-side spacecraft are neither
 * labelled nor selectable if the user manually rotates the globe. */
export function satelliteVisible(position: Vector3, camera: Vector3) {
  const ray = position.clone().sub(camera);
  const t = Math.max(0, Math.min(1, -camera.dot(ray) / ray.lengthSq()));
  return camera.clone().addScaledVector(ray, t).lengthSq() > 1.015 ** 2;
}

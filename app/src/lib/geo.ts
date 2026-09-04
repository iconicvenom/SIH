/** Site 1 — Sausar Belt. Part II §5 bounds (Part I §1's narrower box drops 6 of the 11 mines). */
export const BBOX = { lonMin: 79.05, lonMax: 80.5, latMin: 21.05, latMax: 22.0 };

/** Three.js world units spanning the bbox, centred on the origin. */
export const WORLD_SIZE = 1024;

/** Raster resolution for elevation / prospectivity / confidence. */
export const GRID = 256;

/** lon/lat -> world x/z. North (+lat) maps to -z, matching three.js's default -z forward. */
export function lonLatToWorld(lon: number, lat: number): [number, number] {
  const u = (lon - BBOX.lonMin) / (BBOX.lonMax - BBOX.lonMin);
  const v = (lat - BBOX.latMin) / (BBOX.latMax - BBOX.latMin);
  return [(u - 0.5) * WORLD_SIZE, (0.5 - v) * WORLD_SIZE];
}

export function worldToLonLat(x: number, z: number): [number, number] {
  const u = x / WORLD_SIZE + 0.5;
  const v = 0.5 - z / WORLD_SIZE;
  return [BBOX.lonMin + u * (BBOX.lonMax - BBOX.lonMin), BBOX.latMin + v * (BBOX.latMax - BBOX.latMin)];
}

/** World x/z -> 0..GRID-1 raster indices, clamped. */
export function worldToGrid(x: number, z: number): [number, number] {
  const gx = Math.min(GRID - 1, Math.max(0, Math.floor((x / WORLD_SIZE + 0.5) * GRID)));
  const gz = Math.min(GRID - 1, Math.max(0, Math.floor((0.5 - z / WORLD_SIZE) * GRID)));
  return [gx, gz];
}

/** Grid indices -> world x/z at the cell centre. */
export function gridToWorld(gx: number, gz: number): [number, number] {
  return [(gx / GRID - 0.5) * WORLD_SIZE, (0.5 - gz / GRID) * WORLD_SIZE];
}

/**
 * lon/lat -> unit-sphere normal, for the globe.
 *
 * The Z sign here is NOT arbitrary — it has to match how three.js's own SphereGeometry maps
 * its default UVs to azimuth (see node_modules/three SphereGeometry.js: phi = u * 2π, and
 * vertex.z = ringRadius * sin(phi)), because that is what the globe's real earth-color.jpg
 * texture is actually sampled against. Working through that mapping: a texture u sampled for a
 * given `lon` (via lonLatToUV's (lon+180)/360) lands at phi = lon_rad + π, and
 * sin(phi) = -sin(lon_rad) — negative. Getting this sign wrong doesn't error or look subtly
 * off; it silently mirrors every lon/lat placed this way (pins, camera look direction, light
 * position, mine markers) to the WRONG side of the prime meridian while the texture itself
 * stays correct — which is exactly the bug that put a Balaghat pin over southeast Asia.
 */
export function lonLatToNormal(lon: number, lat: number): [number, number, number] {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)];
}

/** Great-circle-ish planar distance in km, adequate at this latitude and extent. */
export function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = (lat2 - lat1) * 111;
  const dLon = (lon2 - lon1) * 111 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLon);
}

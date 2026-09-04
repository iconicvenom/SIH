import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Vector3,
  RingGeometry,
  MeshBasicMaterial,
  DoubleSide,
  BufferGeometry,
  BufferAttribute,
  LineBasicMaterial,
  Line as ThreeLine,
} from 'three';
import { Html } from '@react-three/drei';
import { useDrishti } from '../store/useDrishti';

/**
 * EOS-04 — ISRO's own C-band SAR mission (MOIL being a PSU, this is the one platform in the
 * acquisition plan that's actually "ours"), given a real body instead of a line on the globe.
 * It genuinely feeds the structural predictors optical imagery can't see through canopy, so
 * this is not an arbitrary "space decoration" pick.
 *
 * Altitude and inclination are the real published values. What is NOT real: a satellite
 * hovering over one country. LEO orbits don't do that — a real EOS-04 circles the whole planet
 * every ~95 minutes, and the "stay near India" behaviour asked for here is the same kind of
 * honest exaggeration the app already makes elsewhere (the globe's 46s day, the terrain's
 * V.E.): the real inclination and a real great-circle path are kept, but instead of completing
 * the rest of a lap around the planet the sweep reverses at the India-side extent of that path
 * — a patrol, not a lap. The scan beam and ping are an even more explicit dashboard device
 * (real SAR does not paint a visible line), doing the job asked for: show it actively looking
 * at the ground rather than just orbiting past it.
 */
const EARTH_RADIUS_KM = 6371;
const ALTITUDE_KM = 530;
const INCLINATION_DEG = 97.6;
/** Not a live value (see file header) — chosen so the orbit's equatorial crossing (theta=0)
 *  sits at ~79°E, i.e. lands the patrol path on India rather than an arbitrary meridian.
 *  RAAN_DEG = target longitude directly, given orbitPosition's own parametrisation and the
 *  (now-fixed, see lib/geo.ts's lonLatToNormal) sign convention the rest of the globe uses. */
const RAAN_DEG = 79;
const ACCENT = '#e8b978';

const UP = new Vector3(0, 1, 0);

/** Same great-circle parametrisation the orbit has always used — inclination sets the plane's
 *  tilt, RAAN sets which meridian it crosses the equator at, theta is position along it. */
function orbitPosition(thetaRad: number, inclRad: number, raanRad: number, radius: number): Vector3 {
  const x0 = Math.cos(thetaRad);
  const y0 = Math.sin(thetaRad) * Math.sin(inclRad);
  const z0 = Math.sin(thetaRad) * Math.cos(inclRad);
  const x = x0 * Math.cos(raanRad) + z0 * Math.sin(raanRad);
  const z = -x0 * Math.sin(raanRad) + z0 * Math.cos(raanRad);
  return new Vector3(x * radius, y0 * radius, z * radius);
}

/**
 * Authored in real METRES (ISRO / eoPortal RISAT-1 family) then scaled by one constant — see
 * the git history on this file for the two-satellite version's fuller reasoning on why 1:1
 * scale against the globe is unrenderable. Hexagonal-prism bus, and a large C-band SAR antenna
 * at its real deployed dimensions (6.29 x 2.09 x 0.22 m, three panels) that dominates the
 * silhouette the way it does on the real spacecraft.
 */
const MODEL_SCALE_WU_PER_M = 0.0155;
const GOLD_MLI = { color: '#caa24a', emissive: '#caa24a', emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.38 } as const;
const SILVER_HULL = { color: '#dfe3e7', emissive: '#8891a0', emissiveIntensity: 0.22, metalness: 0.6, roughness: 0.3 } as const;
const DARK_HULL = { color: '#23272e', metalness: 0.55, roughness: 0.4 } as const;
const PANEL = { color: '#0a1424', emissive: ACCENT, emissiveIntensity: 0.38, metalness: 0.15, roughness: 0.55 } as const;

function Eos04Model() {
  return (
    <group scale={MODEL_SCALE_WU_PER_M}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.05, 1.05, 2.6, 6]} />
        <meshStandardMaterial {...GOLD_MLI} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.9, 6]} />
        <meshStandardMaterial {...SILVER_HULL} />
      </mesh>
      {/* the SAR antenna: three flat panels at its real dimensions, deployed to nadir side */}
      <group position={[0, -0.4, 1.9]}>
        {[-2.1, 0, 2.1].map((z, i) => (
          <mesh key={i} position={[0, 0, z]}>
            <boxGeometry args={[2.09, 0.22, 2.05]} />
            <meshStandardMaterial {...DARK_HULL} />
          </mesh>
        ))}
      </group>
      {/* a modest pair of solar panels — secondary to the antenna on the real spacecraft */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 2.2, 0, -1.1]}>
          <boxGeometry args={[2.8, 0.05, 1.3]} />
          <meshStandardMaterial {...PANEL} />
        </mesh>
      ))}
    </group>
  );
}

/** A pulsing ring at the sub-satellite point — the "actively scanning the ground" read the
 *  brief asked for. Flat geometry laid tangent to the sphere at the nadir point; small enough
 *  relative to the globe's curvature that it doesn't need to bend to avoid visibly floating. */
function ScanPing({ groupRef }: { groupRef: React.RefObject<Group | null> }) {
  const ringRef = useRef<Group>(null);
  const elapsed = useRef(0);
  const CYCLE_S = 1.8;

  const geometry = useRef(new RingGeometry(0.85, 1, 48)).current;
  const material = useRef(
    new MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, side: DoubleSide }),
  ).current;

  useFrame((_, delta) => {
    if (!groupRef.current || !ringRef.current) return;
    elapsed.current = (elapsed.current + delta) % CYCLE_S;
    const t = elapsed.current / CYCLE_S;

    const satPos = groupRef.current.position;
    const nadirDir = satPos.clone().normalize();
    ringRef.current.position.copy(nadirDir); // radius 1 — the undisplaced surface, close enough for a ping
    ringRef.current.quaternion.setFromUnitVectors(UP, nadirDir);

    const scale = 0.02 + t * 0.09;
    ringRef.current.scale.setScalar(scale);
    material.opacity = 0.65 * (1 - t);
  });

  return (
    <group ref={ringRef}>
      <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  );
}

/** Satellite-to-nadir beam. A raw buffer geometry updated in place every frame — drei's
 *  declarative <Line> rebuilds from its points PROP, so mutating the same Vector3s each frame
 *  (rather than allocating a new array) would silently never move on screen. */
function ScanBeam({ groupRef }: { groupRef: React.RefObject<Group | null> }) {
  // The position attribute is set up front, synchronously, rather than in a useEffect — R3F's
  // render loop can tick a useFrame before effects from the same commit have run, and
  // geometry.attributes.position must already exist the first time that happens.
  const positions = useRef(new Float32Array(6)).current;
  const geometry = useRef(new BufferGeometry().setAttribute('position', new BufferAttribute(positions, 3))).current;
  const material = useRef(new LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.4 })).current;
  // A THREE.Line instance built once and handed to <primitive> — the JSX intrinsic `<line>`
  // collides with the SVG element of the same name in this project's TS setup, and drei's
  // <Line> rebuilds its geometry from the `points` prop rather than tracking in-place
  // mutations, which is exactly what this beam needs to do every frame.
  const lineObj = useRef(new ThreeLine(geometry, material)).current;

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    if (!groupRef.current) return;
    const pos = groupRef.current.position;
    const nadir = pos.clone().normalize(); // radius 1 — the undisplaced surface, close enough for a beam
    positions[0] = pos.x;
    positions[1] = pos.y;
    positions[2] = pos.z;
    positions[3] = nadir.x;
    positions[4] = nadir.y;
    positions[5] = nadir.z;
    geometry.attributes.position.needsUpdate = true;
    geometry.computeBoundingSphere();
  });

  return <primitive object={lineObj} />;
}

export function Satellites() {
  const view = useDrishti((s) => s.view);
  const reducedMotion = useDrishti((s) => s.reducedMotion);
  const groupRef = useRef<Group>(null);
  const t = useRef(0);

  const radius = 1 + ALTITUDE_KM / EARTH_RADIUS_KM;
  const inclRad = (INCLINATION_DEG * Math.PI) / 180;
  const raanRad = (RAAN_DEG * Math.PI) / 180;
  // A back-and-forth patrol along the real orbital great circle, bounded to one arc of it
  // rather than completing the rest of a lap around the planet — from ~55°N (Russia) down
  // through India to ~12°S (into the Indian Ocean south of it), not a symmetric wobble around
  // the equator. THETA_NORTH/THETA_SOUTH are the theta values (this file's own orbitPosition
  // parametrisation) that land on those two latitudes at RAAN_DEG's meridian — verified
  // numerically, not hand-derived, since this orbit's coordinate convention has bitten this
  // file's own longitude fix once already.
  const THETA_NORTH = 0.973; // ~55°N, ~90°E
  const THETA_SOUTH = -0.211; // ~12°S, ~77°E
  const sweepCenter = (THETA_NORTH + THETA_SOUTH) / 2;
  const sweepAmplitude = (THETA_NORTH - THETA_SOUTH) / 2;
  const SWEEP_PERIOD_S = 16;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (!reducedMotion) t.current += delta;
    const theta = sweepCenter + sweepAmplitude * Math.sin((t.current * Math.PI * 2) / SWEEP_PERIOD_S);
    const pos = orbitPosition(theta, inclRad, raanRad, radius);
    groupRef.current.position.copy(pos);
    const outward = pos.clone().normalize();
    groupRef.current.quaternion.setFromUnitVectors(UP, outward);
  });

  if (view !== 'GLOBE') return null;

  return (
    <group>
      <group ref={groupRef}>
        <Eos04Model />
        <Html center distanceFactor={2.6} style={{ pointerEvents: 'none' }}>
          <div className="mono" style={{ fontSize: 10, color: ACCENT, whiteSpace: 'nowrap', textAlign: 'center' }}>
            EOS-04
            <div style={{ fontSize: 9, color: 'var(--text-mute)' }}>ISRO</div>
          </div>
        </Html>
      </group>
      <ScanBeam groupRef={groupRef} />
      <ScanPing groupRef={groupRef} />
      <Html position={[1.4, -1.3, 0]} transform={false} style={{ pointerEvents: 'none' }}>
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)', textAlign: 'right' }}>
          real orbit &amp; altitude · patrol path + scan beam are illustrative
        </div>
      </Html>
    </group>
  );
}

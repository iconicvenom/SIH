import {
  Suspense,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Vector3, type HemisphereLight, type DirectionalLight } from 'three';
import { CameraRig } from './CameraRig';
import { Terrain } from './Terrain';
import { MineMarkers } from './MineMarkers';
import { VoxelField } from './VoxelField';
import { DepthRuler } from './DepthRuler';
import { DrillTrace } from './DrillTrace';
import { Effects } from './Effects';
import { Globe } from '../globe/Globe';
import { StarField } from '../globe/StarField';
import { Satellites } from '../globe/Satellites';
import { fetchSite } from '../data/api';
import type { GeneratorOutput } from '../data/generate';
import { useDrishti } from '../store/useDrishti';
import { lonLatToNormal } from '../lib/geo';

const SiteDataContext = createContext<GeneratorOutput | null>(null);
export function useSiteData() {
  return useContext(SiteDataContext);
}

/**
 * Wraps both the 3D canvas and the dashboard widgets, so the widgets keep working (in
 * their empty states, then populated) even when WebGL2 is unavailable and Canvas3D never
 * mounts — fetchSite() has no WebGL dependency.
 */
export function SiteDataProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<GeneratorOutput | null>(null);
  useEffect(() => {
    fetchSite().then(setSite);
  }, []);
  return <SiteDataContext.Provider value={site}>{children}</SiteDataContext.Provider>;
}

function SceneFog() {
  const view = useDrishti((s) => s.view);
  // Fog is what makes SUBSURFACE feel underground rather than like a floating diagram.
  return view === 'SUBSURFACE' ? <fogExp2 attach="fog" args={[0x0b0e12, 0.0016]} /> : null;
}

// GLOBE's camera now sits along the India-facing normal (CameraRig.tsx's GLOBE_LOOK), not
// [0,0,3.2] — TERRAIN_LIGHT_POS was tuned for the terrain states' oblique look and has a
// strongly *negative* Z, which lit the wrong side of a globe camera at the OLD default angle
// too; GLOBE_LIGHT_POS keeps the same "upper" sun-angle character but follows the camera's new
// direction so the visible (India-facing) side stays lit rather than falling back to flat
// ambient shading.
const TERRAIN_LIGHT_POS = new Vector3(400, 200, -300);
const [globeLightNx, globeLightNy, globeLightNz] = lonLatToNormal(78, 18);
const GLOBE_LIGHT_POS = new Vector3(globeLightNx, globeLightNy + 0.3, globeLightNz).multiplyScalar(350);

/**
 * One shared lighting rig for the whole continuous scene, deliberately — but a single
 * low-angle directional light leaves roughly half of any sphere essentially unlit at a
 * given moment, which reads as "half the globe is just missing" rather than as the
 * intended cold-but-legible look. The terrain states genuinely want minimal fill (Part I:
 * "mostly dark, the ore ramp provides the light"); the globe now carries real, only
 * moderately-bright Blue Marble tones (ocean navy, muted land) rather than the old
 * intentionally-dark procedural palette, and needed considerably more of both lights to
 * read clearly rather than as a hemisphere-scale silhouette. Modulating the two existing
 * lights' intensity AND the directional light's position by view is a smaller, more honest
 * fix than adding lights that would only ever run in one state.
 */
function SceneLights() {
  const view = useDrishti((s) => s.view);
  const hemiTarget = view === 'GLOBE' ? 1.8 : 0.4;
  const dirTarget = view === 'GLOBE' ? 2.2 : 1.1;
  const dirPosTarget = view === 'GLOBE' ? GLOBE_LIGHT_POS : TERRAIN_LIGHT_POS;
  const hemiRef = useRef<HemisphereLight>(null);
  const dirRef = useRef<DirectionalLight>(null);
  useFrame((_, delta) => {
    const t = Math.min(1, delta * 3);
    if (hemiRef.current) hemiRef.current.intensity += (hemiTarget - hemiRef.current.intensity) * t;
    if (dirRef.current) {
      dirRef.current.intensity += (dirTarget - dirRef.current.intensity) * t;
      dirRef.current.position.lerp(dirPosTarget, t);
    }
  });
  return (
    <>
      <hemisphereLight ref={hemiRef} args={[0x8899aa, 0x0b0e12, 0.4]} />
      <directionalLight ref={dirRef} position={[400, 200, -300]} intensity={1.1} />
    </>
  );
}

export function Canvas3D() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.01, far: 4000 }}
      // A click that hits no mesh at all (empty space off the terrain) clears the current
      // selection, dismissing the Target Inspector popup and its marker — the only way to
      // deselect, since Terrain's own onContextMenu only ever sets a new selectedCell.
      onPointerMissed={() => useDrishti.getState().selectCell(null)}
    >
      <CameraRig />
      <SceneFog />
      {/* No ambient fill on the terrain states — mostly dark, the ore ramp provides the
          light. SceneLights owns both lights and turns them up only in GLOBE. */}
      <SceneLights />
      <Suspense fallback={null}>
        <Globe />
        <StarField />
        <Satellites />
        <Terrain />
        <MineMarkers />
        <VoxelField />
        <DepthRuler />
        <DrillTrace />
        <Effects />
      </Suspense>
    </Canvas>
  );
}

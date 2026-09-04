import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DataTexture,
  RedFormat,
  FloatType,
  ShaderMaterial,
  DoubleSide,
  PlaneGeometry,
  LinearFilter,
  MeshBasicMaterial,
  TextureLoader,
  SRGBColorSpace,
  ClampToEdgeWrapping,
  type Texture,
} from 'three';
import { Html } from '@react-three/drei';
import { useSiteData } from './Canvas3D';
import { useDrishti } from '../store/useDrishti';
import { GRID, WORLD_SIZE, worldToLonLat, worldToGrid } from '../lib/geo';
import { ELEV_MIN, ELEV_MAX, VE_RELIEF } from '../lib/terrainConstants';
import { smoothstep as smoothstepJs } from '../lib/easing';
import oreRampGlsl from './shaders/oreRamp.glsl?raw';
import terrainVert from './shaders/terrain.vert.glsl?raw';
import terrainFragBody from './shaders/terrain.frag.glsl?raw';

function toTexture(data: Float32Array, min: number, max: number) {
  const normalized = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) normalized[i] = (data[i] - min) / (max - min);
  const tex = new DataTexture(normalized, GRID, GRID, RedFormat, FloatType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * public/data/sausar-belt-satellite.jpg (see ScenePreview.tsx for provenance/date) is a real
 * pixel-for-pixel crop of the SAME bbox lib/geo.ts's BBOX describes, so its UV space lines up
 * with the elevation/prospectivity DataTextures with no extra transform needed. Loaded once,
 * shared across every Terrain mount — TextureLoader's default flipY=true is what reconciles
 * the image file's row-0-is-north layout with the DataTextures' row-0-is-south one (both
 * verified by inspection, not assumed); colorSpace is set explicitly because a raw
 * ShaderMaterial does not auto-decode sRGB the way a built-in material's `map` does.
 */
let sharedSatelliteTex: Texture | null = null;
function getSatelliteTexture(): Texture {
  if (!sharedSatelliteTex) {
    sharedSatelliteTex = new TextureLoader().load('/data/sausar-belt-satellite.jpg');
    sharedSatelliteTex.colorSpace = SRGBColorSpace;
    sharedSatelliteTex.minFilter = LinearFilter;
    sharedSatelliteTex.magFilter = LinearFilter;
    sharedSatelliteTex.wrapS = ClampToEdgeWrapping;
    sharedSatelliteTex.wrapT = ClampToEdgeWrapping;
  }
  return sharedSatelliteTex;
}

let lastHoverAt = 0;

export function Terrain() {
  const site = useSiteData();
  const view = useDrishti((s) => s.view);
  const drape = useDrishti((s) => s.drape);
  const veRef = useRef(0);
  const drapeRef = useRef(0);
  const dissolveRef = useRef(0);
  const ceilingRef = useRef(1);
  const fadeElapsed = useRef(1000); // starts "already faded in"
  const lastViewForFade = useRef(view);

  const textures = useMemo(() => {
    if (!site) return null;
    return {
      elevation: toTexture(site.elevation, ELEV_MIN, ELEV_MAX),
      prospectivity: toTexture(site.prospectivity, 0, 1),
      confidence: toTexture(site.confidence, 0, 1),
      satellite: getSatelliteTexture(),
    };
  }, [site]);

  const material = useMemo(() => {
    if (!textures) return null;
    return new ShaderMaterial({
      uniforms: {
        uElevationTex: { value: textures.elevation },
        uProspectivityTex: { value: textures.prospectivity },
        uConfidenceTex: { value: textures.confidence },
        uSatelliteTex: { value: textures.satellite },
        uElevMin: { value: ELEV_MIN },
        uElevMax: { value: ELEV_MAX },
        uVerticalExaggeration: { value: 0 },
        uDrapeMix: { value: 0 },
        uDissolve: { value: 0 },
        uCeilingOpacity: { value: 1 },
        uEntryFade: { value: 1 },
      },
      vertexShader: terrainVert,
      fragmentShader: oreRampGlsl + '\n' + terrainFragBody,
      side: DoubleSide,
      transparent: true,
    });
  }, [textures]);

  useEffect(() => () => material?.dispose(), [material]);

  const geometry = useMemo(() => new PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 255, 255), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // SUBSURFACE ceiling wireframe: a CPU-displaced copy of the same surface, registered
  // exactly to the shaded terrain via the shared terrainSurfaceY formula, so it reads as
  // the underside of one ceiling rather than a separate floating mesh.
  const ceilingWireGeometry = useMemo(() => {
    if (!site) return null;
    const geo = new PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 255, 255);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const gx = i % GRID;
      const gz = Math.floor(i / GRID);
      const elevMeters = site.elevation[gz * GRID + gx];
      pos.setZ(i, pos.getZ(i) + (elevMeters - ELEV_MIN) * VE_RELIEF * 0.15);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [site]);
  useEffect(() => () => ceilingWireGeometry?.dispose(), [ceilingWireGeometry]);

  const ceilingWireMaterial = useMemo(
    () => new MeshBasicMaterial({ color: 0x566472, wireframe: true, transparent: true, opacity: 0.5 }),
    [],
  );
  useEffect(() => () => ceilingWireMaterial.dispose(), [ceilingWireMaterial]);

  useFrame((_, delta) => {
    if (!material) return;

    const targetVE = view === 'FLAT' ? 0 : VE_RELIEF;
    veRef.current += (targetVE - veRef.current) * Math.min(1, delta * 3);
    material.uniforms.uVerticalExaggeration.value = veRef.current;

    const targetDrape = drape === 'CONFIDENCE' ? 1 : 0;
    drapeRef.current += (targetDrape - drapeRef.current) * Math.min(1, delta * 2.4);
    material.uniforms.uDrapeMix.value = drapeRef.current;

    // BLOCK erodes the surface as the bloom runs; SUBSURFACE is a distinct mode — a
    // translucent ceiling, not a continuation of the erosion — so it forces dissolve back to 0.
    const blockBloomProgress = useDrishti.getState().blockBloomProgress;
    const targetDissolve = view === 'BLOCK' ? smoothstepJs(0, 0.4, blockBloomProgress) : 0;
    dissolveRef.current += (targetDissolve - dissolveRef.current) * Math.min(1, delta * 6);
    material.uniforms.uDissolve.value = dissolveRef.current;

    const targetCeiling = view === 'SUBSURFACE' ? 0.12 : 1;
    ceilingRef.current += (targetCeiling - ceilingRef.current) * Math.min(1, delta * 3);
    material.uniforms.uCeilingOpacity.value = ceilingRef.current;

    if (lastViewForFade.current === 'GLOBE' && view !== 'GLOBE' && fadeElapsed.current > 400) {
      fadeElapsed.current = 0;
    }
    lastViewForFade.current = view;
    fadeElapsed.current += delta * 1000;
    material.uniforms.uEntryFade.value = Math.min(1, fadeElapsed.current / 400);
  });

  const visible = view === 'FLAT' || view === 'RELIEF' || view === 'BLOCK' || view === 'SUBSURFACE';
  if (!material || !visible) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh
        geometry={geometry}
        material={material}
        onPointerMove={(e) => {
          // FLAT only — the geometry here is the flat, undisplaced plane, which is exactly
          // what's on screen in FLAT (V.E. 0). RELIEF picking is handled below instead: its
          // visible surface is elevation-displaced in the vertex shader (GPU-only, never
          // written back to this BufferGeometry), so raycasting against this same flat
          // geometry there would hit a different (x,z) than the elevated surface the cursor
          // is actually resting on — worse the steeper the slope and the more oblique the
          // camera angle, which is what read as "the mark is a few px from where I clicked."
          if (view !== 'FLAT') return;
          const now = performance.now();
          if (now - lastHoverAt < 33) return; // 30Hz throttle
          lastHoverAt = now;
          const [lon, lat] = worldToLonLat(e.point.x, e.point.z);
          const [gx, gz] = worldToGrid(e.point.x, e.point.z);
          useDrishti.getState().hoverCellAt({ gx, gz, lon, lat });
        }}
        onContextMenu={(e) => {
          // Right-click to inspect — left click is reserved for camera orbit, so a target
          // pick needs its own gesture. CameraRig already suppresses the browser's native
          // right-click menu on this canvas.
          if (view !== 'FLAT') return;
          e.nativeEvent.preventDefault();
          const [lon, lat] = worldToLonLat(e.point.x, e.point.z);
          const [gx, gz] = worldToGrid(e.point.x, e.point.z);
          useDrishti.getState().selectCell({ gx, gz, lon, lat, y: e.point.y });
          useDrishti.getState().setView('RELIEF');
        }}
      />
      {view === 'RELIEF' && ceilingWireGeometry && (
        // Picks against ceilingWireGeometry — the same CPU copy of the surface, displaced by
        // the exact terrainSurfaceY formula, that the SUBSURFACE ceiling wireframe below
        // already uses — so RELIEF's raycast lands on the elevated surface actually on
        // screen instead of the flat proxy above. Fully transparent rather than
        // `visible={false}`: three.js's raycaster skips invisible objects outright.
        <mesh
          geometry={ceilingWireGeometry}
          onPointerMove={(e) => {
            const now = performance.now();
            if (now - lastHoverAt < 33) return; // 30Hz throttle
            lastHoverAt = now;
            const [lon, lat] = worldToLonLat(e.point.x, e.point.z);
            const [gx, gz] = worldToGrid(e.point.x, e.point.z);
            useDrishti.getState().hoverCellAt({ gx, gz, lon, lat });
          }}
          onContextMenu={(e) => {
            e.nativeEvent.preventDefault();
            const [lon, lat] = worldToLonLat(e.point.x, e.point.z);
            const [gx, gz] = worldToGrid(e.point.x, e.point.z);
            // e.point.y is the exact, continuously-interpolated hit point on this pick mesh —
            // ground truth for the marker's height. The alternative, terrainSurfaceY() of the
            // nearest grid cell's stored elevation, snaps to one of 256×256 discrete samples
            // and can be visibly wrong on a slope, which is what "the mark is a few px from
            // where I clicked" turned out to actually be once flat-vs-elevated picking (above)
            // was already fixed.
            useDrishti.getState().selectCell({ gx, gz, lon, lat, y: e.point.y });
          }}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
        </mesh>
      )}
      {view === 'SUBSURFACE' && ceilingWireGeometry && (
        <mesh geometry={ceilingWireGeometry} material={ceilingWireMaterial} />
      )}
      {view === 'RELIEF' && (
        <Html position={[-WORLD_SIZE / 2 + 40, 0, WORLD_SIZE / 2 - 20]} transform={false} style={{ pointerEvents: 'none' }}>
          <div className="mono" style={{ color: 'var(--text-mute)', fontSize: 12 }}>
            V.E. {VE_RELIEF.toFixed(1)}×
          </div>
        </Html>
      )}
    </group>
  );
}

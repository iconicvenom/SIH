import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  SphereGeometry,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  TextureLoader,
  SRGBColorSpace,
  type Group,
  BackSide,
  ShaderMaterial,
} from 'three';
import { Html } from '@react-three/drei';
import { useDrishti } from '../store/useDrishti';
import { BBOX, lonLatToNormal } from '../lib/geo';
import { MINES } from '../data/mines';
import oreRampGlsl from '../scene/shaders/oreRamp.glsl?raw';

/* ============================================================================================
 * Real colour AND real relief, together: earth-color.jpg (NASA Blue Marble-derived) sampled
 * per-FRAGMENT via a proper texture map — not the old per-vertex-colour build, which capped
 * colour resolution at the mesh's 256x128 vertex grid — and earth-elevation.png driving BOTH a
 * true GPU vertex displacement (displacementMap: real geometric relief, at the mesh's actual
 * vertex density) and a bump map (per-fragment lighting detail finer than that vertex grid).
 * The globe is stationary and framed on India (CameraRig.tsx's GLOBE preset) rather than
 * auto-rotating and showing the whole planet — at that framing, real elevation reads as real
 * terrain instead of distorting the whole sphere's silhouette, which is what made a full-globe
 * view of the same relief read as "too long" earlier.
 * ============================================================================================ */

const BALAGHAT = MINES.find((m) => m.id === 'balaghat')!;
/** Ties the vertex displacement, the bump shading and the pin's own resting height to one
 *  number — how far a purely gained/lost byte of the elevation texture pushes the surface,
 *  in world units (sphere radius 1). */
const EXAGGERATION = 0.035;

const COLOR_URL = '/data/earth-color.jpg';
const ELEVATION_URL = '/data/earth-elevation.png';

/** Standard equirectangular mapping — image top edge is the north pole, left edge is lon -180,
 *  matching how earth-color.jpg / earth-elevation.png (and SphereGeometry's own default UVs,
 *  and virtually every Earth texture) are laid out. */
function lonLatToUV(lon: number, lat: number): [number, number] {
  return [(lon + 180) / 360, (90 - lat) / 180];
}

/** One-time CPU read of a single elevation texel — only the pin needs an actual elevation
 *  NUMBER (to know how far to sit above the now-really-displaced surface); everything else
 *  the elevation texture drives happens on the GPU via displacementMap/bumpMap. */
function useElevationAt(lon: number, lat: number): number {
  const [elev, setElev] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const [u, v] = lonLatToUV(lon, lat);
      const x = Math.min(canvas.width - 1, Math.max(0, Math.round(u * (canvas.width - 1))));
      const y = Math.min(canvas.height - 1, Math.max(0, Math.round(v * (canvas.height - 1))));
      const byte01 = ctx.getImageData(x, y, 1, 1).data[0] / 255;
      setElev(byte01 * 2 - 1);
    };
    img.src = ELEVATION_URL;
    return () => {
      cancelled = true;
    };
  }, [lon, lat]);
  return elev;
}

const ATMOSPHERE_VERT = `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const ATMOSPHERE_FRAG = `
varying vec3 vNormal;
void main() {
  float fresnel = pow(1.0 - abs(vNormal.z), 2.5);
  gl_FragColor = vec4(vec3(0.180, 0.490, 0.549), fresnel * 0.35);
}
`;

const UP = new Vector3(0, 1, 0);

/** The globe no longer spins, but this stays at 0 rather than being deleted — GlobeCallouts
 *  and anything else that has to project a fixed lon/lat onto the textured surface still reads
 *  it, and a stationary globe is just the case where this never advances. */
export const globeRotationY = { current: 0 };

export function Globe() {
  const view = useDrishti((s) => s.view);
  const setView = useDrishti((s) => s.setView);
  const groupRef = useRef<Group>(null);
  const elapsedSinceLeft = useRef(0);
  const wasGlobe = useRef(true);

  const geometry = useMemo(() => new SphereGeometry(1, 256, 128), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(() => {
    const colorTex = new TextureLoader().load(COLOR_URL);
    colorTex.colorSpace = SRGBColorSpace;
    // The elevation texture is a height field, not a colour photo — no sRGB decode belongs on
    // it; both displacementMap and bumpMap read it as raw linear greyscale.
    const elevationTex = new TextureLoader().load(ELEVATION_URL);

    const mat = new MeshStandardMaterial({
      map: colorTex,
      displacementMap: elevationTex,
      // byte 0..1 -> signed -EXAGGERATION..+EXAGGERATION, oceans pushed in, mountains pushed
      // out, the same signed convention the original build used.
      displacementScale: EXAGGERATION * 2,
      displacementBias: -EXAGGERATION,
      // displacementMap moves vertices but does not itself recompute the lighting normal from
      // the new shape — the bump map is what keeps shading responding correctly to relief
      // finer than the 256x128 vertex grid, filling exactly that gap.
      bumpMap: elevationTex,
      bumpScale: 0.02,
      roughness: 0.85,
      transparent: true,
    });

    // The one place on the planet that gets the ore ramp instead of real colour — the known
    // manganese province glowing against a realistically-coloured Earth. MeshStandardMaterial
    // has no "recolour this lon/lat rectangle" knob, so this is injected directly into its
    // compiled fragment shader rather than reverting to a hand-built per-vertex material.
    const [uMin, vMax] = lonLatToUV(BBOX.lonMin, BBOX.latMax); // lat max -> smaller v (north)
    const [uMax, vMin] = lonLatToUV(BBOX.lonMax, BBOX.latMin);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSausarUV = { value: [uMin, uMax, vMin, vMax] };
      shader.uniforms.uElevTex = { value: elevationTex };
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec4 uSausarUV;
          uniform sampler2D uElevTex;
          ${oreRampGlsl}
          // The ore ramp's stops are sRGB bytes (see lib/ramp.ts's own doc comment) but
          // diffuseColor is already linear by this point in the chunk order — texture2D on an
          // SRGBColorSpace texture is decoded transparently by the GPU. Skipping this would
          // reproduce the exact "sRGB read as linear -> too dark" bug fixed earlier on this
          // same globe.
          vec3 srgbToLinear(vec3 c) {
            vec3 lo = c / 12.92;
            vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
            return mix(lo, hi, step(0.04045, c));
          }`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          // vMapUv, not the generic vUv — three.js's per-texture UV-channel varyings mean the
          // one attached to \`map\` specifically is named for it.
          if (vMapUv.x >= uSausarUV.x && vMapUv.x <= uSausarUV.y && vMapUv.y >= uSausarUV.z && vMapUv.y <= uSausarUV.w) {
            float elev = texture2D(uElevTex, vMapUv).r * 2.0 - 1.0;
            diffuseColor.rgb = srgbToLinear(oreRamp(0.55 + elev * 0.45));
          }`,
        );
    };
    return mat;
  }, []);
  useEffect(() => () => material.dispose(), [material]);

  const atmosphereMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: ATMOSPHERE_VERT,
        fragmentShader: ATMOSPHERE_FRAG,
        transparent: true,
        side: BackSide,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => atmosphereMaterial.dispose(), [atmosphereMaterial]);

  useFrame((_, delta) => {
    if (view === 'GLOBE') {
      material.opacity = 1;
      wasGlobe.current = true;
      elapsedSinceLeft.current = 0;
    } else if (wasGlobe.current) {
      elapsedSinceLeft.current += delta * 1000;
      material.opacity = Math.max(0, 1 - elapsedSinceLeft.current / 400);
      if (elapsedSinceLeft.current >= 400) wasGlobe.current = false;
    }
  });

  const visible = view === 'GLOBE' || wasGlobe.current;
  const pinElevation = useElevationAt(BALAGHAT.lon, BALAGHAT.lat);
  if (!visible) return null;

  const [pnx, pny, pnz] = lonLatToNormal(BALAGHAT.lon, BALAGHAT.lat);
  const pinHeight = 0.05;
  const pinSurfaceRadius = 1 + pinElevation * EXAGGERATION;
  const pinRadius = pinSurfaceRadius + pinHeight / 2;
  // Orient the needle along the true local outward normal, not world-up.
  const pinNormal = new Vector3(pnx, pny, pnz);
  const pinQuaternion = new Quaternion().setFromUnitVectors(UP, pinNormal);

  return (
    <group>
      {/* Stationary now — no rotation.y increment — but kept as its own group (rather than
          folding the mesh up a level) so the pin stays a sibling positioned in the same
          surface-relative frame the rotating build used, and re-introducing motion later is a
          one-line change, not a re-plumb. */}
      <group ref={groupRef}>
        <mesh geometry={geometry} material={material} />
        {view === 'GLOBE' && <mesh geometry={geometry} material={atmosphereMaterial} scale={1.12} />}
        <mesh
          position={[pnx * pinRadius, pny * pinRadius, pnz * pinRadius]}
          quaternion={pinQuaternion}
          onClick={(e) => {
            e.stopPropagation();
            setView('RELIEF');
          }}
        >
          <cylinderGeometry args={[0.004, 0.004, pinHeight, 6]} />
          <meshBasicMaterial color="#D96A8E" />
          {view === 'GLOBE' && (
            <Html center distanceFactor={2} style={{ pointerEvents: 'none' }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--rhodonite)', whiteSpace: 'nowrap' }}>
                BALAGHAT · ACTIVE
              </div>
            </Html>
          )}
        </mesh>
      </group>
      {view === 'GLOBE' && (
        <Html position={[-1.4, -1.2, 0]} transform={false} style={{ pointerEvents: 'none' }}>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-mute)' }}>
            V.E. {(1 / EXAGGERATION).toFixed(0)}× · real colour + relief, exaggerated
          </div>
        </Html>
      )}
    </group>
  );
}

import { useEffect, useMemo } from 'react';
import { BufferGeometry, BufferAttribute, ShaderMaterial, AdditiveBlending } from 'three';
import seedrandom from 'seedrandom';
import { useDrishti } from '../store/useDrishti';

/**
 * Real starfields read as varied, not uniform: most stars are faint, a few are bright, and
 * colour runs from cool blue-white through to warm amber depending on the star's temperature.
 * 2000 identical grey same-size dots is what was reading as fake, not the lack of animation —
 * static is correct (Part I: a fast-spinning, twinkling globe reads as a screensaver), variety
 * is what was missing. A custom point shader is what makes per-star size/colour/soft-edge
 * possible at all — PointsMaterial has no per-vertex size and only draws hard square dots.
 */
const STAR_VERT = `
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize;
}
`;
const STAR_FRAG = `
varying vec3 vColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  // Soft core with a gentle falloff, not a hard-edged disc — reads as a point of light
  // rather than a sprite.
  float alpha = smoothstep(0.5, 0.05, r);
  gl_FragColor = vec4(vColor, alpha);
}
`;

/** Cool blue-white through neutral white to warm amber, weighted toward white/blue the way a
 *  real naked-eye star field mostly is — hot young stars are more common in a random patch of
 *  sky than deep-red giants are bright enough to notice. */
function starColor(rng: () => number): [number, number, number] {
  const t = Math.pow(rng(), 1.6); // biased toward 0 (blue/white) over 1 (amber)
  const cool: [number, number, number] = [0.72, 0.8, 1.0];
  const warm: [number, number, number] = [1.0, 0.82, 0.62];
  return [cool[0] + (warm[0] - cool[0]) * t, cool[1] + (warm[1] - cool[1]) * t, cool[2] + (warm[2] - cool[2]) * t];
}

export function StarField() {
  const view = useDrishti((s) => s.view);

  const geometry = useMemo(() => {
    const rng = seedrandom('26009-stars');
    const count = 2600;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const r = 8;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Power-law magnitude distribution: mostly faint pinpricks, a handful of bright stars —
      // a real dark-sky field, not a uniform scatter.
      const mag = Math.pow(rng(), 3.2);
      sizes[i] = 0.6 + mag * 3.2;

      const [cr, cg, cb] = starColor(rng);
      const brightness = 0.35 + mag * 0.65;
      colors[i * 3] = cr * brightness;
      colors[i * 3 + 1] = cg * brightness;
      colors[i * 3 + 2] = cb * brightness;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geo.setAttribute('aColor', new BufferAttribute(colors, 3));
    return geo;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  if (view !== 'GLOBE') return null;
  return <points geometry={geometry} material={material} />;
}

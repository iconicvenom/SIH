/**
 * Pure easing helpers. No state, no time source, no allocation — safe to call inside
 * useFrame. easeOutBack is duplicated in src/scene/shaders/voxel.vert.glsl because the
 * per-instance stagger has to be evaluated on the GPU; keep the two in agreement.
 */

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Decisive arrival, no bounce. The default for camera and panel entrances. */
export function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Overshoots past 1 then settles. Used for the voxel bloom so cubes land with weight.
 * `overshoot` is the classic `s` term; 1.15 is a restrained overshoot for an instrument.
 */
export function easeOutBack(t: number, overshoot = 1.15): number {
  const f = t - 1;
  return 1 + (overshoot + 1) * f * f * f + overshoot * f * f;
}

/** GLSL-compatible smoothstep. Returns 0 below e0, 1 above e1, Hermite in between. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

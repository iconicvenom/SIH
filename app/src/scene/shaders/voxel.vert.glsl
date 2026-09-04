// VOXEL VERTEX — the block-model bloom.
//
// Intended for a THREE.ShaderMaterial over an InstancedBufferGeometry. three.js prepends
// `position`, `modelViewMatrix` and `projectionMatrix`; the a* attributes below are the
// per-instance buffers the component supplies.
//
// Every cube starts life sitting on the terrain surface (aSourcePos, computed on the CPU
// with terrainSurfaceY() so it matches terrain.vert.glsl exactly) and flies to its true
// position in the block model (aTargetPos). aDelay staggers the instances so the field
// unpacks as a wave rather than a single pop.
//
// Timing: an instance's motion occupies 0.3 of uProgress, starting at aDelay * 0.7. With
// aDelay in 0..1 the last cube starts at 0.7 and everything has landed exactly at 1.0.

uniform float uProgress;

attribute float aProbability;
attribute float aConfidence;
attribute float aDelay;
attribute vec3 aTargetPos;
attribute vec3 aSourcePos;
attribute float aDepthIndex;

varying float vProbability;
varying float vConfidence;
varying float vDepthIndex;
varying vec3 vLocalPos;

// Twin of easeOutBack() in src/lib/easing.ts, overshoot 1.15.
// Deliberately overshoots past 1.0 so mix() extrapolates slightly beyond aTargetPos and
// the cubes land with weight instead of gliding to a stop.
float easeOutBack(float t) {
  float s = 1.15;
  float f = t - 1.0;
  return 1.0 + (s + 1.0) * f * f * f + s * f * f;
}

void main() {
  vProbability = aProbability;
  vConfidence = aConfidence;
  vDepthIndex = aDepthIndex;
  vLocalPos = position;

  float localT = clamp((uProgress - aDelay * 0.7) / 0.3, 0.0, 1.0);
  float eased = easeOutBack(localT);

  vec3 worldPos = position + mix(aSourcePos, aTargetPos, eased);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}

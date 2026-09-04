// TERRAIN VERTEX — displaces a flat plane by the Sausar Belt elevation raster.
//
// Intended for a THREE.ShaderMaterial, which prepends the built-in attributes
// (position, uv) and matrices (modelViewMatrix, projectionMatrix). Do not redeclare them.
//
// The component rotates this mesh -90deg about X, which maps local +Z onto world +Y.
// So the displacement below is applied to position.z, not position.y.
//
// uElevationTex stores normalised elevation in the red channel: 0 => uElevMin metres,
// 1 => uElevMax metres. Decoding to metres first is deliberate — it makes the line below
// character-for-character the same formula as terrainSurfaceY() in
// src/lib/terrainConstants.ts, which is what the voxel bloom's continuity depends on.
// If you change one, change the other in the same commit.

uniform sampler2D uElevationTex;
uniform float uElevMin;
uniform float uElevMax;
uniform float uVerticalExaggeration;

varying vec2 vUv;
varying float vElevation01;

void main() {
  vUv = uv;

  float e01 = clamp(texture2D(uElevationTex, uv).r, 0.0, 1.0);
  vElevation01 = e01;

  float elevMeters = uElevMin + e01 * (uElevMax - uElevMin);

  vec3 displaced = position;
  displaced.z += (elevMeters - uElevMin) * uVerticalExaggeration * 0.15;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}

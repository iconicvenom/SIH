// ORE RAMP — GPU twin of rampColor() in src/lib/ramp.ts.
//
// This file declares no uniforms and uses no #include. It is string-concatenated as a
// prelude onto fragment shader bodies (terrain.frag.glsl, voxel.frag.glsl), so it must
// stand alone and must not collide with those files' identifiers.
//
// STOPS — diff these by eye against ORE_STOPS in src/lib/ramp.ts:
//   0.0  #16202E   ( 22,  32,  46)   pyrolusite steel
//   0.2  #1E4A5F   ( 30,  74,  95)
//   0.4  #2E7D8C   ( 46, 125, 140)
//   0.6  #C9A227   (201, 162,  39)   gondite ochre
//   0.8  #E2622A   (226,  98,  42)   braunite ember
//   1.0  #F7E0A8   (247, 224, 168)
//
// Written as explicit mix() branches rather than a texture lookup or a loop so the
// correspondence to the table above is literal and unmissable.

vec3 oreRamp(float t) {
  float x = clamp(t, 0.0, 1.0);

  vec3 s0 = vec3( 22.0, 32.0,  46.0) / 255.0; // #16202E
  vec3 s1 = vec3( 30.0, 74.0,  95.0) / 255.0; // #1E4A5F
  vec3 s2 = vec3( 46.0, 125.0, 140.0) / 255.0; // #2E7D8C
  vec3 s3 = vec3(201.0, 162.0,  39.0) / 255.0; // #C9A227
  vec3 s4 = vec3(226.0,  98.0,  42.0) / 255.0; // #E2622A
  vec3 s5 = vec3(247.0, 224.0, 168.0) / 255.0; // #F7E0A8

  if (x < 0.2) return mix(s0, s1, (x - 0.0) / 0.2);
  if (x < 0.4) return mix(s1, s2, (x - 0.2) / 0.2);
  if (x < 0.6) return mix(s2, s3, (x - 0.4) / 0.2);
  if (x < 0.8) return mix(s3, s4, (x - 0.6) / 0.2);
  return mix(s4, s5, (x - 0.8) / 0.2);
}

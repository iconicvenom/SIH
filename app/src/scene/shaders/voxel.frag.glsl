// VOXEL FRAGMENT — BODY ONLY.
//
// oreRamp.glsl is concatenated in front of this file at build time, so oreRamp() is
// already in scope. Do not define it here and do not #include anything.
//
// CRITICAL: cutoff and depth filtering happen HERE, via discard. The instance buffers are
// built once and never rebuilt. Dragging the cutoff or depth slider must be a uniform
// write, not a geometry upload — otherwise the interaction drops frames and the whole
// "live model" claim falls apart in front of the judges.

uniform float uCutoff;
uniform float uDepthMin;      // metres
uniform float uDepthMax;      // metres
uniform float uBlockW;        // block footprint, world units
uniform float uBlockH;        // block height, world units
uniform float uLowProbFade;   // > 0.5 enables the low-probability alpha ramp

varying float vProbability;
varying float vConfidence;
varying float vDepthIndex;
varying vec3 vLocalPos;

void main() {
  // --- filtering, before any shading work ---
  if (vProbability < uCutoff) discard;

  float depthMeters = vDepthIndex * 10.0 + 5.0; // 10 m benches, sampled at bench centre
  if (depthMeters < uDepthMin || depthMeters > uDepthMax) discard;

  // --- base colour ---
  vec3 color = oreRamp(vProbability);

  // Cubed so ONLY genuinely high-probability blocks lift off the floor. At p=0.3 this is
  // +5%; at p=1.0 it is +180%. Most of the field has to stay dark steel or nothing reads
  // as a target.
  float emissive = pow(vProbability, 3.0) * 1.8;
  color *= (1.0 + emissive);

  // Low confidence pushes a block back toward the murk without changing its hue, so the
  // ore ramp still means exactly one thing.
  color *= (0.4 + 0.6 * clamp(vConfidence, 0.0, 1.0));

  // --- edge definition ---
  // Normalised distance to each face plane; the median of the three is ~1 only where two
  // faces meet, i.e. on a cube edge. Without this the field reads as mush at scale.
  vec3 n = abs(vLocalPos) / vec3(uBlockW * 0.5, uBlockH * 0.5, uBlockW * 0.5);
  float hi = max(max(n.x, n.y), n.z);
  float lo = min(min(n.x, n.y), n.z);
  float median = n.x + n.y + n.z - hi - lo;
  float edge = smoothstep(0.86, 0.98, median);
  color += edge * 0.35;

  // --- alpha ---
  float alpha = 1.0;
  if (uLowProbFade > 0.5) {
    alpha = mix(0.05, 1.0, smoothstep(uCutoff, 1.0, vProbability));
  }

  gl_FragColor = vec4(color, alpha);
}

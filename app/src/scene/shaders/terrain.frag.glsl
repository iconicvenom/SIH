// TERRAIN FRAGMENT — BODY ONLY.
//
// oreRamp.glsl is concatenated in front of this file at build time, so oreRamp() is
// already in scope. Do not define it here and do not #include anything.
//
// Three jobs:
//   1. drape either prospectivity (ore ramp) or confidence (greyscale) on the surface
//   2. overlay elevation contours — the survey-plan signature that makes this read as an
//      instrument rather than a game terrain
//   3. erode the surface into fragments on the way out to BLOCK, so the voxel field is
//      revealed from underneath instead of cross-fading

uniform sampler2D uElevationTex;
uniform sampler2D uProspectivityTex;
uniform sampler2D uConfidenceTex;
uniform sampler2D uSatelliteTex;
uniform float uElevMin;
uniform float uElevMax;
uniform float uVerticalExaggeration;
uniform float uDrapeMix;        // 0 = prospectivity, 1 = confidence
uniform float uDissolve;        // 0 = solid, 1 = fully eroded
uniform float uCeilingOpacity;
uniform float uEntryFade;

varying vec2 vUv;
varying float vElevation01;

// GRID and WORLD_SIZE, src/lib/geo.ts — if those change, this texel spacing must too.
const float TEXEL = 1.0 / 256.0;
const float WORLD_PER_TEXEL = 1024.0 / 256.0;

// Greyscale #1A2029 -> #DCE4EC. Twin of confidenceColor() in src/lib/ramp.ts.
// Achromatic on purpose: confidence must never be mistaken for prospectivity.
vec3 confidenceRamp(float t) {
  vec3 lo = vec3( 26.0,  32.0,  41.0) / 255.0; // #1A2029
  vec3 hi = vec3(220.0, 228.0, 236.0) / 255.0; // #DCE4EC
  return mix(lo, hi, clamp(t, 0.0, 1.0));
}

// World-space displaced height at a uv, in the SAME formula terrain.vert.glsl uses to
// displace the mesh — needed so the hillshade normal matches what is actually on screen at
// the current vertical exaggeration, not the un-exaggerated raw relief.
float elevAt(vec2 uv) {
  float e01 = texture2D(uElevationTex, uv).r;
  float elevMeters = uElevMin + e01 * (uElevMax - uElevMin);
  return (elevMeters - uElevMin) * uVerticalExaggeration * 0.15;
}

float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// Bilinear value noise with a Hermite fade. Cheap, and its cell structure is what gives
// the dissolve its crumbling-rock grain rather than a soft uniform fade.
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  // --- erosion: cut fragments out before doing any shading work ---
  // The domain is advanced by uDissolve so the noise field crawls as it opens up; the
  // surface must ERODE INTO FRAGMENTS, not fade uniformly.
  if (uDissolve > 0.0) {
    float n = valueNoise(vUv * 40.0 + uDissolve * 6.0);
    if (n < uDissolve) discard;
  }

  float prospectivity = texture2D(uProspectivityTex, vUv).r;
  float confidence = texture2D(uConfidenceTex, vUv).r;
  vec3 satColor = texture2D(uSatelliteTex, vUv).rgb;

  // --- real ground, with the heatmap masked over it ---
  // The base is the actual satellite photo of this bbox (see Terrain.tsx for provenance), not
  // a flat colour field. The ore ramp / confidence ramp is masked ON TOP of it, strength tied
  // to prospectivity itself in prospectivity mode — cold ground stays legible as real terrain,
  // and the heatmap only "drills in" where the ground is actually promising, the way a real
  // GIS heat-overlay-over-basemap reads, rather than one flat colour painted over everything.
  vec3 overlay = mix(oreRamp(prospectivity), confidenceRamp(confidence), clamp(uDrapeMix, 0.0, 1.0));
  float heatMask = mix(pow(clamp(prospectivity, 0.0, 1.0), 0.85), 0.55, clamp(uDrapeMix, 0.0, 1.0));
  vec3 color = mix(satColor, overlay, heatMask);

  // --- hillshade ---
  // The drape above is a flat, unlit colour lookup — deliberately, so it "reads as an
  // instrument" rather than a rendered game landscape. But a flat colour alone cannot show
  // relief, only silhouette: no amount of terrain detail underneath it will look like height
  // and depth without SOME normal-dependent shading. A cheap analytic normal from the
  // elevation texture itself (full 256x256 resolution, independent of the mesh's own vertex
  // spacing) multiplied gently into the drape colour is the standard GIS answer to this —
  // hillshade-under-a-choropleth, not a departure from "instrument" but the way every real
  // one is actually drawn.
  float hL = elevAt(vUv - vec2(TEXEL, 0.0));
  float hR = elevAt(vUv + vec2(TEXEL, 0.0));
  float hD = elevAt(vUv - vec2(0.0, TEXEL));
  float hU = elevAt(vUv + vec2(0.0, TEXEL));
  vec3 terrainNormal = normalize(vec3(hL - hR, 2.0 * WORLD_PER_TEXEL, hD - hU));
  vec3 lightDir = normalize(vec3(0.45, 0.78, 0.35));
  float ndotl = max(0.0, dot(terrainNormal, lightDir));
  color *= 0.66 + 0.52 * ndotl;

  // --- contour overlay ---
  // 14 index bands across the elevation range. min(b, 1-b) is the distance to the nearest
  // band boundary, so the smoothstep resolves to a thin line on the contour itself.
  float band = fract(vElevation01 * 14.0);
  float toEdge = min(band, 1.0 - band);
  float contour = 1.0 - smoothstep(0.0, 0.035, toEdge);

  vec3 ink = vec3(201.0, 211.0, 221.0) / 255.0; // --text
  color = mix(color, ink, contour * 0.08);

  gl_FragColor = vec4(color, uCeilingOpacity * uEntryFade);
}

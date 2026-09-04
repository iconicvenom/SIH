# DRISHTI 3D — Build Specification

**Give this entire document to your coding agent as the brief. Build it in the order given in §14.**

---

## 0. WHAT YOU ARE BUILDING

A single-page web application called **DRISHTI** — a manganese exploration and mine-production
decision surface for MOIL Ltd, built for Smart India Hackathon 2026, problem statement 26009.

The application has **one continuous visual journey across four states**. It is not four pages.
It is one scene that transforms, with the camera and the data persisting across every transition.

```
STATE 1              STATE 2              STATE 3              STATE 4
FLAT                 RELIEF               BLOCK                SUBSURFACE
2D prospectivity  →  3D terrain with   →  terrain shatters  →  camera descends
heatmap on a         prospectivity        into a voxel         below ground,
real basemap         draped over          block model          orebody glows
                     real elevation                            in the dark
```

Every state must carry a factual claim, not just a visual effect. The claims are stated in each
section below. **If a visual does not carry a claim, delete it.** A judge who says "pretty, but
what does it prove" has beaten you.

### The single most important technical fact

Real mining software — Datamine, Surpac, Vulcan — represents orebodies as **block models**:
regular 3D grids of cubes, each carrying grade, tonnage and confidence. The cubic explosion is
not a science-fiction flourish. **It is the industry-standard data structure.** Build it as a
genuine block model with genuine per-block attributes, and the flashiest moment in the demo is
also the most technically legitimate one. Say this out loud during the pitch.

---

## 1. TECH STACK — LOCKED, DO NOT SUBSTITUTE

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite + React 18 + TypeScript | strict mode on |
| 3D | three.js via `@react-three/fiber` + `@react-three/drei` | one canvas, states 2–4 |
| 2D map | MapLibre GL JS + `deck.gl` (`@deck.gl/react`, `@deck.gl/aggregation-layers`) | state 1 only |
| State | Zustand | single store, see §5 |
| Animation | `framer-motion` for DOM, `@react-spring/three` for scene | |
| Charts | Recharts | dashboard widgets only |
| Styling | Tailwind CSS + CSS variables for tokens | |
| Noise / data gen | `simplex-noise`, `seedrandom` | deterministic, seed = 26009 |
| Colour ramps | `d3-scale`, `d3-interpolate` | |

No backend for the prototype. All data is generated client-side at boot by a deterministic
generator (§4) and served from an in-memory store behind an async facade, so swapping in a real
FastAPI endpoint later is a one-file change.

**Do not use:** Cesium (too heavy, slow first paint), Mapbox GL (licence), any paid tile
provider. Basemap is MapLibre with a free raster or vector style.

---

## 2. DESIGN SYSTEM

### 2.1 Direction

The visual language is a **core shed at night**: instrument readouts, survey plans, drill-core
strip logs. Dark, precise, high-contrast, with warmth coming only from the ore itself. The
interface is cold steel; the mineral is the only thing that glows.

Do not build a generic "dark dashboard with neon cyan." The palette below is derived from the
actual minerals of the Sausar Group — braunite, pyrolusite, gondite, rhodonite — and every
accent must trace back to it.

### 2.2 Colour tokens

```css
:root {
  /* surfaces — cold, desaturated, steel */
  --void:        #0B0E12;   /* page background, deep space of the 3D scene */
  --panel:       #141920;   /* widget and panel fill */
  --panel-hi:    #1B2husband129;  /* hover, raised */
  --line:        #232B36;   /* hairlines, borders */
  --line-hi:     #34404F;   /* active borders */

  /* type */
  --text:        #C9D3DD;   /* primary */
  --text-dim:    #8493A2;   /* secondary */
  --text-mute:   #566472;   /* tertiary, axis labels */

  /* ORE RAMP — the sequential scale for prospectivity, 0 → 1.
     Derived from manganese mineralogy: steel-grey pyrolusite through
     ochre gondite to ember-hot braunite. Use ONLY this ramp for
     prospectivity. Never rainbow, never viridis. */
  --ore-00:      #16202E;   /* 0.0  barren, near-background */
  --ore-20:      #1E4A5F;   /* 0.2  steel blue */
  --ore-40:      #2E7D8C;   /* 0.4  teal */
  --ore-60:      #C9A227;   /* 0.6  ochre */
  --ore-80:      #E2622A;   /* 0.8  ember */
  --ore-100:     #F7E0A8;   /* 1.0  hot core, near-white */

  /* singular accent — rhodonite, a real Sausar Group vein mineral.
     Used ONLY for the currently selected target. Nothing else.
     This is the one pink in the entire application. */
  --rhodonite:   #D96A8E;

  /* semantic — operations side only */
  --risk-low:    #3E8E6B;
  --risk-mid:    #C9A227;
  --risk-high:   #C4482E;
}
```

> **Fix the typo above before use:** `--panel-hi: #1B2129;`

### 2.3 Typography

```
Display / headings   Space Grotesk        600, tight tracking (-0.02em)
Body / UI labels     IBM Plex Sans        400 / 600
Data readouts        IBM Plex Mono        400 / 500, tabular figures
```

Load from Google Fonts. Every number that represents a measurement — coordinates, probability,
tonnage, depth, confidence — is set in **IBM Plex Mono**. This is not decoration: monospace
figures stop values jittering as they animate, and it reads as instrumentation.

Type scale: `11 / 12 / 14 / 16 / 20 / 28 / 40`, line-height 1.35 for body, 1.05 for display.

Uppercase with `letter-spacing: 0.14em` for panel labels only, never for sentences.

### 2.4 Geometry and motion

- Border radius: `2px` on panels, `0` on data cells, `50%` on status dots only. Sharp. Survey
  plan, not consumer app.
- Hairlines are `1px solid var(--line)`. No shadows anywhere in the 2D UI. Depth comes from the
  3D scene, not from drop shadows.
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` for entrances, `cubic-bezier(0.7, 0, 0.84, 0)` for
  exits. Durations: 180ms micro, 420ms panel, 1400–2600ms scene transitions.
- Respect `prefers-reduced-motion`: skip the voxel bloom animation, jump straight to the
  final arrangement.

---

## 3. THE FOUR STATES IN DETAIL

### STATE 1 — FLAT (2D prospectivity heatmap)

**Claim it carries:** "Our model ranks the whole belt, and MOIL's known mines land inside our
high-probability zones. That's leave-one-mine-out validation, visible."

**Geography — use real coordinates.** The study area is the Sausar Group manganese belt:

```
Bounding box:   lon 79.30 → 80.35 E,  lat 21.05 → 21.95 N
Centre:         79.82 E, 21.50 N
Covers:         Nagpur + Bhandara districts (MH), edge of Balaghat (MP)
```

Known mine markers (approximate, adequate for a prototype — label them as indicative):

| Mine | Lon | Lat | Type |
|---|---|---|---|
| Kandri | 79.18 | 21.28 | underground |
| Munsar | 79.22 | 21.31 | underground |
| Beldongri | 79.15 | 21.25 | underground |
| Gumgaon | 79.12 | 21.22 | underground |
| Chikla | 79.72 | 21.48 | underground |
| Dongri Buzurg | 79.78 | 21.52 | opencast |
| Sitapatore | 79.85 | 21.44 | opencast |
| Parsoda | 79.30 | 21.34 | underground |
| Tirodi | 79.72 | 21.68 | opencast |
| Balaghat (Bharveli) | 80.18 | 21.82 | underground |
| Ukwa | 80.42 | 21.95 | underground |

Widen the bbox if needed so every marker sits inside it.

**Render:**
- MapLibre basemap, dark style, saturation reduced to near-zero. The basemap is context, not
  content — it must never compete with the ore ramp.
- deck.gl `GridLayer` or a custom `BitmapLayer` fed from the prospectivity raster, cell size
  ~500 m on screen, coloured by the ore ramp, `opacity: 0.82`.
- Mine markers as small hollow squares (`10px`, `1.5px` stroke, `--text`), with a mono label.
  Hollow, not filled — they are reference points, not data.
- A **toggle: "Show known deposits"**. This is the single most persuasive control in the whole
  application. When the judge toggles it on and MOIL's mines light up inside your hot zones,
  you have won. Make the toggle prominent, top-left of the map, and default it **off** so the
  reveal has impact.

**Interaction:** hovering a cell shows a mono tooltip — lon, lat, probability to 3 decimals,
top-3 SHAP drivers. Clicking a cell selects it and triggers the transition to State 2.

### STATE 2 — RELIEF (3D terrain)

**Claim:** "Structure is the control. The ore sits in the core of a plunging synform, and you
can see the fold in the terrain."

**Transition in (1600ms):**
1. deck.gl layer opacity → 0 over 400ms while the R3F canvas fades in beneath it at the
   matching camera position. Compute the three.js camera from the MapLibre `{center, zoom,
   pitch, bearing}` so there is **no visual jump**. This is the hardest part of the build; do
   it first and prove it before anything else.
2. Camera pitches from 0° to 52° and the terrain mesh extrudes from flat to full relief,
   vertices animating on a staggered delay radiating from the clicked point.
3. Unmount the MapLibre DOM node once opacity hits 0.

**Terrain mesh:**
- `PlaneGeometry(1024, 1024, 255, 255)` — 256×256 vertices, 65k verts, fine at 60fps.
- Displace `position.z` from the elevation array (§4.2). Vertical exaggeration `2.4×` — say so
  in the UI, in a mono caption: `V.E. 2.4×`. Never silently exaggerate.
- Custom `ShaderMaterial`. Fragment shader samples the prospectivity texture and maps through
  the ore ramp. Add a subtle contour overlay: `fract(elevation * 14.0)` thresholded to a thin
  line at 8% opacity. The contour lines are the "survey plan" signature — they make it read as
  an instrument rather than a video game.
- Rim lighting only: one `directionalLight` low on the horizon at 28°, one dim `hemisphereLight`.
  No ambient fill. The terrain should be mostly dark, with the ore ramp providing the light.

**Two heatmaps, switchable** (the user asked for this explicitly — build it as a segmented
control in the top-right of the viewport):

| Mode | What it drapes | Ramp |
|---|---|---|
| `PROSPECTIVITY` | model output, 0–1 | ore ramp |
| `CONFIDENCE` | inverse model variance, 0–1 | greyscale, `#1A2029` → `#DCE4EC` |

Cross-fade the two textures over 500ms when switched. The confidence map is the honest one —
it shows where the model is *unsure*, and volunteering it before a judge asks is a strong move.

**Interaction:** orbit (drag), zoom (wheel), pan (right-drag). Clicking the surface drops a
`rhodonite`-coloured pin and opens the target inspector panel (§6.4).

### STATE 3 — BLOCK (the voxel bloom)

**Claim:** "This is a block model — the same structure Datamine and Surpac use. Each cube is
25 m × 25 m × 10 m and carries a probability, a depth and a confidence."

**This is the signature moment of the entire prototype.** Everything else is disciplined and
quiet so that this can be loud. Spend your rendering budget here.

**Trigger:** a button in the viewport toolbar labelled **`BLOCK MODEL`** in mono caps. Not
"3D View", not "Analyze" — name it what it is.

**The animation (2600ms), staged:**

```
t=0ms      Terrain surface begins dissolving. In the fragment shader, discard
           fragments where noise(uv * 40 + time) < progress. The surface
           erodes into fragments rather than fading uniformly.

t=200ms    Voxels spawn. Each cube's initial position is its (x, z) column
           projected ONTO the terrain surface — so at t=200 the voxel field
           is visually identical to the terrain it replaces. Continuity is
           everything; if the cubes appear somewhere else, the effect dies.

t=200ms    Cubes begin travelling to their true 3D positions. Per-instance
  →1800ms  delay = distance from the clicked point / propagationSpeed, so
           the bloom radiates outward from where the user clicked. Each cube
           eases in with an overshoot (back-out, ~1.15 overshoot) and a
           slight rotation that settles to axis-aligned.

t=900ms    Cubes below the surface begin to appear, deepest last. The
  →2400ms  underground volume builds downward like strata being revealed.

t=2400ms   Grid lattice lines fade in at 12% opacity along block boundaries.
  →2600ms  Depth-scale ruler fades in on the left edge of the scene.
```

**Voxel grid:**

```
Extent:        64 (x) × 64 (z) × 24 (y, depth)   = 98,304 candidate blocks
Block size:    25 m × 25 m × 10 m  (real mining block dimensions)
Depth range:   surface → 240 m below
Culling:       render only blocks where probability > 0.28   → ~18,000–26,000 visible
Render:        ONE THREE.InstancedMesh. Never 26,000 separate meshes.
```

Per-instance attributes, uploaded as `InstancedBufferAttribute`:

```
aProbability   float    0–1, drives colour and emissive intensity
aConfidence    float    0–1, drives opacity
aDelay         float    seconds, animation stagger
aTargetPos     vec3     final position
aSourcePos     vec3     position on terrain surface at t=0
aDepthIndex    float    0–23, used for depth-slice filtering
```

**Voxel material — custom `ShaderMaterial`:**

- Vertex shader interpolates `aSourcePos → aTargetPos` using a uniform `uProgress` offset by
  `aDelay`, with back-out easing computed in-shader.
- Fragment shader: base colour from the ore ramp via `aProbability`. Add emissive
  `pow(aProbability, 3.0) * 1.8` so only the genuinely high-probability blocks glow. Most of
  the field should be dark steel; the orebody should be the only bright thing.
- Edge highlight: use `abs(vNormal)` and the local cube UV to draw a 1-pixel bright edge on
  each cube at `0.35` opacity. Cubes without edge definition read as mush at scale.
- Enable `transparent`, sort back-to-front, `depthWrite: true`.

**Post-processing** (`@react-three/postprocessing`):
- `Bloom`: `intensity 0.65`, `luminanceThreshold 0.62`, `radius 0.7`. Tuned so only the ore
  core blooms. If the whole scene glows, you have gone too far — halve it.
- `Vignette`: `darkness 0.55`. Pulls the eye to centre.
- No chromatic aberration, no film grain, no god rays. One effect that serves the ore, nothing
  that serves itself.

**Controls that appear in State 3:**

| Control | Type | Behaviour |
|---|---|---|
| `DEPTH SLICE` | dual-handle range slider, 0–240 m | hides blocks outside the range; the defining interaction of the whole demo |
| `CUTOFF` | slider, 0.0–1.0 | hides blocks below the probability threshold; drag it up and only the orebody survives |
| `EXPLODE` | slider, 0–1 | separates depth layers vertically for an exploded axonometric view |
| `SECTION` | toggle + azimuth dial | clips the model along a vertical plane, exposing a cross-section — this is what a real geologist actually asks for |

The `CUTOFF` slider is your best single demo action. Dragging it from 0.3 to 0.75 and watching
98% of the field vanish, leaving a coherent folded ore horizon, is the moment that proves the
model found *structure* and not noise.

### STATE 4 — SUBSURFACE

**Claim:** "The high-probability blocks form a continuous folded horizon — a synform core —
which is exactly the geometry described in the GSI literature for this belt. The model
reproduced known geology it was never told about."

**Trigger:** button `GO UNDERGROUND`, or dragging the camera below the terrain plane.

**Behaviour:**
- Terrain surface becomes translucent (`opacity 0.12`) and switches to wireframe-over-fill so
  it reads as a ceiling.
- Camera descends below the surface on a scripted 1800ms path, then returns to free orbit.
- Scene fog `THREE.FogExp2(0x0B0E12, 0.0016)` — distant blocks fade into darkness. Fog is what
  makes it feel underground rather than like a floating diagram.
- Low-probability blocks drop to `opacity 0.05`. Only the orebody remains legible.
- Mine shaft geometry: extrude simple vertical cylinders and horizontal drives at the known
  mine locations, in `--text-mute` wireframe. Even schematic workings dramatically increase
  perceived realism.
- A **drill-hole trace**: a thin vertical line from surface to 240 m at the selected target,
  with tick marks every 10 m coloured by the probability of the block it passes through. This
  is a **strip log** — the single most recognisable artefact in exploration geology. A MOIL
  geologist will recognise it instantly and it will do more for your credibility than the
  entire bloom animation.

---

## 4. SYNTHETIC DATA GENERATOR

You have no real data. The generator must produce something that **looks like geology**, not
like Perlin clouds. This is a hard requirement — blobby noise will be spotted immediately.

File: `src/data/generate.ts`. Seed everything with `seedrandom('26009')` so the scene is
identical on every run and every machine. A demo that looks different each reload cannot be
rehearsed.

### 4.1 The structural model

The Sausar Group orebody sits in **the core of a plunging synform** — a folded trough. Build
the generator to reproduce that geometry explicitly:

```ts
// 1. Define a fold axis running roughly ENE-WSW across the grid,
//    with a plunge of ~12° to the ENE.
const axisAngle = degToRad(68);
const plunge    = degToRad(12);

// 2. Distance from the fold axial trace, in axis-perpendicular coordinates.
const u = x * cos(axisAngle) + z * sin(axisAngle);   // along axis
const v = -x * sin(axisAngle) + z * cos(axisAngle);  // across axis

// 3. The ore horizon is a surface: a parabolic trough that deepens along
//    the plunge direction, warped by low-frequency noise so it is not
//    mathematically perfect.
const troughDepth = 0.0009 * v * v + u * tan(plunge);
const warp        = simplex2(u * 0.004, v * 0.004) * 22;
const horizonY    = troughDepth + warp;

// 4. Probability is highest ON the horizon and decays with distance from it.
//    Crucially, the horizon is THICKER at the trough (low |v|) and THINNER
//    on the limbs — this is the real behaviour described for these deposits.
const thickness   = 14 + 20 * exp(-(v * v) / 90000);
const dist        = abs(y - horizonY);
let   p           = exp(-(dist * dist) / (2 * thickness * thickness));

// 5. Break the horizon into discrete parallel bands (tight isoclinal folding
//    produces multiple thin bands, not one slab).
p *= 0.55 + 0.45 * abs(sin(dist * 0.22));

// 6. Add pockets and gaps — real orebodies are discontinuous.
p *= smoothstep(0.32, 0.62, simplex3(x * 0.011, y * 0.02, z * 0.011) * 0.5 + 0.5);

// 7. Boost probability near the 11 known mine locations so validation reads
//    correctly, but ONLY mildly (×1.25, clamped) — if the mines sit in
//    artificially perfect bullseyes it looks fabricated.
```

**Rule: every known mine must land in a high-probability zone, but the high-probability zones
must extend well beyond the known mines.** If your hot zones are only at the mines, you have
demonstrated nothing. The extensions are the product.

### 4.2 Elevation

Fractal Brownian motion, 5 octaves, plus a dampened expression of the fold structure at the
surface — real folds produce topographic ridges and valleys aligned to the axial trace. Range
250–600 m, matching central India. Export as a `Float32Array(256*256)` and as a PNG for the
displacement texture.

### 4.3 SHAP values

For each surface cell, generate a plausible attribution vector over the 18 features (§7 of the
deck), normalised to sum to the probability. Weight it so that:
- `distance_to_mansar_contact` and `fold_axial_proximity` dominate near the horizon,
- `aeromagnetic_residual` and `stream_sediment_mn` dominate in the extensions,
- `ndvi_stress_anomaly` and `lst_residual` contribute modestly but visibly.

Make the drivers vary sensibly across space. A judge who clicks three different cells and sees
three identical SHAP panels will know it is faked.

### 4.4 Production time series

11 mines × 132 months, from Jan 2016. Per mine:
- base rate scaled by mine size (Balaghat largest, ~2.5× the small Nagpur mines),
- a real annual seasonality with a pronounced monsoon trough in Jul–Sep,
- equipment downtime events as random Poisson shocks,
- a mild upward trend,
- planned target = 12-month trailing mean × 1.04,
- forecast band: P50 from a simple exponential-smoothing fit, P10/P90 at ±(8–22%) widening
  with horizon.

Seed a **deliberate, visible predicted shortfall at Balaghat starting week 7 of the forecast
horizon**, so the demo always has something to show. Rehearsability beats realism.

---

## 5. STATE STORE

Single Zustand store, `src/store/useDrishti.ts`:

```ts
type ViewState = 'FLAT' | 'RELIEF' | 'BLOCK' | 'SUBSURFACE';
type Drape     = 'PROSPECTIVITY' | 'CONFIDENCE';
type Panel     = 'EXPLORATION' | 'OPERATIONS';

interface DrishtiStore {
  view: ViewState;
  transitioning: boolean;
  drape: Drape;
  panel: Panel;

  showKnownDeposits: boolean;
  cutoff: number;              // 0–1
  depthRange: [number, number]; // metres
  explode: number;             // 0–1
  section: { on: boolean; azimuth: number };

  selectedCell: CellRef | null;
  selectedMine: string | null;
  hoverCell: CellRef | null;

  camera: { position: Vec3; target: Vec3; };

  setView(v: ViewState): void;   // orchestrates the transition, sets transitioning
  selectCell(c: CellRef): void;
  // ...
}
```

Transitions are driven **only** through `setView`. No component mutates the camera or the
scene directly. This is what stops the demo desynchronising on stage.

---

## 6. DASHBOARD AND WIDGETS

Layout: the 3D viewport occupies the centre and right. Panels dock left and bottom. On a
1920×1080 projector:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TOPBAR  56px  · DRISHTI · PS 26009 · state breadcrumb · view controls   │
├───────────────┬──────────────────────────────────────────────────────────┤
│               │                                                          │
│  LEFT RAIL    │                  VIEWPORT                                │
│  340px        │              (map or 3D canvas)                          │
│               │                                                          │
│  · mode tabs  │        floating toolbar, top-right of viewport           │
│  · inspector  │        floating legend, bottom-right                     │
│  · SHAP       │                                                          │
│  · drivers    │                                                          │
│               ├──────────────────────────────────────────────────────────┤
│               │  BOTTOM DOCK  240px  · widget strip, horizontally scroll  │
└───────────────┴──────────────────────────────────────────────────────────┘
```

Left rail switches between two panels via a segmented control: **EXPLORATION** and
**OPERATIONS**. This is the whole product in one control — the two problems from the problem
statement, side by side.

### 6.1 Widget: Model Validation

Always visible, top of the left rail in EXPLORATION mode. The credibility anchor.

- Big mono number: `% of known deposits inside top 5% of ranked area`
- Beneath it: a **success-rate curve** — x = cumulative % of area ranked, y = cumulative % of
  known deposits captured. Draw the 1:1 random baseline as a dashed grey diagonal. The gap
  between your curve and the diagonal *is* the model's value, and it is legible in one glance.
- Small mono row: `ROC-AUC`, `PR-AUC`, `CV folds: 11 (leave-one-mine-out)`

### 6.2 Widget: SHAP Driver Panel

Horizontal waterfall bars for the selected cell. Feature name in Plex Sans, contribution value
in Plex Mono, bar coloured by sign (ore ramp for positive, `--text-mute` for negative). Top 6
drivers only, with a `show all 18` disclosure.

### 6.3 Widget: Depth Profile

A vertical strip chart for the selected (x, z) column — the drill-hole strip log. Depth on the
y-axis running downward (never upward — geologists read depth downward), probability as a
horizontal bar at each 10 m block. This widget mirrors the drill-hole trace in the 3D scene;
hovering one highlights the other.

### 6.4 Widget: Target Inspector

For the selected cell: coordinates in decimal degrees and UTM 44N, probability with a
confidence interval, estimated horizon depth, nearest known mine and distance, and a
`ADD TO DRILL QUEUE` button. The button pushes to a list widget — a queue of ranked targets,
exportable as GeoJSON. Wire the export; a working download button is disproportionately
convincing.

### 6.5 Widget: Production Forecast

OPERATIONS mode. Recharts composed chart per mine: actual tonnage as a solid line, forecast P50
as a dashed continuation, P10–P90 as a shaded band, committed plan as a horizontal reference
line. Shade the region where P90 falls below plan in `--risk-high` at 18% opacity — the
shortfall window, visible without reading a single number.

### 6.6 Widget: Shortfall Risk Board

11 rows, one per mine. Each row: mine name, a risk pill (`LOW` / `WATCH` / `ACT`), shortfall
probability as a mono percentage, magnitude in tonnes, and a 24-point sparkline. Sort by risk
descending. Clicking a row flies the camera to that mine in the 3D scene.

### 6.7 Widget: Driver Waterfall (operations)

Same visual grammar as 6.2 but for the production model: equipment downtime, rainfall, blast
delay, ore availability, manpower. Reusing the visual grammar across both halves of the product
is what makes it feel like one system rather than two demos stapled together.

### 6.8 Widget: Recommended Actions

Cards, each with: the action, the projected tonnage recovered, the confidence, and
`SIMULATE` / `ACCEPT` buttons. `SIMULATE` updates the forecast chart live with the
counterfactual band. This is the what-if slider from the pitch — make it work, it is the
closing beat of the demo.

---

## 7. VIEWPORT CHROME

**Floating toolbar** (top-right of viewport, `--panel` at 82% with backdrop blur):
state buttons `FLAT / RELIEF / BLOCK / UNDERGROUND`, drape switch, and a `RESET VIEW` control.
Current state highlighted with a `--rhodonite` underline, 2px.

**Floating legend** (bottom-right): the ore ramp as a continuous gradient bar with mono tick
labels at 0.0 / 0.25 / 0.5 / 0.75 / 1.0, the vertical exaggeration note, block dimensions, and
a north arrow. Legends are what separate a map from a picture.

**Scale bar and depth ruler**: horizontal scale bar in the 2D and relief states; a vertical
depth ruler on the left edge of the scene in block and subsurface states, ticked every 40 m in
mono.

**Coordinate readout**: bottom-left, always visible, mono, updating on hover.
`79.7213 E  21.4885 N  ·  el 412 m  ·  p 0.834`

---

## 8. PERFORMANCE BUDGET

Non-negotiable — this runs on unknown hardware on a projector.

| Metric | Target |
|---|---|
| First contentful paint | < 1.5s |
| Time to interactive map | < 3.0s |
| Frame rate, all states | ≥ 55fps on integrated graphics |
| Voxel instance count | ≤ 30,000 |
| Draw calls in State 3 | ≤ 12 |
| Bundle (gzipped) | < 1.6 MB |

Techniques required:
- One `InstancedMesh` for all voxels. Update instance attributes, never rebuild geometry.
- `useFrame` must not allocate. Hoist all vectors, matrices and colours outside the loop.
- Depth-slice and cutoff filtering happen **in the shader** via an `aVisible` uniform test with
  `discard`, not by rebuilding the instance buffer on every slider tick. Rebuilding will drop
  frames while dragging, which is exactly when the judge is watching.
- Throttle hover raycasting to 30Hz.
- `powerPreference: 'high-performance'`, `antialias: true`, `dpr={[1, 2]}` capped.
- Lazy-load the postprocessing chain; if `gl.getExtension('WEBGL_debug_renderer_info')` reports
  a software renderer, disable bloom automatically and log it.

**Ship a fallback.** If WebGL2 is unavailable, render State 1 and the full dashboard and hide
the 3D controls with an honest message. Never show a black canvas on stage.

---

## 9. FILE STRUCTURE

```
src/
  main.tsx
  App.tsx
  store/
    useDrishti.ts
  data/
    generate.ts            // deterministic generator, seed 26009
    mines.ts               // the 11 mine records
    features.ts            // the 18 feature definitions + SHAP synthesis
    api.ts                 // async facade — swap for FastAPI later
  scene/
    Canvas3D.tsx
    Terrain.tsx
    VoxelField.tsx
    DrillTrace.tsx
    MineWorkings.tsx
    DepthRuler.tsx
    SectionPlane.tsx
    CameraRig.tsx          // owns all camera transitions
    shaders/
      terrain.vert.glsl
      terrain.frag.glsl
      voxel.vert.glsl
      voxel.frag.glsl
      oreRamp.glsl         // shared ramp function, included by both
  map/
    MapView.tsx            // MapLibre + deck.gl, State 1 only
    cameraSync.ts          // MapLibre <-> three.js camera conversion
  ui/
    TopBar.tsx
    LeftRail.tsx
    BottomDock.tsx
    Toolbar.tsx
    Legend.tsx
    widgets/
      ModelValidation.tsx
      ShapPanel.tsx
      DepthProfile.tsx
      TargetInspector.tsx
      DrillQueue.tsx
      ProductionForecast.tsx
      RiskBoard.tsx
      DriverWaterfall.tsx
      RecommendedActions.tsx
  lib/
    ramp.ts                // ore ramp in JS, must match oreRamp.glsl exactly
    easing.ts
    format.ts              // mono number formatting, tabular alignment
  styles/
    tokens.css
    index.css
```

The ore ramp exists in two places — GLSL and TypeScript. **They must produce identical colours.**
Write a unit test that samples both at 21 points and asserts agreement within 1/255. A legend
that disagrees with the scene is a defect a judge will notice.

---

## 10. INTERACTION SCRIPT — THE 3-MINUTE DEMO

Build the application so this sequence is possible without a single dead moment. Then rehearse
it against a stopwatch.

```
0:00  FLAT. Belt-wide prospectivity heatmap over real geography.
      "This is the Sausar manganese belt. Every cell is scored by our model."

0:20  Toggle SHOW KNOWN DEPOSITS. MOIL's 11 mines appear inside the hot zones.
      "We never told the model where these are. Leave-one-mine-out validation."
      Left rail: success-rate curve, top 5% of area captures most deposits.

0:45  Click an unmined hot zone away from the known mines.
      SHAP panel opens. "It ranks here because of proximity to the Mansar
      contact, aeromagnetic response, and stream-sediment manganese."

1:00  → RELIEF. Terrain rises. Switch drape to CONFIDENCE and back.
      "Here's where the model is unsure. We show that, not hide it."

1:20  → BLOCK MODEL. The bloom. Do not talk over the first 1.5 seconds.
      "This is a block model — the same structure Datamine and Surpac use.
      25 by 25 by 10 metres, each block carrying probability and confidence."

1:40  Drag CUTOFF from 0.30 to 0.75. 98% of the field vanishes.
      A coherent folded horizon remains.
      "That's a synform core. The model reproduced known structural geology
      it was never given."

2:00  → GO UNDERGROUND. Fog, glow, drill trace, mine workings.
      Drag DEPTH SLICE. "You can section it at any depth a planner asks for."

2:20  Switch left rail to OPERATIONS. Balaghat forecast.
      "Different problem, same platform. P90 drops below plan in week 7."

2:35  Driver waterfall. "62% monsoon haul-road downtime."

2:45  Recommended action → SIMULATE. Forecast band lifts above plan.
      "Advance crusher maintenance eleven days, move two dumpers from Kandri.
      Shortfall closes."

3:00  Stop talking.
```

---

## 11. HONESTY REQUIREMENTS — BUILD THESE IN

These are not optional. A prototype that overstates itself will lose to one that does not.

1. A persistent badge in the top bar: **`PROTOTYPE · SYNTHETIC DATA`**, in `--text-mute`, mono,
   11px. Visible in every screenshot and every frame of the video.
2. An `ABOUT DATA` panel, one click from the top bar, listing every layer, whether it is real
   or modelled, and where the real version comes from. Real: mine locations, geography,
   MOIL public production. Modelled: prospectivity raster, SHAP values, equipment logs.
3. Vertical exaggeration always labelled.
4. Confidence surface always available, never buried.
5. Never render a tonnage estimate. Probability and ranking only. The moment you display a
   tonnes-in-the-ground number you are making a reserve claim you cannot defend.

---

## 12. ACCESSIBILITY AND ROBUSTNESS FLOOR

- Every control keyboard-reachable, visible focus ring in `--rhodonite`.
- `prefers-reduced-motion`: skip the bloom animation, jump to the settled state.
- Colour is never the only channel — the risk pills carry text labels, the ore ramp is paired
  with numeric readouts.
- No layout below 1280px width required, but do not let it break catastrophically — show a
  message.
- An error boundary around the 3D canvas that falls back to State 1 rather than a white screen.

---

## 13. WHAT NOT TO BUILD

Cut ruthlessly. These will eat your time and add nothing:

- User authentication and login screens. Nobody scores this.
- A real backend, database, or ORM.
- Settings, preferences, theming, or a light mode.
- More than the two drape modes.
- Particle systems, lens flares, animated skyboxes, ambient music.
- Any second orebody, second region, or second commodity.
- Mobile layout.
- Tests beyond the ore-ramp parity test in §9.

---

## 14. BUILD ORDER

Do these in sequence. Each milestone must run before you start the next.

| # | Milestone | Proves |
|---|---|---|
| 1 | Vite + React + TS + Tailwind + tokens. Blank dark shell with topbar and rails. | scaffolding |
| 2 | `generate.ts` producing the elevation and probability arrays. Dump a PNG to verify it looks like folded geology, not clouds. **Do not proceed until it does.** | the data is credible |
| 3 | State 1: MapLibre + deck.gl heatmap, real bbox, mine markers, deposits toggle. | the credibility anchor |
| 4 | `cameraSync.ts` — MapLibre camera to three.js camera with no visual jump. Prove it with a screenshot diff. | the hardest transition |
| 5 | State 2: terrain mesh, ore-ramp shader, contours, drape switch. | the 3D foundation |
| 6 | State 3: InstancedMesh voxel field, static, no animation. Cutoff and depth-slice working in-shader. | performance at scale |
| 7 | The bloom animation, staged per §3 State 3. | the signature moment |
| 8 | State 4: fog, translucent surface, drill trace, workings. | the payoff |
| 9 | Left rail widgets: validation, SHAP, depth profile, inspector. | exploration half |
| 10 | Operations widgets: forecast, risk board, waterfall, actions with working SIMULATE. | operations half |
| 11 | Legend, rulers, coordinate readout, honesty badges, about-data panel. | it reads as an instrument |
| 12 | Performance pass against §8. Fallback path. Record the offline demo video. | it survives the stage |

If you run out of time, ship milestones 1–8 and 11. A complete visual journey with no
operations widgets beats a half-broken everything.

---

## 15. ACCEPTANCE CRITERIA

The build is done when all of these are true:

- [ ] The four states transition with no visual jump, in either direction.
- [ ] Toggling known deposits visibly places MOIL's mines inside high-probability zones.
- [ ] Dragging `CUTOFF` to 0.75 leaves a continuous, folded, geologically plausible horizon.
- [ ] The block model holds ≥ 55fps while `DEPTH SLICE` is being dragged.
- [ ] Clicking three different cells produces three visibly different SHAP panels.
- [ ] The drill-hole strip log in the widget matches the drill trace in the 3D scene.
- [ ] `SIMULATE` visibly lifts the forecast band above the plan line.
- [ ] `ADD TO DRILL QUEUE` → export produces a valid, openable GeoJSON file.
- [ ] The legend colours match the scene colours exactly.
- [ ] `PROTOTYPE · SYNTHETIC DATA` is visible in every state.
- [ ] The full 3-minute script in §10 runs without a stall, twice in a row.
- [ ] It still shows something useful with WebGL disabled.

# DRISHTI 3D — Build Specification, PART II

## Globe, Region Modes, and Terrain Sites

**This document extends `DRISHTI-3D_BUILD_SPEC.md`. Give your coding agent both files.**
Part I remains authoritative for the design system, the data generator, the block model, the
dashboard widgets, the performance budget and the honesty requirements. Part II inserts three
new states in front of Part I's states, adds four basemap modes, and defines five terrain
sites instead of one.

---

## 0. REVISED STATE MACHINE

Part I described four states. The full journey is now seven. Renumber accordingly.

```
G0  GLOBE          rotating 3D Earth, displaced-sphere, manganese layer
G1  NATION         camera settles on India, five sites pinned, region controls appear
G2  SITE SELECT    fly to one of five sites; basemap mode switcher active
──────────────────── Part I picks up here ────────────────────
S1  FLAT           2D prospectivity heatmap for the chosen site
S2  RELIEF         3D terrain, prospectivity draped
S3  BLOCK          voxel block model
S4  SUBSURFACE     below ground, orebody glows
```

Every state must be reachable forward and backward with no reload. A breadcrumb in the top bar
shows the path: `GLOBE › INDIA › SAUSAR BELT › BLOCK MODEL`, each segment clickable.

---

## 1. A BRIEF-ALIGNMENT DECISION YOU MUST NOT GET WRONG

Problem statement 26009 is **MOIL Ltd**, a Ministry of Steel PSU. MOIL's 11 mines are in
Nagpur and Bhandara districts of Maharashtra and Balaghat district of Madhya Pradesh. That is
**central India**, not southern India, and not offshore.

If the demo opens on the ocean or leads with Karnataka, the panel will conclude you did not
read the problem statement. That is fatal and it happens for a purely aesthetic reason.

**The resolution:** all five sites below are genuinely manganese, so the geography is
defensible, but the roles are strictly ordered.

- **Site 1, the Sausar Belt, is the answer to the problem statement.** It is the default. The
  globe flies there automatically. Every claim in the pitch is made here. The block model, the
  validation metrics, the drill queue, the production forecasting — all of it is Site 1.
- **Sites 2 to 5 are the scale story, and nothing more.** They exist to answer one question:
  *"does this only work for MOIL?"* You show them for fifteen seconds, total, near the end.

Say it out loud in the pitch: *"Everything we've shown is MOIL's belt. The same pipeline runs
on four other Indian manganese provinces by swapping the input rasters — including India's
polymetallic nodule field in the Central Indian Ocean, which holds roughly 92 million tonnes
of manganese."* Then go back to Site 1 and close.

Do not open on the globe spinning to the ocean. Open on the globe, fly to India, land on
Sausar. The ocean is the encore, not the overture.

---

## 2. STATE G0 — THE GLOBE

### 2.1 Technique (from the reference)

The Bezdék & Šebera rotating-globe method: take a sphere, displace each vertex **along its own
normal** by a scalar field value multiplied by an exaggeration factor, and colour the surface
by that same field. Their geoid renders use exaggeration factors in the thousands — the "Earth
potato." Real relief on a true-scale Earth is invisible, so exaggeration is not cheating, it is
the only way the data is legible.

```ts
// Core displacement, per vertex
const n = vertex.clone().normalize();
const value = sampleField(lon, lat);              // elevation or Mn prospectivity
vertex.copy(n).multiplyScalar(R + value * exaggeration);
```

**Always label the exaggeration factor on screen**, in mono, bottom-left:
`V.E. 180× · ETOPO-derived relief`. Part I's honesty rules apply here without exception.

### 2.2 Geometry and quality

- `THREE.SphereGeometry(1, 256, 128)` — 256 segments longitudinally, 128 latitudinally.
  Recompute vertex normals after displacement or the lighting will be flat and wrong.
- Guard the seam at ±180° longitude and the pole singularities. Sample the field with wrapped
  longitude indexing.
- Elevation source: a global relief texture (ETOPO or GEBCO derived, downsampled to
  2048 × 1024). Ship it as a PNG in `/public/data/`. Do not fetch it at runtime.

### 2.3 What the globe actually displays

Not decoration — a real layer. The globe shows **global manganese province prospectivity**,
which is the honest planetary framing of the problem statement.

- Land: relief displacement, coloured by the Part I ore ramp where a manganese province is
  known, and by a desaturated steel grey elsewhere. The known provinces glow; the rest of the
  world is cold. This reads instantly.
- Ocean: bathymetry displaced inward (negative), coloured `--ore-00` to `#0D1620`.
- Atmosphere: a slightly larger back-face sphere with a fresnel shader,
  `color #2E7D8C`, `intensity 0.35`. One shell only. No volumetric anything.
- Coastlines: a thin GeoJSON line overlay at `--text-mute`, `0.6px`, drawn as a
  `LineSegments` on a sphere very slightly larger than the surface to avoid z-fighting.
- Star field: 2,000 points, `size 0.7`, `color #6C7A89`, no twinkle animation. Static.

### 2.4 Motion

- Idle: continuous rotation, **one revolution per 46 seconds**. Slow. A fast-spinning globe
  reads as a screensaver.
- Drag to rotate, wheel to zoom. Rotation resumes 4 seconds after the user stops interacting.
- Site pins: five markers at the site coordinates, rendered as thin vertical needles rising
  from the surface with a small `--rhodonite` cap. They occlude correctly behind the globe.
- Hovering a pin stops rotation and shows a mono label card. Clicking flies to G1.

### 2.5 Optional clipping plane (from your reference image 2)

A toggle, `SECTION EARTH`, that applies a `THREE.Plane` clip through the globe with a dial for
the plane's angle, exposing the interior. Fill the cut with a radial gradient
(`--ore-100` core → `--ore-20` mantle → surface). It is a legitimate way to introduce the idea
of depth before the block model does it for real.

**Build this last.** It is genuinely optional and it will eat two hours.

---

## 3. STATE G1 — INDIA

**Camera flight, 2400ms**, easing `cubic-bezier(0.16, 1, 0.3, 1)`, from orbital distance to a
tilted view centred at `78.9 E, 20.6 N`. The globe keeps its curvature at this altitude — do
not flatten to a plane until G2. Seeing the limb of the Earth curve away behind India is what
makes it feel like an orbital instrument rather than a map widget.

On arrival:
- India's boundary drawn in `--text` at `1.2px`, states at `--line-hi` at `0.6px`.
- The five site pins scale up and label themselves.
- The **region control cluster** slides in from the left (§4).
- Ocean sites render with a subtle depth shimmer so the CIOB site is visually distinct from
  the four land sites.
- A mono caption, bottom-centre: `5 MANGANESE PROVINCES · 1 ACTIVE · 4 ROADMAP`.

---

## 4. THE FOUR BASEMAP MODES

A segmented control, mono caps, top-left of the viewport. Available in G1, G2 and S1.
Persist the choice across states.

### 4.1 `NORMAL`

Cartographic base. Muted vector styling: land `#161C24`, water `#0D141C`, boundaries
`--line-hi`, place labels in IBM Plex Sans at 11px, `--text-dim`. Roads and railways at 0.4px.
Restrained and legible — this is the mode a MOIL planner would actually use.

### 4.2 `SATELLITE`

True-colour imagery. Sentinel-2 or Landsat composite, cloud-free annual median. Apply a
desaturation of 0.25 and a slight contrast lift so the ore-ramp overlay stays readable on top.

At the prototype stage, ship a static pre-rendered composite per site as a PNG rather than
wiring live tile fetching. Ten static images beat one tile pipeline that stalls on stage.

### 4.3 `TACTICAL`

The signature mode, and the one that will get screenshotted. This is your reference image 3
translated into an interface.

- Basemap suppressed to near-black `#080B0F`.
- Terrain rendered as a **wireframe mesh only** — no fill. Grid lines at `0.5px`, coloured by
  elevation through a hypsometric ramp (`#12303C` low → `#2E7D8C` mid → `#C9A227` high).
- Mesh spacing visibly coarser than the underlying data, roughly 96 × 96, so the lattice reads
  as an instrument overlay rather than a solid surface.
- Contour lines every 20 m in `--text-mute` at 40% opacity, over the wireframe.
- Extracted lineaments drawn as bright `--rhodonite` polylines. **These are structural
  lineaments from DEM hillshade analysis — one of your 18 predictor features.** Say so when
  you switch to this mode. The tactical view is not a skin; it is a feature visualisation.
- A faint scan-line sweep, one pass every 8 seconds, at 6% opacity. Subtle. If it is visible
  in a screenshot, halve it.
- Grid graticule with mono coordinate labels at the edges.

### 4.4 `HEATMAP`

The prospectivity surface at full strength: ore ramp, `opacity 0.92`, basemap almost entirely
suppressed. Terrain relief still shades the surface so structure remains readable through the
colour. This is the mode you present in.

### 4.5 Layer swipe (from your reference image 1)

In every mode, a **vertical swipe divider** the user can drag left and right, comparing two
layers side by side in one viewport. Default pairing per site is defined in §5.

Implement as a scissor test or a clip plane in screen space, with a 2px `--text` divider and a
draggable handle. Label each half in mono caps at the top corners.

This is the single most effective device for showing *why* a zone is prospective: drag the
handle and watch the aeromagnetic high line up with the prospectivity high. It costs an hour
and it wins arguments.

---

## 5. THE FIVE TERRAIN SITES

Each site has its own signature visualisation, so cycling through them does not feel like the
same demo five times. Coordinates are approximate and adequate for a prototype — label them
indicative.

---

### SITE 1 — SAUSAR BELT (PRIMARY)

```
Region      Nagpur + Bhandara (MH), Balaghat (MP)
Bounds      79.05–80.50 E,  21.05–22.00 N
Operator    MOIL Ltd · 11 mines · 8 underground, 3 opencast
Geology     Sausar Group, Mansar Formation, gondite host,
            braunite / pyrolusite / hausmannite, plunging synform
```

**Signature: the block model.** Everything in Part I §3 states S1–S4 applies here in full.
This is the only site where the block model, the drill strip log, the SHAP panels and the
production forecasting are wired to real interaction.

**Default swipe pairing:** `PROSPECTIVITY` ↔ `AEROMAGNETIC RESIDUAL`

---

### SITE 2 — SANDUR SCHIST BELT

```
Region      Sandur, Ballari district, Karnataka
Bounds      76.45–76.90 E,  14.95–15.35 N
Geology     Dharwar Supergroup, banded iron–manganese formation,
            long linear ridge-and-valley strike ridges
```

**Signature: structural strike extraction.** Sandur's ore horizons follow prominent linear
ridges, so the terrain itself broadcasts the geology. Open this site in `TACTICAL` mode by
default, with lineament extraction on. Add a **rose diagram** widget in the left rail showing
the orientation distribution of extracted lineaments, with the dominant strike direction
called out in mono.

The claim: *"Structure is legible from terrain alone here. Same feature extractor, different
belt, and it finds the strike without being told."*

**Default swipe pairing:** `SATELLITE` ↔ `LINEAMENT DENSITY`

---

### SITE 3 — VIZIANAGARAM–SRIKAKULAM BELT

```
Region      Eastern Ghats, Andhra Pradesh
Bounds      83.15–83.95 E,  18.05–18.85 N
Geology     Khondalite-hosted manganese, lateritic and supergene enriched,
            drainage-controlled distribution
```

**Signature: the hydrography swipe** — your reference image 1, applied for a reason. Supergene
manganese enrichment here is controlled by weathering and drainage, so the drainage network is
genuinely predictive. Open this site with the swipe divider already active at 50%, elevation on
the left and the extracted stream network on the right, drainage lines weighted by
Strahler order in blues over the dark terrain.

The claim: *"Different genesis, different feature set. Here drainage does the work that
aeromagnetics does at Sausar."*

**Default swipe pairing:** `ELEVATION` ↔ `DRAINAGE NETWORK`

---

### SITE 4 — BONAI–KEONJHAR BELT

```
Region      Sundargarh + Keonjhar districts, Odisha
Bounds      85.00–85.85 E,  21.55–22.30 N
Geology     Iron Ore Group, manganese associated with BIF,
            active large-scale mining, extensive waste dumps
```

**Signature: the spatio-temporal data cube** — your reference images 4 and 5, the Lexcube
look. This is where the Space Technology theme pays off hardest.

Build a **solid rectangular volume**, not a scatter of separate cubes:

```
X axis     longitude across the belt
Y axis     latitude
Z axis     TIME — 120 monthly steps, 2016 to 2025
Value      NDVI anomaly (or LST residual — switchable)
```

Render as a `BoxGeometry` whose **six faces are individually textured** with the corresponding
data slice, exactly as in the reference images. The visible faces show: the top face = the most
recent spatial snapshot, the two visible side faces = time–longitude and time–latitude
sections through the stack.

Interaction:
- **Slice handles** on each of the three axes. Dragging a handle peels the cube back and
  re-textures the newly exposed face from the correct slice. Implement by updating the face
  texture's UV offset and the box dimensions, not by rebuilding geometry.
- A time scrubber beneath the cube; scrubbing animates the top face through the stack.
- Colour ramp is **diverging** here, not the ore ramp — this is an anomaly, and anomalies need
  a signed scale. Use `#2E5F8C` (negative) → `#F2EFE6` (zero) → `#C4482E` (positive), with a
  clearly labelled zero point.

The claim: *"Ten years of satellite observation as a single object. Mining expansion, dump
growth and vegetation loss are all readable as structure inside the cube."*

Wire this cube to be reusable for the **NDVI stress anomaly** feature at Site 1. If the same
component serves both a Site-4 showpiece and a Site-1 predictor, it is not decoration.

**Default swipe pairing:** `SATELLITE 2016` ↔ `SATELLITE 2025`

---

### SITE 5 — INDIAN OCEAN NODULE FIELD

```
Region      Central Indian Ocean Basin, international waters
Bounds      72–80 E,  9–16.5 S   (Indian Ocean Nodule Field)
Depth       ~4,000–6,000 m, average ~5,000 m
Status      India allocated ~75,000 km² by the International Seabed
            Authority under a 2002 contract; Pioneer Investor since 1987.
            Resource estimated at ~380 Mt of polymetallic nodules
            containing roughly 92.6 Mt of manganese. First Generation
            Mine Site narrowed to ~18,000 km².
            Administered by the Ministry of Earth Sciences / NIOT
            under the Deep Ocean Mission.
```

**Signature: inverted bathymetry, camera beneath the surface.** Everything about this site is
upside down relative to the other four, and that contrast is the point.

- The sea surface renders as a translucent ceiling above the camera, `opacity 0.08`, with slow
  caustic-free ripple normals. No animated water shader — it will cost frames and add nothing.
- Bathymetry displaced **downward**, exaggerated 40×, coloured on a cold ramp
  `#0A1420` → `#1E4A5F` → `#2E7D8C`. Abyssal hills and seamounts should be clearly visible.
- **Nodule abundance** rendered as a dense point field scattered on the seafloor, sized and
  coloured by kg/m², using the ore ramp. At distance it reads as a heatmap; up close it
  resolves into individual nodules. Use one `Points` object with a custom shader, not
  instanced meshes — you need 200k+ points and they must cost almost nothing.
- The ISA-allocated area drawn as a `--rhodonite` polygon boundary on the seafloor, with the
  First Generation Mine Site as a smaller inset polygon.
- Scene fog, heavy: `FogExp2(0x0A1420, 0.0009)`. Visibility should be genuinely limited. It is
  five kilometres down and dark.
- Depth ruler on the left edge reading in **metres below sea level**, ticked every 500 m.

The claim: *"India holds rights to roughly 92 million tonnes of seabed manganese. It is
mapped by ship-borne survey today. The same prospectivity pipeline applies, with bathymetry
and backscatter replacing terrain and aeromagnetics."*

Mark this site clearly as **ROADMAP · NOT IN SCOPE FOR PS 26009** in the site card. Ambition
is good; pretending it is part of the deliverable is not.

**Default swipe pairing:** `BATHYMETRY` ↔ `NODULE ABUNDANCE`

---

## 6. SITE SELECTION UI (STATE G2)

A horizontal card strip along the bottom of the viewport in G1. Five cards.

Each card carries: site name, state, a one-line geology descriptor, a small pre-rendered
thumbnail of that site's signature visual, and a status pill — `ACTIVE` for Site 1,
`ROADMAP` for Sites 2 to 5. Site 1's card is visibly larger and highlighted with a
`--rhodonite` top rule.

Clicking a card flies the camera from orbit to the site over **2200ms**, during which:
1. The globe's curvature flattens as altitude drops (interpolate between spherical and planar
   projection over the last 40% of the flight — this transition is finicky, budget time).
2. The site's terrain tile fades in beneath the globe surface.
3. The basemap mode switcher and layer controls slide in.
4. The breadcrumb updates.

Provide a `RETURN TO GLOBE` control that reverses the flight. It must work from any state,
including from inside the block model.

---

## 7. DATA GENERATION FOR SITES 2–5

Part I §4's generator is written for a plunging synform, which is correct for Sausar and wrong
for everywhere else. Parameterise it by **structural style**:

```ts
type StructuralStyle =
  | 'synform'      // Site 1 — folded trough, thick at core, thin on limbs
  | 'strike_ridge' // Site 2 — long linear parallel bands along a strong strike
  | 'supergene'    // Site 3 — drainage-controlled, patchy, near-surface only
  | 'stratiform'   // Site 4 — sub-horizontal layers, gently dipping
  | 'nodule_field' // Site 5 — 2D surface scatter, no depth dimension at all
```

Each style produces a visibly different geometry. If all five sites look like the same noise
field with a different colour ramp, the scale claim collapses. Site 5 in particular has **no
block model** — nodules sit on the seafloor surface, not in a 3D volume — and building one
would be geologically wrong.

Seed each site independently: `seedrandom('26009-site-' + n)`.

---

## 8. UPDATED PERFORMANCE BUDGET

Part I's budget stands. Additional constraints:

| Concern | Constraint |
|---|---|
| Globe geometry | ≤ 66k vertices; build once, never rebuild |
| Globe texture | 2048 × 1024 max, single PNG, ≤ 900 KB |
| Nodule point field | ≤ 250k points, one `Points` object, one draw call |
| Data cube | 6 textures max, 512 × 512 each, updated by UV offset only |
| Site assets | lazy-loaded per site; never load all five upfront |
| Total initial payload | ≤ 2.4 MB gzipped |

Preload **only Site 1**. Fetch the other four on card hover. The demo lives or dies on Site 1
appearing instantly.

---

## 9. UPDATED FILE STRUCTURE

Add to Part I §9:

```
src/
  globe/
    Globe.tsx              // displaced sphere, the "Earth potato"
    Atmosphere.tsx
    Coastlines.tsx
    SitePins.tsx
    GlobeSection.tsx       // optional clipping plane
    shaders/
      globe.vert.glsl      // normal-displacement + exaggeration uniform
      globe.frag.glsl
  region/
    IndiaView.tsx
    SiteCardStrip.tsx
    FlightPath.tsx         // globe → site camera interpolation, spherical → planar
  basemap/
    ModeSwitcher.tsx
    NormalMode.tsx
    SatelliteMode.tsx
    TacticalMode.tsx       // wireframe + lineaments + scan sweep
    HeatmapMode.tsx
    SwipeDivider.tsx
  sites/
    registry.ts            // the five site definitions, single source of truth
    sausar/                // Site 1 — full Part I implementation
    sandur/                // Site 2 — rose diagram
    vizianagaram/          // Site 3 — drainage swipe
    bonai/                 // Site 4 — DataCube
    ciob/                  // Site 5 — bathymetry + nodule points
  cube/
    DataCube.tsx           // Lexcube-style, reused by Site 4 and Site 1 NDVI
    SliceHandles.tsx
```

`sites/registry.ts` holds bounds, structural style, default basemap mode, default swipe
pairing, signature component and status for all five. Adding a sixth site must be a
registry entry plus a data file, nothing more.

---

## 10. REVISED DEMO SCRIPT (3:30)

```
0:00  GLOBE. Slow rotation. Manganese provinces glowing on a cold Earth.
      "Manganese is a critical mineral for steel. Here's where it is."

0:12  Camera flies to INDIA. Five provinces pin themselves.
      "India has five. MOIL works one of them."

0:22  Click SAUSAR BELT. Flight down. Basemap mode: HEATMAP.
      ─────────── Part I script runs unchanged from here ───────────

0:35  Toggle SHOW KNOWN DEPOSITS. The 11 mines land in the hot zones.
0:55  Switch to TACTICAL. Wireframe, lineaments in pink.
      "Those lines are structural lineaments from DEM hillshade —
       one of our eighteen predictors, not a filter."
1:10  Drag the SWIPE divider. Aeromagnetic high aligns with prospectivity high.
1:25  → RELIEF. → BLOCK MODEL. The bloom.
1:50  Drag CUTOFF 0.30 → 0.75. The synform survives.
2:10  → UNDERGROUND. Drill strip log, workings, depth slice.
2:30  Left rail → OPERATIONS. Balaghat forecast, driver waterfall, SIMULATE.

3:00  RETURN TO GLOBE. Fifteen seconds, four cards, no deep dives:
      Sandur — rose diagram, strike found from terrain.
      Vizianagaram — drainage swipe.
      Bonai — the data cube spins, ten years in one object.
      CIOB — camera underwater, nodule field, ISA boundary.
      "Ninety-two million tonnes of manganese on India's seabed.
       Same pipeline. That's the roadmap, not the deliverable."

3:20  Click back to SAUSAR. Land on the block model.
      "But this is the problem statement. This is what we built."

3:30  Stop.
```

The return to Site 1 at the end is not optional. Ending on the ocean means the last thing the
panel sees is the thing you are not delivering.

---

## 11. UPDATED ACCEPTANCE CRITERIA

In addition to Part I §15:

- [ ] The globe holds 60fps while rotating, with the atmosphere and star field on.
- [ ] The globe → India → site flight has no visible pop at the spherical-to-planar handover.
- [ ] All four basemap modes render correctly at every site, and the mode persists on
      state change.
- [ ] The swipe divider drags smoothly at 60fps with two full-resolution layers loaded.
- [ ] `TACTICAL` mode shows lineaments that visibly correlate with the prospectivity highs —
      if they don't, the generator is wrong, not the renderer.
- [ ] The five sites produce five visibly different structural geometries.
- [ ] Site 5 has no block model and does not offer one.
- [ ] The data cube's slice handles re-texture faces without a frame drop.
- [ ] `RETURN TO GLOBE` works from inside the block model and from underground.
- [ ] Site 1 is interactive within 3 seconds of first load; the other four are lazy.
- [ ] Every roadmap site is labelled `ROADMAP · NOT IN SCOPE FOR PS 26009`.
- [ ] The exaggeration factor is displayed in every 3D state, globe included.

---

## 12. RESOURCES

**Technique reference — rotating 3D globe**
Bezdék A, Šebera J (2013), *MATLAB script for 3D visualizing geodata on a rotating globe*,
Computers & Geosciences 56, 127–130.
`https://space.asu.cas.cz/~bezdek/vyzkum/rotating_3d_globe/index.php`
Take the method — normal-displacement with an exaggeration factor, coloured by the same
scalar — not the MATLAB code. Reimplement in GLSL.

**Data cube reference**
Lexcube — spatio-temporal data cube visualisation with per-face textured slices.
The look in reference images 4 and 5. `https://www.lexcube.org`

**Indian geospatial data**
- GSI Bhukosh — geology, aeromagnetic, geochemical: `https://bhukosh.gsi.gov.in/Bhukosh/Public`
- ISRO Bhuvan — CartoDEM, thematic layers: `https://bhuvan.nrsc.gov.in`
- ISRO Bhoonidhi — EO archive, NISAR S-band samples
- Copernicus Open Access Hub — Sentinel-1, Sentinel-2
- USGS EarthExplorer — Landsat 8/9, ASTER (pre-2008 for SWIR)
- GEBCO — global bathymetry, for the globe and Site 5
- Natural Earth — coastlines and boundaries, public domain

**Deep Ocean Mission / CIOB**
Ministry of Earth Sciences and NIOT publications on polymetallic nodule exploration; ISA
contract documentation for India's CIOB area.

**Libraries**
`three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`,
`@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/aggregation-layers`, `maplibre-gl`,
`zustand`, `framer-motion`, `@react-spring/three`, `recharts`, `d3-scale`, `d3-interpolate`,
`d3-geo`, `simplex-noise`, `seedrandom`.

---

## 13. WHAT TO CUT IF TIME RUNS SHORT

In this order, from first to cut:

1. Globe clipping plane (§2.5)
2. Site 5 nodule field — replace with a static card
3. Site 3 drainage extraction — replace with a static swipe image
4. Data cube slice handles — keep the static textured cube
5. `SATELLITE` basemap mode — three modes is enough
6. Site 2 rose diagram

**Never cut:** the globe itself, the flight to Sausar, `TACTICAL` mode, the swipe divider, or
anything in Part I states S1 to S4. A globe that flies to one beautifully finished site beats
five half-built ones, every time.

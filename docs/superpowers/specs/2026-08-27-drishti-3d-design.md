# DRISHTI 3D — One-Day Build Design

**Date:** 2026-08-27
**Source specs:** `DRISHTI-3D_BUILD_SPEC.md` (Part I), `DRISHTI-3D_BUILD_SPEC_PART-II.md` (Part II)
**Problem statement:** SIH 2026 · PS 26009 · MOIL Ltd
**Budget:** ~12 working hours, one person, agent-assisted

This document supersedes Parts I and II wherever they conflict with it. Parts I and II remain
authoritative for anything this document does not mention — in particular the colour tokens,
the type scale, the shader maths, the honesty requirements and the demo script.

---

## 1. What is being built

A single-page WebGL application. Five states, one continuous three.js scene, no page reloads:

```
GLOBE  →  FLAT  →  RELIEF  →  BLOCK  →  SUBSURFACE
          └──────── Sausar Belt, Site 1 only ────────┘
```

Breadcrumb in the topbar: `GLOBE › SAUSAR BELT › BLOCK MODEL`, each segment clickable, every
state reachable forward and backward.

Both halves of PS 26009 ship: **exploration** (prospectivity, SHAP, block model, drill queue)
and **operations** (production forecast, shortfall risk, recommended actions with a working
`SIMULATE`).

---

## 2. Decisions locked

| Decision | Ruling | Why |
|---|---|---|
| Product name | **DRISHTI** | Both specs use it throughout; breadcrumb and state naming assume it. Deck says MANG-AI — reconcile verbally, see §7. |
| Renderer | **three.js only. No MapLibre, no deck.gl.** | Part I §14 M4 calls the MapLibre→three.js camera sync "the hardest part of the build." It exists only because there are two renderers. Deleting it deletes the risk and ~400 KB gzipped. |
| State S1 FLAT | Same terrain mesh, vertical exaggeration tweened to 0, top-down camera | "No visual jump between S1 and S2" stops being a handover and becomes a tween. Free correctness. |
| Basemap | Single pre-rendered PNG under the terrain | Part II §4.2 already mandates static PNGs for SATELLITE. Same instinct, applied to all modes. |
| Globe → site | **Camera push-in + 400ms crossfade**, not a spherical→planar morph | Part II §6 calls the true handover "finicky." It is a 4-hour rabbit hole. On a projector the crossfade reads as a flight. |
| States G1 NATION, G2 SITE SELECT | **Cut** | Only one site ships. A site selector with one site is chrome. |
| Sites 2–5 | Registry entries + greyed `ROADMAP` cards. No geometry. | Part II §13: "A globe that flies to one beautifully finished site beats five half-built ones." |
| Backend | **None.** `src/data/api.ts` is an async facade over the in-memory generator. | Part I §1. Swapping in FastAPI later is a one-file change — say exactly that on stage. |
| Seed | `seedrandom('26009')` everywhere | Identical scene on every run and every machine. A demo that changes each reload cannot be rehearsed. |

---

## 3. Corrections to the source specs

These are defects in Parts I and II. Fix them in the implementation; do not copy them forward.

1. **Part I §1's bounding box drops 6 of the 11 mines.** It states `lon 79.30 → 80.35`, but
   Kandri (79.18), Munsar (79.22), Beldongri (79.15), Gumgaon (79.12) and Ukwa (80.42) fall
   outside it, and Parsoda (79.30) sits exactly on the edge.
   **Use Part II §5's Site 1 bounds: `79.05–80.50 E, 21.05–22.00 N`.** Part I §1 is superseded.

2. **The mine boost invalidates the validation claim.** Part I §4.1 step 7 multiplies
   probability by 1.25 near the 11 mines, but Part I §3's State 1 claim is *"we never told the
   model where these are — leave-one-mine-out validation."* If the generator seeds the answer,
   the success-rate curve in widget 6.1 measures an injected effect.
   **Ship with `mineBoost = 0`.** Orient the fold axis along the real mine trend so the mines
   land in the hot zones because of the structure. Keep the boost as a debug constant only.

3. **`--panel-hi` is corrupt** in Part I §2.2: `#1B2husband129` → **`#1B2129`**.

4. **Part I §11.5 vs Part II §5.** "Never render a tonnage estimate" conflicts with Site 5's
   380 Mt / 92.6 Mt figures. Those are published ISA / MoES numbers about an existing resource,
   not model output. **On-screen attribution is mandatory** wherever they appear. No tonnage is
   ever derived from our own model.

5. **No reference image exists for TACTICAL mode** (Part II §4.3). The folder has reference
   images 1, 2, 4 and 5 but not 3. TACTICAL is cut for the one-day build (§5), so this is not
   blocking — but do not attempt it from the text description alone.

6. **Part II §0 renumbers Part I's states.** Part I says four states, Part II says seven, this
   document says five (Part II's G1 and G2 are cut). Only this document's numbering is live.

---

## 4. Architecture

### 4.1 State machine

```ts
type ViewState = 'GLOBE' | 'FLAT' | 'RELIEF' | 'BLOCK' | 'SUBSURFACE';
```

Transitions are driven **only** through `setView`. No component mutates the camera or the scene
directly. This is what stops the demo desynchronising on stage (Part I §5).

### 4.2 Scene graph — one canvas

```
<Canvas dpr={[1,2]} powerPreference="high-performance">
  <GlobeScene />        visible: GLOBE, and during the crossfade
  <SiteScene>
    <Terrain />         FLAT (VE 0) · RELIEF (VE 2.4) · translucent ceiling in SUBSURFACE
    <VoxelField />      BLOCK · SUBSURFACE — one InstancedMesh
    <DrillTrace />      SUBSURFACE
    <DepthRuler />      BLOCK · SUBSURFACE
    <MineMarkers />     FLAT · RELIEF
  </SiteScene>
  <CameraRig />         sole owner of the camera, reacts to setView
  <Effects />           Bloom + Vignette, lazy-loaded, auto-disabled on software renderers
</Canvas>
```

### 4.3 Data flow

`generate.ts` (seed 26009) → in-memory tables → `api.ts` async facade → Zustand store →
components. Nothing fetches at runtime except the globe relief PNG and the basemap PNG, both
shipped in `/public/data/`.

### 4.4 Where the extra two hours come from

Both spectacle and operations fit only because these are built once and used twice. This is not
an optimisation to apply later — it is the reason the schedule closes.

| Built once | Serves |
|---|---|
| `Waterfall.tsx` | SHAP driver panel (Part I §6.2) **and** operations driver waterfall (§6.7). Part I §6.7 explicitly says "same visual grammar." |
| `ramp.ts` + `oreRamp.glsl` | terrain shader, voxel shader, legend, SHAP bars, risk pills |
| one production series | forecast chart (§6.5), risk-board sparklines (§6.6), and the `SIMULATE` counterfactual |
| one column probability array | `DepthProfile` widget (§6.3) **and** the 3D `DrillTrace` (§3 S4) — which is also why they stay in sync, an acceptance criterion |
| one terrain mesh | S1 FLAT and S2 RELIEF |

---

## 5. Cut list

**Cut to fund the schedule** (restore in this order if hours appear):

1. `EXPLODE` and `SECTION` sliders in State 3 — `CUTOFF` and `DEPTH SLICE` carry the demo per Part I §10
2. Mine workings geometry in S4 — the drill trace is the high-value artefact per Part I §3 S4
3. Globe atmosphere fresnel shell and coastline GeoJSON — keep displaced sphere, stars, pins
4. UTM 44N conversion in the target inspector — decimal degrees only
5. Layer swipe divider (Part II §4.5) — nothing to swipe against without a second raster
6. `TACTICAL`, `NORMAL`, `SATELLITE` basemap modes — `HEATMAP` only
7. `SECTION EARTH` globe clip plane (Part II §2.5) — already first on Part II's own cut list

**Out of scope entirely:** sites 2–5 geometry, DataCube, rose diagram, drainage extraction,
nodule field, auth, backend, mobile layout, light mode, any test beyond the ore-ramp parity test.

**Never cut:** the deposits toggle, the CUTOFF slider, the confidence drape, the drill trace,
`PROTOTYPE · SYNTHETIC DATA`, the vertical-exaggeration label, the WebGL fallback.

---

## 6. Hour plan with verification gates

```
0.0–0.5   Scaffold: Vite + React 18 + TS strict + Tailwind + tokens + fonts + shell
          + PROTOTYPE · SYNTHETIC DATA badge
          verify: dark shell renders, all three fonts load, tokens resolve

0.5–2.0   generate.ts — synform horizon, elevation fBm, prospectivity, confidence,
          SHAP vectors, 11×132 production series
   GATE   verify: dump prospectivity + elevation to PNG. Must read as folded geology,
          not Perlin clouds. Validation script asserts 11/11 mines inside the top 5%
          of ranked area with mineBoost = 0.  DO NOT PROCEED UNTIL BOTH PASS.

2.0–2.4   ramp.ts + oreRamp.glsl + 21-sample parity test within 1/255
          verify: test passes (the only test in scope)

2.4–3.8   S2 RELIEF — terrain mesh, ore-ramp shader, contour overlay, drape switch
          verify: PROSPECTIVITY ↔ CONFIDENCE crossfades over 500ms, 60fps

3.8–4.2   S1 FLAT — camera preset, VE→0, mine markers, SHOW KNOWN DEPOSITS toggle
          verify: FLAT ↔ RELIEF round-trips with no visual jump

4.2–5.6   S3 BLOCK — InstancedMesh, per-instance attributes, in-shader CUTOFF and
          DEPTH SLICE via discard
   GATE   verify: ≥55fps while dragging DEPTH SLICE, ≤30k instances, ≤12 draw calls.
          Filtering must not rebuild the instance buffer.

5.6–7.0   The staged bloom animation per Part I §3 S3
          verify: at t=200ms the voxel field is visually continuous with the terrain
          it replaced. prefers-reduced-motion jumps straight to settled.

7.0–7.8   S4 SUBSURFACE — FogExp2, translucent ceiling, drill trace with 10m ticks
          verify: strip log in the widget matches the trace in the scene

7.8–8.5   Left rail EXPLORATION — ModelValidation, Waterfall(SHAP), TargetInspector,
          DepthProfile
          verify: three different cells give three visibly different SHAP panels

8.5–9.7   Left rail OPERATIONS — ProductionForecast, RiskBoard, Waterfall(drivers),
          RecommendedActions with working SIMULATE
          verify: SIMULATE visibly lifts the P10–P90 band above the plan line

9.7–10.4  Globe cold open — displaced sphere, star field, site pins, crossfade to Sausar
          verify: 60fps rotating; crossfade has no pop

10.4–11.2 Chrome — legend, depth ruler, coordinate readout, ABOUT DATA panel,
          GeoJSON export, WebGL2 fallback, focus rings
          verify: export opens as valid GeoJSON; WebGL disabled still shows FLAT + dashboard

11.2–12.0 Performance pass against Part I §8. Run the demo script twice against a
          stopwatch. Record the offline backup video.
```

Two hard gates: **2.0** (the data is credible) and **5.6** (it holds framerate). Neither is
negotiable — everything downstream is worthless if either fails.

---

## 7. The deck reconciliation

The submitted SIH deck (slide 3, team ALGOFLEET) promises Leaflet + Mapbox + Cesium,
Python/FastAPI, PostgreSQL/PostGIS and login with two-step verification, under the name MANG-AI.
This prototype ships none of those. That is a defensible position, but only if stated first:

> *"The deck describes the production architecture. What you're seeing is its front end, running
> against a deterministic synthetic generator behind the same async API the FastAPI service will
> implement — one file changes. We cut auth and the database out of the prototype because
> neither is what this problem statement is about."*

Say it before a judge asks. If asked why not Cesium: first paint and frame budget on unknown
projector hardware.

---

## 8. Acceptance criteria — one-day scope

- [ ] All five states transition in both directions with no visual jump and no reload.
- [ ] `SHOW KNOWN DEPOSITS` visibly places MOIL's 11 mines inside high-probability zones,
      with `mineBoost = 0`.
- [ ] Dragging `CUTOFF` from 0.30 to 0.75 leaves a continuous, folded, plausible ore horizon.
- [ ] The block model holds ≥55fps while `DEPTH SLICE` is dragged.
- [ ] Three different cells produce three visibly different SHAP panels.
- [ ] The depth-profile widget matches the 3D drill trace.
- [ ] `SIMULATE` visibly lifts the forecast band above the plan line.
- [ ] `ADD TO DRILL QUEUE` → export produces a valid, openable GeoJSON file.
- [ ] Legend colours match scene colours exactly (parity test green).
- [ ] `PROTOTYPE · SYNTHETIC DATA` and the vertical-exaggeration label are visible in every state.
- [ ] With WebGL disabled, FLAT and the full dashboard still render with an honest message.
- [ ] The demo script runs without a stall, twice in a row, inside 3:30.

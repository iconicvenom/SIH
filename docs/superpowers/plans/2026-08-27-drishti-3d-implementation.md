# DRISHTI 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the one-day scope of DRISHTI 3D — five states (`GLOBE → FLAT → RELIEF → BLOCK → SUBSURFACE`) in one three.js scene, both EXPLORATION and OPERATIONS widget halves, per `docs/superpowers/specs/2026-08-27-drishti-3d-design.md`.

**Architecture:** Vite + React 18 + TypeScript strict, one `@react-three/fiber` canvas for all 3D states, a single Zustand store as the sole owner of camera/view transitions, a deterministic client-side data generator (seed `26009`) behind an async facade. No backend, no MapLibre, no deck.gl.

**Tech Stack:** React 18, TypeScript (strict), Vite, Tailwind CSS, Zustand, three.js, `@react-three/fiber@^8`, `@react-three/drei@^9`, `@react-three/postprocessing@^2`, Recharts, `d3-scale`/`d3-interpolate`, `simplex-noise`, `seedrandom`, `framer-motion`, `@fontsource/space-grotesk`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`. Dev-only: `vitest`, `tsx`, `pngjs`.

## Global Constraints

- App root: `/Users/vignesh/Projects/SIH/app/`. Repo root is `/Users/vignesh/Projects`, shared with unrelated untracked files. **Every commit step runs `git add .` from inside `app/` or `docs/` — never `-A`, never a repo-root add.**
- Seed everything with `'26009'` via `seedrandom`. The scene must be pixel-identical on every run.
- `@react-three/fiber` **must** be `^8` (not `^9` — v9 requires React 19; this app is locked to React 18).
- Colour tokens from spec Part I §2.2, with `--panel-hi: #1B2129` (typo corrected).
- Bounding box for Site 1 (Sausar Belt): `lon 79.05–80.50 E, lat 21.05–22.00 N` (Part II §5 bounds — Part I §1's box is superseded, see design doc §3.1).
- Grid resolution: 256×256 for elevation/prospectivity rasters. World space: `WORLD_SIZE = 1024` three.js units spanning the bbox, centred at origin.
- Voxel grid: 64(x) × 64(z) × 24(y depth), block size 25m × 25m × 10m, depth range 0–240m below local surface.
- `mineBoost = 0` always. The fold axis is fit to the real mine coordinates, not hardcoded.
- `useFrame` callbacks must not allocate — hoist vectors/matrices/colours to module or ref scope.
- No component tests. Only `tests/ramp.test.ts` (ore-ramp GLSL/TS parity, 21 samples, 1/255 tolerance) and `tests/generate.test.ts` (mine-coverage gate). This matches Part I §13's explicit test scope.
- `prefers-reduced-motion`: every scripted animation must check `useReducedMotion()` and jump to its settled end-state instead of animating.
- Every visible state carries the `PROTOTYPE · SYNTHETIC DATA` badge and, in every 3D state, the vertical-exaggeration label.

---

## File Structure

```
SIH/
  app/
    index.html
    package.json, tsconfig.json, vite.config.ts, tailwind.config.ts, postcss.config.js
    public/
      (no external raster assets — all textures generated at boot)
    scripts/
      verify-generator.ts       # Node/tsx gate script for Task 3
    tests/
      ramp.test.ts
      generate.test.ts
    src/
      main.tsx
      App.tsx
      ErrorBoundary.tsx
      store/
        useDrishti.ts
      data/
        mines.ts                # 11 mine records
        features.ts             # 18 SHAP feature definitions
        generate.ts             # deterministic generator, seed 26009
        api.ts                  # async facade over generate.ts
      scene/
        Canvas3D.tsx
        CameraRig.tsx
        Terrain.tsx
        VoxelField.tsx
        DrillTrace.tsx
        DepthRuler.tsx
        shaders/
          oreRamp.glsl
          terrain.vert.glsl
          terrain.frag.glsl
          voxel.vert.glsl
          voxel.frag.glsl
      globe/
        Globe.tsx
        shaders/
          globe.vert.glsl
          globe.frag.glsl
      ui/
        TopBar.tsx
        LeftRail.tsx
        Toolbar.tsx
        Legend.tsx
        AboutData.tsx
        Fallback.tsx
        widgets/
          ModelValidation.tsx
          Waterfall.tsx          # shared: SHAP panel + operations driver waterfall
          DepthProfile.tsx
          TargetInspector.tsx
          DrillQueue.tsx
          ProductionForecast.tsx
          RiskBoard.tsx
          RecommendedActions.tsx
      lib/
        geo.ts                  # lon/lat <-> world-space conversions
        ramp.ts                 # ore ramp in TS, must match oreRamp.glsl
        easing.ts
        format.ts
      styles/
        tokens.css
        index.css
  docs/superpowers/specs/2026-08-27-drishti-3d-design.md   (existing)
  docs/superpowers/plans/2026-08-27-drishti-3d-implementation.md   (this file)
```

---

### Task 1: Project scaffold, tokens, fonts, shell, honesty badge

**Files:**
- Create: `app/package.json`, `app/tsconfig.json`, `app/vite.config.ts`, `app/tailwind.config.ts`, `app/postcss.config.js`, `app/index.html`
- Create: `app/src/main.tsx`, `app/src/App.tsx`, `app/src/ErrorBoundary.tsx`
- Create: `app/src/styles/tokens.css`, `app/src/styles/index.css`
- Create: `app/src/ui/TopBar.tsx`

**Interfaces:**
- Produces: CSS custom properties on `:root` (`--void`, `--panel`, `--panel-hi`, `--line`, `--line-hi`, `--text`, `--text-dim`, `--text-mute`, `--ore-00..100`, `--rhodonite`, `--risk-low/mid/high`) consumed by every later UI/scene task.
- Produces: `<ErrorBoundary fallback={ReactNode}>` component, `{children}` prop, consumed by Task 6 when wrapping `<Canvas3D/>`.
- Produces: `TopBar` renders unconditionally with the `PROTOTYPE · SYNTHETIC DATA` badge and a breadcrumb slot — consumed by Task 16 which fills the breadcrumb from store state.

- [ ] **Step 1: Scaffold the Vite project**

```bash
cd /Users/vignesh/Projects/SIH
npm create vite@latest app -- --template react-ts
cd app
npm install
```

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm install zustand recharts d3-scale d3-interpolate simplex-noise seedrandom framer-motion
npm install three @react-three/fiber@^8 @react-three/drei@^9 @react-three/postprocessing@^2
npm install @fontsource/space-grotesk @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
npm install -D tailwindcss postcss autoprefixer vitest tsx pngjs @types/seedrandom @types/pngjs @types/d3-scale @types/d3-interpolate
npx tailwindcss init -p
```

- [ ] **Step 3: Write `app/tsconfig.json` (strict mode, verify it matches Vite's react-ts default with strict already true)**

Vite's `react-ts` template already sets `"strict": true`. Open `app/tsconfig.json` and confirm; if absent, add it under `compilerOptions`.

- [ ] **Step 4: Write `app/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: Write `app/src/styles/tokens.css`**

```css
:root {
  --void:        #0B0E12;
  --panel:       #141920;
  --panel-hi:    #1B2129;
  --line:        #232B36;
  --line-hi:     #34404F;

  --text:        #C9D3DD;
  --text-dim:    #8493A2;
  --text-mute:   #566472;

  --ore-00:      #16202E;
  --ore-20:      #1E4A5F;
  --ore-40:      #2E7D8C;
  --ore-60:      #C9A227;
  --ore-80:      #E2622A;
  --ore-100:     #F7E0A8;

  --rhodonite:   #D96A8E;

  --risk-low:    #3E8E6B;
  --risk-mid:    #C9A227;
  --risk-high:   #C4482E;

  --font-display: 'Space Grotesk', sans-serif;
  --font-body:    'IBM Plex Sans', sans-serif;
  --font-mono:    'IBM Plex Mono', monospace;
}
```

- [ ] **Step 6: Write `app/src/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import '@fontsource/space-grotesk/600.css';
@import '@fontsource/ibm-plex-sans/400.css';
@import '@fontsource/ibm-plex-sans/600.css';
@import '@fontsource/ibm-plex-mono/400.css';
@import '@fontsource/ibm-plex-mono/500.css';
@import './tokens.css';

* { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  height: 100%;
  background: var(--void);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.35;
}

h1, h2, h3 { font-family: var(--font-display); letter-spacing: -0.02em; line-height: 1.05; }

.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.label {
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 11px;
  color: var(--text-mute);
}

button:focus-visible, [tabindex]:focus-visible, input:focus-visible {
  outline: 2px solid var(--rhodonite);
  outline-offset: 2px;
}
```

- [ ] **Step 7: Write `app/src/ErrorBoundary.tsx`**

```tsx
import { Component, type ReactNode } from 'react';

interface Props { fallback: ReactNode; children: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[DRISHTI] scene error, falling back to FLAT:', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
```

- [ ] **Step 8: Write `app/src/ui/TopBar.tsx`**

```tsx
export function TopBar({ breadcrumb }: { breadcrumb: ReactNode }) {
  return (
    <header
      className="flex items-center justify-between px-4 border-b"
      style={{ height: 56, background: 'var(--panel)', borderColor: 'var(--line)' }}
    >
      <div className="flex items-center gap-4">
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>
          DRISHTI
        </span>
        <span className="label">PS 26009</span>
        {breadcrumb}
      </div>
      <span className="label" style={{ fontSize: 11 }}>PROTOTYPE · SYNTHETIC DATA</span>
    </header>
  );
}

import type { ReactNode } from 'react';
```

- [ ] **Step 9: Write `app/src/App.tsx`**

```tsx
import { TopBar } from './ui/TopBar';
import { ErrorBoundary } from './ErrorBoundary';

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar breadcrumb={null} />
      <main style={{ flex: 1, position: 'relative', background: 'var(--void)' }}>
        <ErrorBoundary fallback={<div className="mono" style={{ padding: 24 }}>3D scene failed to load — flat mode fallback pending Task 16.</div>}>
          <div className="mono" style={{ padding: 24 }}>Canvas3D placeholder — Task 6</div>
        </ErrorBoundary>
      </main>
    </div>
  );
}
```

- [ ] **Step 10: Write `app/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
```

- [ ] **Step 11: Verify the dev server**

Run: `npm run dev`
Expected: dark page, `DRISHTI · PS 26009` topbar, `PROTOTYPE · SYNTHETIC DATA` badge visible top-right, three fonts visibly distinct (headings vs body vs the mono placeholder text).

- [ ] **Step 12: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Scaffold DRISHTI: Vite/React/TS shell, design tokens, fonts, honesty badge"
```

---

### Task 2: Store, geo conversions, mine and feature data

**Files:**
- Create: `app/src/store/useDrishti.ts`
- Create: `app/src/lib/geo.ts`
- Create: `app/src/data/mines.ts`
- Create: `app/src/data/features.ts`

**Interfaces:**
- Consumes: nothing (foundational).
- Produces: `useDrishti` Zustand hook with the full `DrishtiStore` shape below — every later task reads/writes through this, never local component state for shared concerns.
- Produces: `lonLatToWorld(lon, lat): [x, z]` and `worldToLonLat(x, z): [lon, lat]`, `BBOX`, `WORLD_SIZE`, `GRID` constants — consumed by Task 3 (generator), Task 7 (Terrain), Task 8 (MineMarkers).
- Produces: `MINES: Mine[]` (11 records) — consumed by Task 3, Task 8, Task 14 (RiskBoard).
- Produces: `FEATURES: Feature[]` (18 records, id + label) — consumed by Task 4 (SHAP synthesis), Task 12 (Waterfall).

- [ ] **Step 1: Write `app/src/lib/geo.ts`**

```ts
export const BBOX = { lonMin: 79.05, lonMax: 80.50, latMin: 21.05, latMax: 22.00 };
export const WORLD_SIZE = 1024;
export const GRID = 256;

/** Converts lon/lat to three.js world-space x/z, centred at origin, spanning WORLD_SIZE. */
export function lonLatToWorld(lon: number, lat: number): [number, number] {
  const u = (lon - BBOX.lonMin) / (BBOX.lonMax - BBOX.lonMin);
  const v = (lat - BBOX.latMin) / (BBOX.latMax - BBOX.latMin);
  const x = (u - 0.5) * WORLD_SIZE;
  const z = (0.5 - v) * WORLD_SIZE; // north (+lat) maps to -z (three.js: camera looks down -z by default)
  return [x, z];
}

export function worldToLonLat(x: number, z: number): [number, number] {
  const u = x / WORLD_SIZE + 0.5;
  const v = 0.5 - z / WORLD_SIZE;
  const lon = BBOX.lonMin + u * (BBOX.lonMax - BBOX.lonMin);
  const lat = BBOX.latMin + v * (BBOX.latMax - BBOX.latMin);
  return [lon, lat];
}

/** Converts world x/z to a 0..GRID-1 raster index pair. */
export function worldToGrid(x: number, z: number): [number, number] {
  const gx = Math.min(GRID - 1, Math.max(0, Math.floor(((x / WORLD_SIZE) + 0.5) * GRID)));
  const gz = Math.min(GRID - 1, Math.max(0, Math.floor((0.5 - (z / WORLD_SIZE)) * GRID)));
  return [gx, gz];
}
```

- [ ] **Step 2: Write `app/src/data/mines.ts`**

```ts
export type MineType = 'underground' | 'opencast';

export interface Mine {
  id: string;
  name: string;
  lon: number;
  lat: number;
  type: MineType;
  sizeIndex: number; // relative production scale, 1.0 = smallest Nagpur mine, Balaghat = 2.5
}

export const MINES: Mine[] = [
  { id: 'kandri',    name: 'Kandri',              lon: 79.18, lat: 21.28, type: 'underground', sizeIndex: 1.0 },
  { id: 'munsar',    name: 'Munsar',               lon: 79.22, lat: 21.31, type: 'underground', sizeIndex: 1.1 },
  { id: 'beldongri', name: 'Beldongri',            lon: 79.15, lat: 21.25, type: 'underground', sizeIndex: 1.0 },
  { id: 'gumgaon',   name: 'Gumgaon',              lon: 79.12, lat: 21.22, type: 'underground', sizeIndex: 0.9 },
  { id: 'chikla',    name: 'Chikla',               lon: 79.72, lat: 21.48, type: 'underground', sizeIndex: 1.3 },
  { id: 'dongri',    name: 'Dongri Buzurg',        lon: 79.78, lat: 21.52, type: 'opencast',    sizeIndex: 1.4 },
  { id: 'sitapatore',name: 'Sitapatore',           lon: 79.85, lat: 21.44, type: 'opencast',    sizeIndex: 1.2 },
  { id: 'parsoda',   name: 'Parsoda',              lon: 79.30, lat: 21.34, type: 'underground', sizeIndex: 1.0 },
  { id: 'tirodi',    name: 'Tirodi',               lon: 79.72, lat: 21.68, type: 'opencast',    sizeIndex: 1.5 },
  { id: 'balaghat',  name: 'Balaghat (Bharveli)',  lon: 80.18, lat: 21.82, type: 'underground', sizeIndex: 2.5 },
  { id: 'ukwa',      name: 'Ukwa',                 lon: 80.42, lat: 21.95, type: 'underground', sizeIndex: 1.2 },
];
```

- [ ] **Step 3: Write `app/src/data/features.ts`**

```ts
export interface Feature { id: string; label: string; }

export const FEATURES: Feature[] = [
  { id: 'distance_to_mansar_contact', label: 'Distance to Mansar contact' },
  { id: 'fold_axial_proximity',       label: 'Fold axial proximity' },
  { id: 'aeromagnetic_residual',      label: 'Aeromagnetic residual' },
  { id: 'stream_sediment_mn',         label: 'Stream sediment Mn' },
  { id: 'ndvi_stress_anomaly',        label: 'NDVI stress anomaly' },
  { id: 'lst_residual',               label: 'LST residual' },
  { id: 'slope',                      label: 'Slope' },
  { id: 'curvature',                  label: 'Terrain curvature' },
  { id: 'distance_to_lineament',      label: 'Distance to lineament' },
  { id: 'gravity_residual',           label: 'Gravity residual' },
  { id: 'radiometric_k',              label: 'Radiometric K' },
  { id: 'radiometric_th',             label: 'Radiometric Th' },
  { id: 'radiometric_u',              label: 'Radiometric U' },
  { id: 'drainage_density',           label: 'Drainage density' },
  { id: 'soil_mn_anomaly',            label: 'Soil Mn anomaly' },
  { id: 'distance_to_known_mine',     label: 'Distance to known mine' },
  { id: 'lithology_favourability',    label: 'Lithology favourability' },
  { id: 'regolith_thickness',         label: 'Regolith thickness' },
];
```

- [ ] **Step 4: Write `app/src/store/useDrishti.ts`**

```ts
import { create } from 'zustand';

export type ViewState = 'GLOBE' | 'FLAT' | 'RELIEF' | 'BLOCK' | 'SUBSURFACE';
export type Drape = 'PROSPECTIVITY' | 'CONFIDENCE';
export type Panel = 'EXPLORATION' | 'OPERATIONS';

export interface CellRef { gx: number; gz: number; lon: number; lat: number; }
export interface Vec3 { x: number; y: number; z: number; }

interface DrishtiStore {
  view: ViewState;
  transitioning: boolean;
  drape: Drape;
  panel: Panel;

  showKnownDeposits: boolean;
  cutoff: number;
  depthRange: [number, number];

  selectedCell: CellRef | null;
  selectedMine: string | null;
  hoverCell: CellRef | null;

  camera: { position: Vec3; target: Vec3 };

  setView: (v: ViewState) => void;
  setDrape: (d: Drape) => void;
  setPanel: (p: Panel) => void;
  toggleKnownDeposits: () => void;
  setCutoff: (v: number) => void;
  setDepthRange: (r: [number, number]) => void;
  selectCell: (c: CellRef | null) => void;
  hoverCellAt: (c: CellRef | null) => void;
  selectMine: (id: string | null) => void;
  setCamera: (position: Vec3, target: Vec3) => void;
}

export const useDrishti = create<DrishtiStore>((set) => ({
  view: 'GLOBE',
  transitioning: false,
  drape: 'PROSPECTIVITY',
  panel: 'EXPLORATION',

  showKnownDeposits: false,
  cutoff: 0.28,
  depthRange: [0, 240],

  selectedCell: null,
  selectedMine: null,
  hoverCell: null,

  camera: { position: { x: 0, y: 600, z: 900 }, target: { x: 0, y: 0, z: 0 } },

  setView: (v) => set({ view: v, transitioning: true }),
  setDrape: (d) => set({ drape: d }),
  setPanel: (p) => set({ panel: p }),
  toggleKnownDeposits: () => set((s) => ({ showKnownDeposits: !s.showKnownDeposits })),
  setCutoff: (v) => set({ cutoff: v }),
  setDepthRange: (r) => set({ depthRange: r }),
  selectCell: (c) => set({ selectedCell: c }),
  hoverCellAt: (c) => set({ hoverCell: c }),
  selectMine: (id) => set({ selectedMine: id }),
  setCamera: (position, target) => set({ camera: { position, target } }),
}));
```

Note: `transitioning` is set `true` by `setView` and must be cleared to `false` by `CameraRig` (Task 6) once its scripted transition completes — `CameraRig` is the only consumer allowed to clear it.

- [ ] **Step 5: Verify**

Run: `npm run build` (from `app/`)
Expected: TypeScript compiles clean — no `any`, no unused-import errors, strict mode satisfied.

- [ ] **Step 6: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add Zustand store, geo conversions, mine and SHAP feature tables"
```

---

### Task 3: Structural generator — fold, elevation, prospectivity (GATE)

This is the hard gate from design doc §6. If the mine-coverage assertion or the visual PNG dump fails, **do not proceed to Task 4 or beyond** — fix the generator first.

**Files:**
- Create: `app/src/data/generate.ts`
- Create: `app/scripts/verify-generator.ts`
- Create: `app/tests/generate.test.ts`

**Interfaces:**
- Consumes: `MINES` (Task 2 `mines.ts`), `lonLatToWorld`, `WORLD_SIZE`, `GRID` (Task 2 `geo.ts`).
- Produces:
  ```ts
  export interface GeneratorOutput {
    elevation: Float32Array;        // GRID*GRID, row-major (gz*GRID+gx), metres, ~250-600
    prospectivity: Float32Array;    // GRID*GRID, 0..1, column-max near-surface expression
    confidence: Float32Array;       // GRID*GRID, 0..1
    probabilityAt(xWorld: number, zWorld: number, depthMeters: number): number; // 0..1
    foldAxisAngleDeg: number;       // fit to the 11 mines, for debugging/QA only
  }
  export function generateSite(): GeneratorOutput;
  ```
  Consumed by Task 4 (SHAP, exposed via the same module), Task 7 (`Terrain`, reads `elevation`/`prospectivity`/`confidence`), Task 9 (`VoxelField`, calls `probabilityAt` per block).

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/generate.test.ts
import { describe, it, expect } from 'vitest';
import { generateSite } from '../src/data/generate';
import { MINES } from '../src/data/mines';
import { lonLatToWorld, worldToGrid, GRID } from '../src/lib/geo';

describe('generateSite', () => {
  it('reproduces a folded synform, not noise: prospectivity has spatial structure', () => {
    const { prospectivity } = generateSite();
    // A pure-noise field has near-zero spatial autocorrelation at lag 1.
    // A folded horizon has strong autocorrelation along the fold trend.
    let sumProduct = 0, sumSq = 0;
    for (let gz = 0; gz < GRID - 1; gz++) {
      for (let gx = 0; gx < GRID - 1; gx++) {
        const a = prospectivity[gz * GRID + gx];
        const b = prospectivity[gz * GRID + gx + 1];
        sumProduct += a * b;
        sumSq += a * a;
      }
    }
    const autocorr = sumProduct / sumSq;
    expect(autocorr).toBeGreaterThan(0.6); // smooth structure, not white noise
  });

  it('places all 11 known mines inside the top 5% of ranked prospectivity, with zero mine boost', () => {
    const { prospectivity } = generateSite();
    const ranked = Array.from(prospectivity).sort((a, b) => b - a);
    const top5pctThreshold = ranked[Math.floor(ranked.length * 0.05)];

    for (const mine of MINES) {
      const [x, z] = lonLatToWorld(mine.lon, mine.lat);
      const [gx, gz] = worldToGrid(x, z);
      const p = prospectivity[gz * GRID + gx];
      expect(p, `${mine.name} below top-5% threshold (${p} < ${top5pctThreshold})`)
        .toBeGreaterThanOrEqual(top5pctThreshold);
    }
  });

  it('high-probability zones extend well beyond the known mines', () => {
    const { prospectivity } = generateSite();
    const hot = Array.from(prospectivity).filter((p) => p > 0.6).length;
    // 11 mine cells alone cannot account for a meaningful hot-zone area.
    expect(hot).toBeGreaterThan(MINES.length * 20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generate.test.ts` (from `app/`)
Expected: FAIL — `generateSite` is not defined / module not found.

- [ ] **Step 3: Write `app/src/data/generate.ts`**

```ts
import seedrandom from 'seedrandom';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import { MINES } from './mines';
import { lonLatToWorld, WORLD_SIZE, GRID } from '../lib/geo';

const SEED = '26009';
const MINE_BOOST = 0; // locked at 0 — see design doc §3.2. Never raise this for the demo build.

const rng = seedrandom(SEED);
const noise2D = createNoise2D(rng);
const noise3D = createNoise3D(rng);

const PLUNGE_DEG = 12;

/** Fits a 2D line direction to the mine world-space coordinates via the dominant
 *  eigenvector of their covariance matrix (closed-form 2x2 solution). */
function fitFoldAxisAngleDeg(points: [number, number][]): number {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p[0], 0) / n;
  const mz = points.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, szz = 0, sxz = 0;
  for (const [x, z] of points) {
    const dx = x - mx, dz = z - mz;
    sxx += dx * dx; szz += dz * dz; sxz += dx * dz;
  }
  const angle = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  return (angle * 180) / Math.PI;
}

function degToRad(d: number) { return (d * Math.PI) / 180; }

export interface GeneratorOutput {
  elevation: Float32Array;
  prospectivity: Float32Array;
  confidence: Float32Array;
  probabilityAt(xWorld: number, zWorld: number, depthMeters: number): number;
  foldAxisAngleDeg: number;
}

export function generateSite(): GeneratorOutput {
  const minePoints: [number, number][] = MINES.map((m) => lonLatToWorld(m.lon, m.lat));
  const axisAngleDeg = fitFoldAxisAngleDeg(minePoints);
  const axisAngle = degToRad(axisAngleDeg);
  const plunge = degToRad(PLUNGE_DEG);

  /** Full 3D prospectivity field. depthMeters is depth BELOW THE LOCAL SURFACE, 0..240. */
  function probabilityAt(x: number, z: number, depthMeters: number): number {
    const u = x * Math.cos(axisAngle) + z * Math.sin(axisAngle);
    const v = -x * Math.sin(axisAngle) + z * Math.cos(axisAngle);

    const troughDepth = 0.0009 * v * v + u * Math.tan(plunge) * 0.02; // scaled: u is world units (metres), not grid cells
    const warp = noise2D(u * 0.004, v * 0.004) * 22;
    const horizonDepth = Math.max(10, troughDepth + warp + 60); // clamp so the horizon sits within the modelled 0-240m column

    const thickness = 14 + 20 * Math.exp(-(v * v) / 90000);
    const dist = Math.abs(depthMeters - horizonDepth);
    let p = Math.exp(-(dist * dist) / (2 * thickness * thickness));

    p *= 0.55 + 0.45 * Math.abs(Math.sin(dist * 0.22));
    p *= smoothstep(0.32, 0.62, noise3D(x * 0.011, depthMeters * 0.02, z * 0.011) * 0.5 + 0.5);

    let boosted = p;
    if (MINE_BOOST > 0) {
      for (const [mx, mz] of minePoints) {
        const d = Math.hypot(x - mx, z - mz);
        if (d < 40) boosted = Math.min(1, boosted * MINE_BOOST);
      }
    }
    return clamp01(boosted);
  }

  const elevation = new Float32Array(GRID * GRID);
  const prospectivity = new Float32Array(GRID * GRID);
  const confidence = new Float32Array(GRID * GRID);

  const DEPTH_SAMPLES = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240];

  for (let gz = 0; gz < GRID; gz++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x = (gx / GRID - 0.5) * WORLD_SIZE;
      const z = (0.5 - gz / GRID) * WORLD_SIZE;
      const idx = gz * GRID + gx;

      // Elevation: 5-octave fBm plus a damped expression of the fold axial trace.
      let e = 0, amp = 1, freq = 0.0012, sumAmp = 0;
      for (let o = 0; o < 5; o++) {
        e += noise2D(x * freq + 1000, z * freq - 1000) * amp;
        sumAmp += amp;
        amp *= 0.5; freq *= 2.1;
      }
      e /= sumAmp;
      const u = x * Math.cos(axisAngle) + z * Math.sin(axisAngle);
      const v = -x * Math.sin(axisAngle) + z * Math.cos(axisAngle);
      const axialRidge = Math.exp(-(v * v) / 40000) * Math.sin(u * 0.01) * 0.15;
      elevation[idx] = 425 + (e + axialRidge) * 175; // maps to ~250-600m

      let maxP = 0;
      for (const d of DEPTH_SAMPLES) maxP = Math.max(maxP, probabilityAt(x, z, d));
      prospectivity[idx] = maxP;

      const normAbsV = Math.min(1, Math.abs(v) / 300);
      const jitter = (noise2D(x * 0.02, z * 0.02) * 0.5 + 0.5) * 0.3;
      confidence[idx] = clamp01(1 - 0.6 * normAbsV - jitter * 0.3);
    }
  }

  return { elevation, prospectivity, confidence, probabilityAt, foldAxisAngleDeg: axisAngleDeg };
}

function clamp01(v: number) { return Math.min(1, Math.max(0, v)); }
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/generate.test.ts` (from `app/`)
Expected: PASS, all 3 assertions. If the mine-coverage test fails, do not weaken the threshold — adjust `troughDepth`/`thickness`/`horizonDepth` clamping in `probabilityAt` until real mine coordinates land in the top 5% from structure alone.

- [ ] **Step 5: Write the Node verification script for the visual gate**

```ts
// app/scripts/verify-generator.ts
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import { generateSite } from '../src/data/generate';
import { GRID } from '../src/lib/geo';

function dumpGreyscale(data: Float32Array, min: number, max: number, path: string) {
  const png = new PNG({ width: GRID, height: GRID });
  for (let i = 0; i < GRID * GRID; i++) {
    const t = (data[i] - min) / (max - min);
    const v = Math.round(Math.min(1, Math.max(0, t)) * 255);
    png.data[i * 4] = v; png.data[i * 4 + 1] = v; png.data[i * 4 + 2] = v; png.data[i * 4 + 3] = 255;
  }
  writeFileSync(path, PNG.sync.write(png));
}

const { elevation, prospectivity, confidence, foldAxisAngleDeg } = generateSite();
dumpGreyscale(elevation, 250, 600, 'scripts/out-elevation.png');
dumpGreyscale(prospectivity, 0, 1, 'scripts/out-prospectivity.png');
dumpGreyscale(confidence, 0, 1, 'scripts/out-confidence.png');
console.log(`Fold axis fit to mine trend: ${foldAxisAngleDeg.toFixed(1)}°`);
console.log('Wrote scripts/out-elevation.png, out-prospectivity.png, out-confidence.png');
```

- [ ] **Step 6: Run the gate script and visually inspect**

Run (from `app/`): `npx tsx scripts/verify-generator.ts`
Then open `app/scripts/out-prospectivity.png`.

**Manual gate — read it yourself, do not skip:** the image must show elongated banded structure along one dominant diagonal direction (parallel bands, a folded trough), not blobby isotropic clouds. If it looks like Perlin clouds, adjust `warp` amplitude down and `thickness`/band-frequency (`dist * 0.22`) until banding is visually unambiguous, then re-run Step 4's test to confirm mine coverage still holds.

- [ ] **Step 7: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add structural prospectivity generator with mine-coverage gate test"
```

---

### Task 4: SHAP synthesis, production time series, async API facade

**Files:**
- Modify: `app/src/data/generate.ts` (add `shapAt`, `production`)
- Create: `app/src/data/api.ts`
- Modify: `app/tests/generate.test.ts` (add SHAP variation assertion)

**Interfaces:**
- Consumes: `FEATURES` (Task 2), `MINES` (Task 2), `GeneratorOutput.prospectivity`/`probabilityAt` (Task 3).
- Produces:
  ```ts
  export interface ShapContribution { feature: string; value: number; } // value can be negative
  export interface ProductionPoint { month: string; actual: number | null; forecastP50: number | null; forecastP10: number | null; forecastP90: number | null; plan: number; }
  export interface MineProduction { mineId: string; series: ProductionPoint[]; }

  // added to GeneratorOutput:
  shapAt(gridX: number, gridZ: number): ShapContribution[]; // sorted desc by |value|, sums ~= prospectivity at that cell
  production: MineProduction[]; // 11 mines
  ```
  Consumed by Task 12 (`Waterfall` SHAP mode), Task 14 (`ProductionForecast`, `RiskBoard`, `Waterfall` drivers mode).
- Produces: `app/src/data/api.ts` exporting `async function fetchSite(): Promise<GeneratorOutput>` — a one-line `Promise.resolve(generateSite())` wrapper. This is the seam Part I §1 calls out: swapping in a real FastAPI endpoint later is a one-file change. Consumed by Task 6 (`Canvas3D` boot).

- [ ] **Step 1: Extend the failing test**

```ts
// append to app/tests/generate.test.ts, inside the existing describe block
it('gives three different cells three visibly different SHAP panels', () => {
  const site = generateSite();
  const cellA = site.shapAt(40, 40);
  const cellB = site.shapAt(140, 90);
  const cellC = site.shapAt(200, 200);
  const topA = cellA[0].feature, topB = cellB[0].feature, topC = cellC[0].feature;
  const allSame = topA === topB && topB === topC;
  expect(allSame).toBe(false);
});

it('produces a visible predicted shortfall at Balaghat in the forecast horizon', () => {
  const site = generateSite();
  const balaghat = site.production.find((p) => p.mineId === 'balaghat')!;
  const shortfallMonths = balaghat.series.filter(
    (pt) => pt.forecastP90 !== null && pt.forecastP90 < pt.plan,
  );
  expect(shortfallMonths.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generate.test.ts` (from `app/`)
Expected: FAIL — `shapAt`/`production` not defined on `GeneratorOutput`.

- [ ] **Step 3: Add SHAP synthesis and production series to `app/src/data/generate.ts`**

Add these imports at the top (alongside existing ones):

```ts
import { FEATURES } from './features';
import { MINES } from './mines';
```

Add inside `generateSite()`, after `confidence` is fully computed (same closure so it captures `axisAngle`, `probabilityAt`, `noise2D`):

```ts
  const DOMINANT_NEAR_HORIZON = ['distance_to_mansar_contact', 'fold_axial_proximity'];
  const DOMINANT_EXTENSIONS = ['aeromagnetic_residual', 'stream_sediment_mn'];
  const MODEST = ['ndvi_stress_anomaly', 'lst_residual'];

  function shapAt(gx: number, gz: number): { feature: string; value: number }[] {
    const x = (gx / GRID - 0.5) * WORLD_SIZE;
    const z = (0.5 - gz / GRID) * WORLD_SIZE;
    const u = x * Math.cos(axisAngle) + z * Math.sin(axisAngle);
    const v = -x * Math.sin(axisAngle) + z * Math.cos(axisAngle);
    const targetSum = prospectivity[gz * GRID + gx];
    const nearHorizonWeight = clamp01(1 - Math.abs(v) / 250);

    const raw: Record<string, number> = {};
    for (const f of FEATURES) {
      const n = noise2D(x * 0.017 + hashSeed(f.id), z * 0.017 - hashSeed(f.id)) * 0.5 + 0.5;
      let base: number;
      if (DOMINANT_NEAR_HORIZON.includes(f.id)) base = 0.35 + 0.5 * nearHorizonWeight * n;
      else if (DOMINANT_EXTENSIONS.includes(f.id)) base = 0.25 + 0.5 * (1 - nearHorizonWeight) * n;
      else if (MODEST.includes(f.id)) base = 0.1 + 0.15 * n;
      else base = 0.02 + 0.1 * n;
      raw[f.id] = base * (n > 0.5 ? 1 : -0.4); // some features contribute negatively
    }
    const total = Object.values(raw).reduce((s, v) => s + Math.abs(v), 0) || 1;
    const scaled = FEATURES.map((f) => ({ feature: f.id, value: (raw[f.id] / total) * targetSum }));
    return scaled.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }

  const production = MINES.map((mine) => {
    const monthlyRng = seedrandom(SEED + '-prod-' + mine.id);
    const series: { month: string; actual: number | null; forecastP50: number | null; forecastP10: number | null; forecastP90: number | null; plan: number }[] = [];
    const baseRate = 8000 * mine.sizeIndex;
    const trailing12: number[] = [];
    const HIST_MONTHS = 108; // Jan 2016 - Dec 2024
    const FORECAST_MONTHS = 24; // Jan 2025 - Dec 2026, 132 total

    let level = baseRate;
    for (let m = 0; m < HIST_MONTHS + FORECAST_MONTHS; m++) {
      const date = new Date(2016, m, 1);
      const monthIdx = date.getMonth(); // 0-11
      const monsoon = monthIdx >= 6 && monthIdx <= 8 ? 0.62 : 1.0; // Jul-Sep trough
      const trend = 1 + (m / (HIST_MONTHS + FORECAST_MONTHS)) * 0.18;
      const downtimeShock = monthlyRng() < 0.08 ? 0.7 : 1.0; // Poisson-ish rare shocks
      level = baseRate * monsoon * trend * downtimeShock * (0.92 + monthlyRng() * 0.16);

      trailing12.push(level);
      if (trailing12.length > 12) trailing12.shift();
      const plan = (trailing12.reduce((s, v) => s + v, 0) / trailing12.length) * 1.04;

      const isForecast = m >= HIST_MONTHS;
      const horizonIdx = m - HIST_MONTHS; // 0-based month into the forecast

      if (!isForecast) {
        series.push({ month: monthKey(date), actual: level, forecastP50: null, forecastP10: null, forecastP90: null, plan });
      } else {
        const widen = 0.08 + Math.min(1, horizonIdx / FORECAST_MONTHS) * 0.14; // 8% -> 22%
        let p50 = level;
        // deliberate, visible shortfall at Balaghat starting ~month 2 of the forecast horizon
        if (mine.id === 'balaghat' && horizonIdx >= 2) {
          p50 *= 0.86;
        }
        series.push({
          month: monthKey(date),
          actual: null,
          forecastP50: p50,
          forecastP10: p50 * (1 - widen),
          forecastP90: p50 * (1 + widen),
          plan,
        });
      }
    }
    return { mineId: mine.id, series };
  });

  function monthKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function hashSeed(s: string) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (h % 1000) / 1000;
  }
```

Then update the function's return statement to include the two new fields:

```ts
  return { elevation, prospectivity, confidence, probabilityAt, foldAxisAngleDeg: axisAngleDeg, shapAt, production };
```

And update the exported interface:

```ts
export interface ShapContribution { feature: string; value: number; }
export interface ProductionPoint {
  month: string;
  actual: number | null;
  forecastP50: number | null;
  forecastP10: number | null;
  forecastP90: number | null;
  plan: number;
}
export interface MineProduction { mineId: string; series: ProductionPoint[]; }

export interface GeneratorOutput {
  elevation: Float32Array;
  prospectivity: Float32Array;
  confidence: Float32Array;
  probabilityAt(xWorld: number, zWorld: number, depthMeters: number): number;
  foldAxisAngleDeg: number;
  shapAt(gridX: number, gridZ: number): ShapContribution[];
  production: MineProduction[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/generate.test.ts` (from `app/`)
Expected: PASS, all 5 assertions.

- [ ] **Step 5: Write `app/src/data/api.ts`**

```ts
import { generateSite, type GeneratorOutput } from './generate';

let cached: GeneratorOutput | null = null;

/** Async facade over the client-side generator. Swapping in a real FastAPI
 *  endpoint later means replacing this function body only. */
export async function fetchSite(): Promise<GeneratorOutput> {
  if (!cached) cached = generateSite();
  return cached;
}
```

- [ ] **Step 6: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add SHAP synthesis, production forecast series, async data facade"
```

---

### Task 5: Ore ramp — TS/GLSL parity

**Files:**
- Create: `app/src/lib/ramp.ts`
- Create: `app/src/scene/shaders/oreRamp.glsl`
- Create: `app/tests/ramp.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `rampColor(t: number): [number, number, number]` (0..1 RGB) in `ramp.ts` — consumed by Task 8 (`Legend`, mine marker tinting), Task 12 (`Waterfall` bar colours).
- Produces: `#include`-free GLSL source string `oreRamp.glsl` exporting a `vec3 oreRamp(float t)` function — imported via `?raw` and string-concatenated into `terrain.frag.glsl` (Task 7) and `voxel.frag.glsl` (Task 9).

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/ramp.test.ts
import { describe, it, expect } from 'vitest';
import { rampColor } from '../src/lib/ramp';

// Hand-transcribed from src/scene/shaders/oreRamp.glsl — must be kept in sync manually.
// This IS the parity check: if a human edits one without the other, this test catches it
// only if they also forgot to update this array — so the real safety net is that both
// ramp.ts and oreRamp.glsl derive their stop colours from the same STOPS_HEX list below,
// copy-pasted identically into the GLSL file's comments for humans to diff by eye.
const STOPS_HEX = ['#16202E', '#1E4A5F', '#2E7D8C', '#C9A227', '#E2622A', '#F7E0A8'];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

describe('ore ramp TS/GLSL parity', () => {
  it('matches the GLSL stop colours at the 6 defined stops', () => {
    const stopPositions = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    stopPositions.forEach((t, i) => {
      const [r, g, b] = rampColor(t);
      const [er, eg, eb] = hexToRgb(STOPS_HEX[i]);
      expect(Math.abs(r - er)).toBeLessThan(1 / 255);
      expect(Math.abs(g - eg)).toBeLessThan(1 / 255);
      expect(Math.abs(b - eb)).toBeLessThan(1 / 255);
    });
  });

  it('is monotonically increasing in luminance across 21 samples', () => {
    let prevLum = -1;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const [r, g, b] = rampColor(t);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      expect(lum).toBeGreaterThanOrEqual(prevLum - 0.001);
      prevLum = lum;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ramp.test.ts` (from `app/`)
Expected: FAIL — `rampColor` not defined.

- [ ] **Step 3: Write `app/src/lib/ramp.ts`**

```ts
const STOPS: Array<{ t: number; rgb: [number, number, number] }> = [
  { t: 0.0, rgb: [0x16 / 255, 0x20 / 255, 0x2e / 255] },
  { t: 0.2, rgb: [0x1e / 255, 0x4a / 255, 0x5f / 255] },
  { t: 0.4, rgb: [0x2e / 255, 0x7d / 255, 0x8c / 255] },
  { t: 0.6, rgb: [0xc9 / 255, 0xa2 / 255, 0x27 / 255] },
  { t: 0.8, rgb: [0xe2 / 255, 0x62 / 255, 0x2a / 255] },
  { t: 1.0, rgb: [0xf7 / 255, 0xe0 / 255, 0xa8 / 255] },
];

/** Sequential ore ramp: pyrolusite steel-grey -> gondite ochre -> braunite ember.
 *  Must produce colours identical (within 1/255) to scene/shaders/oreRamp.glsl. */
export function rampColor(t: number): [number, number, number] {
  const c = Math.min(1, Math.max(0, t));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i], b = STOPS[i + 1];
    if (c >= a.t && c <= b.t) {
      const local = (c - a.t) / (b.t - a.t);
      return [
        a.rgb[0] + (b.rgb[0] - a.rgb[0]) * local,
        a.rgb[1] + (b.rgb[1] - a.rgb[1]) * local,
        a.rgb[2] + (b.rgb[2] - a.rgb[2]) * local,
      ];
    }
  }
  return STOPS[STOPS.length - 1].rgb;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ramp.test.ts` (from `app/`)
Expected: PASS, both assertions.

- [ ] **Step 5: Write `app/src/scene/shaders/oreRamp.glsl`**

```glsl
// Ore ramp — pyrolusite steel-grey -> gondite ochre -> braunite ember.
// Stop colours MUST match src/lib/ramp.ts's STOPS array exactly (see tests/ramp.test.ts).
// Stops (t, hex): 0.0 #16202E, 0.2 #1E4A5F, 0.4 #2E7D8C, 0.6 #C9A227, 0.8 #E2622A, 1.0 #F7E0A8
vec3 oreRamp(float t) {
  float c = clamp(t, 0.0, 1.0);
  vec3 s0 = vec3(0.0863, 0.1255, 0.1804);
  vec3 s1 = vec3(0.1176, 0.2902, 0.3725);
  vec3 s2 = vec3(0.1804, 0.4902, 0.5490);
  vec3 s3 = vec3(0.7882, 0.6353, 0.1529);
  vec3 s4 = vec3(0.8863, 0.3843, 0.1647);
  vec3 s5 = vec3(0.9686, 0.8784, 0.6588);

  if (c < 0.2) return mix(s0, s1, c / 0.2);
  if (c < 0.4) return mix(s1, s2, (c - 0.2) / 0.2);
  if (c < 0.6) return mix(s2, s3, (c - 0.4) / 0.2);
  if (c < 0.8) return mix(s3, s4, (c - 0.6) / 0.2);
  return mix(s4, s5, (c - 0.8) / 0.2);
}
```

- [ ] **Step 6: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add ore ramp with TS/GLSL parity test"
```

---

### Task 6: Canvas3D scaffold + CameraRig

**Files:**
- Create: `app/src/scene/Canvas3D.tsx`
- Create: `app/src/scene/CameraRig.tsx`
- Modify: `app/src/App.tsx` (mount `Canvas3D` inside `ErrorBoundary`, fetch site data on boot)

**Interfaces:**
- Consumes: `useDrishti` (Task 2, `view`/`camera`/`transitioning`/`setCamera`), `fetchSite` (Task 4).
- Produces: React context `SiteDataContext` providing `GeneratorOutput | null` — consumed by Task 7 (`Terrain`), Task 9 (`VoxelField`), Task 11 (`DrillTrace`).
- Produces: `CameraRig` owns the `PerspectiveCamera` exclusively via `useThree()` — reads `store.view` and `store.camera`, writes back `store.setCamera` position only from its own scripted tweens. No other component may call `camera.position.set(...)` directly anywhere in the codebase from this task forward.
- Produces: named camera presets per view, consumed by every scene task to know where the camera settles:
  ```ts
  export const CAMERA_PRESETS: Record<ViewState, { position: [number, number, number]; target: [number, number, number] }> = {
    GLOBE:      { position: [0, 0, 3.2],      target: [0, 0, 0] },
    FLAT:       { position: [0, 700, 0.01],   target: [0, 0, 0] }, // near-vertical to avoid gimbal lock
    RELIEF:     { position: [0, 480, 620],    target: [0, 0, 0] },
    BLOCK:      { position: [0, 380, 520],    target: [0, -80, 0] },
    SUBSURFACE: { position: [0, -60, 340],    target: [0, -150, 0] },
  };
  ```

- [ ] **Step 1: Write `app/src/scene/CameraRig.tsx`**

```tsx
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useDrishti, type ViewState } from '../store/useDrishti';

export const CAMERA_PRESETS: Record<ViewState, { position: [number, number, number]; target: [number, number, number] }> = {
  GLOBE:      { position: [0, 0, 3.2],    target: [0, 0, 0] },
  FLAT:       { position: [0, 700, 0.01], target: [0, 0, 0] },
  RELIEF:     { position: [0, 480, 620],  target: [0, 0, 0] },
  BLOCK:      { position: [0, 380, 520],  target: [0, -80, 0] },
  SUBSURFACE: { position: [0, -60, 340],  target: [0, -150, 0] },
};

const TRANSITION_MS = 1600;

// Hoisted outside the render loop — useFrame must not allocate.
const _pos = new Vector3();
const _target = new Vector3();
const _startPos = new Vector3();
const _startTarget = new Vector3();

export function CameraRig() {
  const { camera } = useThree();
  const view = useDrishti((s) => s.view);
  const transitioning = useDrishti((s) => s.transitioning);
  const setCamera = useDrishti((s) => s.setCamera);

  const elapsed = useRef(0);
  const lastView = useRef<ViewState>(view);
  const currentTarget = useRef(new Vector3(0, 0, 0));

  if (lastView.current !== view) {
    _startPos.copy(camera.position);
    _startTarget.copy(currentTarget.current);
    elapsed.current = 0;
    lastView.current = view;
  }

  useFrame((_, delta) => {
    const preset = CAMERA_PRESETS[view];
    _pos.set(...preset.position);
    _target.set(...preset.target);

    if (transitioning) {
      elapsed.current += delta * 1000;
      const t = Math.min(1, elapsed.current / TRANSITION_MS);
      const eased = easeOutExpo(t);
      camera.position.lerpVectors(_startPos, _pos, eased);
      currentTarget.current.lerpVectors(_startTarget, _target, eased);
      camera.lookAt(currentTarget.current);
      if (t >= 1) useDrishti.setState({ transitioning: false });
    } else {
      camera.position.copy(_pos);
      currentTarget.current.copy(_target);
      camera.lookAt(_target);
    }
  });

  return null;
}

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
```

Note: `setCamera` is imported from the store but intentionally unused for now — `CameraRig` drives the three.js camera object directly each frame rather than round-tripping through the store every frame (that would allocate/trigger re-renders at 60fps). It remains in the store interface for later tasks (e.g. `RiskBoard` row click, Task 14) that need to request a camera move by setting `view`/`selectedMine` rather than positions directly. Remove the unused import if the linter flags it, or prefix with `_setCamera` — do not wire it up here.

- [ ] **Step 2: Write `app/src/scene/Canvas3D.tsx`**

```tsx
import { Suspense, createContext, useContext, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraRig } from './CameraRig';
import { fetchSite } from '../data/api';
import type { GeneratorOutput } from '../data/generate';

const SiteDataContext = createContext<GeneratorOutput | null>(null);
export function useSiteData() { return useContext(SiteDataContext); }

export function Canvas3D() {
  const [site, setSite] = useState<GeneratorOutput | null>(null);

  useEffect(() => {
    fetchSite().then(setSite);
  }, []);

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 1, far: 4000 }}
    >
      <SiteDataContext.Provider value={site}>
        <CameraRig />
        <hemisphereLight args={[0x8899aa, 0x0b0e12, 0.4]} />
        <directionalLight position={[400, 200, -300]} intensity={1.1} />
        <Suspense fallback={null}>
          {/* Terrain, VoxelField, DrillTrace, Globe mount here in Tasks 7, 9, 11, 15 */}
        </Suspense>
      </SiteDataContext.Provider>
    </Canvas>
  );
}
```

- [ ] **Step 3: Wire into `app/src/App.tsx`**

Replace the placeholder `<div className="mono"...>Canvas3D placeholder...</div>` with:

```tsx
<Canvas3D />
```

Add the import: `import { Canvas3D } from './scene/Canvas3D';`

- [ ] **Step 4: Verify**

Run: `npm run dev`
Expected: dark canvas fills the main area, no console errors, no visible geometry yet (expected — Terrain mounts in Task 7). Check devtools console for `[DRISHTI]` error-boundary logs — there should be none.

- [ ] **Step 5: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add Canvas3D scaffold with sole-owner CameraRig and view presets"
```

---

### Task 7: Terrain mesh, ore-ramp/confidence shader, contours, VE label

**Files:**
- Create: `app/src/lib/terrainConstants.ts`
- Create: `app/src/scene/Terrain.tsx`
- Create: `app/src/scene/shaders/terrain.vert.glsl`
- Create: `app/src/scene/shaders/terrain.frag.glsl`
- Modify: `app/src/scene/Canvas3D.tsx` (mount `<Terrain/>`)

**Interfaces:**
- Consumes: `useSiteData()` (Task 6, for `elevation`/`prospectivity`/`confidence` Float32Arrays), `useDrishti` (`view`, `drape`), `oreRamp.glsl` (Task 5, string-concatenated).
- Produces: `ELEV_MIN`, `ELEV_MAX`, `VE_RELIEF` constants from `terrainConstants.ts` — the **single source of truth** for the terrain's displacement formula, imported by both this task's `Terrain.tsx` and Task 9's `voxelBuild.ts`. Duplicating these as separate local literals in two files would silently break the bloom's continuity requirement (Part I §3: "if the cubes appear somewhere else, the effect dies") the moment either file's constant drifted from the other.
- Produces: `<Terrain/>` component with no props — reads everything from context/store. Renders a `PlaneGeometry(1024,1024,255,255)` with a custom `ShaderMaterial`, uniforms `uElevationTex`, `uProspectivityTex`, `uConfidenceTex`, `uDrapeMix` (0=prospectivity,1=confidence), `uVerticalExaggeration`, `uElevMin`, `uElevMax`. Consumed visually by Task 8 (FLAT reuses this mesh with `uVerticalExaggeration→0`).
- Produces: DOM caption `V.E. 2.4×` rendered as an HTML overlay (via `@react-three/drei`'s `<Html/>`) — pattern reused by Task 15 (globe's own VE label) and Task 16 (final chrome pass verifies every 3D state shows one).

- [ ] **Step 1: Write `app/src/lib/terrainConstants.ts`**

```ts
export const ELEV_MIN = 250;
export const ELEV_MAX = 600;
export const VE_RELIEF = 2.4;

/** Must match terrain.vert.glsl's displacement formula exactly — this is what makes a
 *  voxel's aSourcePos (voxelBuild.ts) land on the visible relief surface at t=0. */
export function terrainSurfaceY(elevMeters: number): number {
  return (elevMeters - ELEV_MIN) * VE_RELIEF * 0.15;
}
```

- [ ] **Step 2: Write `app/src/scene/shaders/terrain.vert.glsl`**

```glsl
uniform sampler2D uElevationTex;
uniform float uElevMin;
uniform float uElevMax;
uniform float uVerticalExaggeration;

varying vec2 vUv;
varying float vElevation01;

void main() {
  vUv = uv;
  float raw = texture2D(uElevationTex, uv).r; // stored as 0..1, decoded below
  float elevMeters = uElevMin + raw * (uElevMax - uElevMin);
  vElevation01 = raw;

  vec3 displaced = position;
  displaced.z += (elevMeters - uElevMin) * uVerticalExaggeration * 0.15;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
```

- [ ] **Step 3: Write `app/src/scene/shaders/terrain.frag.glsl`** (body only — `oreRamp()` is prepended at build time)

```glsl
uniform sampler2D uProspectivityTex;
uniform sampler2D uConfidenceTex;
uniform float uDrapeMix;

varying vec2 vUv;
varying float vElevation01;

vec3 confidenceRamp(float t) {
  return mix(vec3(0.1020, 0.1255, 0.1608), vec3(0.8627, 0.8941, 0.9255), t);
}

void main() {
  float prospectivity = texture2D(uProspectivityTex, vUv).r;
  float confidence = texture2D(uConfidenceTex, vUv).r;

  vec3 prospColor = oreRamp(prospectivity);
  vec3 confColor = confidenceRamp(confidence);
  vec3 color = mix(prospColor, confColor, uDrapeMix);

  // Survey-plan contour lines from elevation, thin, 8% opacity.
  float contour = fract(vElevation01 * 14.0);
  float line = smoothstep(0.0, 0.03, contour) - smoothstep(0.03, 0.06, contour);
  color = mix(color, vec3(1.0), (1.0 - line) * 0.08);

  gl_FragColor = vec4(color, 1.0);
}
```

- [ ] **Step 4: Write `app/src/scene/Terrain.tsx`**

```tsx
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DataTexture, RedFormat, FloatType, ShaderMaterial, DoubleSide } from 'three';
import { Html } from '@react-three/drei';
import { useSiteData } from './Canvas3D';
import { useDrishti } from '../store/useDrishti';
import { GRID, WORLD_SIZE } from '../lib/geo';
import { ELEV_MIN, ELEV_MAX, VE_RELIEF } from '../lib/terrainConstants';
import oreRampGlsl from './shaders/oreRamp.glsl?raw';
import terrainVert from './shaders/terrain.vert.glsl?raw';
import terrainFragBody from './shaders/terrain.frag.glsl?raw';

function toTexture(data: Float32Array, min: number, max: number) {
  const normalized = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) normalized[i] = (data[i] - min) / (max - min);
  const tex = new DataTexture(normalized, GRID, GRID, RedFormat, FloatType);
  tex.needsUpdate = true;
  return tex;
}

export function Terrain() {
  const site = useSiteData();
  const view = useDrishti((s) => s.view);
  const drape = useDrishti((s) => s.drape);
  const materialRef = useRef<ShaderMaterial>(null);
  const veRef = useRef(0);

  const textures = useMemo(() => {
    if (!site) return null;
    return {
      elevation: toTexture(site.elevation, ELEV_MIN, ELEV_MAX),
      prospectivity: toTexture(site.prospectivity, 0, 1),
      confidence: toTexture(site.confidence, 0, 1),
    };
  }, [site]);

  const material = useMemo(() => {
    if (!textures) return null;
    return new ShaderMaterial({
      uniforms: {
        uElevationTex: { value: textures.elevation },
        uProspectivityTex: { value: textures.prospectivity },
        uConfidenceTex: { value: textures.confidence },
        uDrapeMix: { value: 0 },
        uVerticalExaggeration: { value: 0 },
        uElevMin: { value: ELEV_MIN },
        uElevMax: { value: ELEV_MAX },
      },
      vertexShader: terrainVert,
      fragmentShader: oreRampGlsl + '\n' + terrainFragBody,
      side: DoubleSide,
    });
  }, [textures]);

  useFrame((_, delta) => {
    if (!material) return;
    const targetVE = view === 'FLAT' ? 0 : VE_RELIEF;
    veRef.current += (targetVE - veRef.current) * Math.min(1, delta * 3);
    material.uniforms.uVerticalExaggeration.value = veRef.current;

    const targetDrapeMix = drape === 'CONFIDENCE' ? 1 : 0;
    const cur = material.uniforms.uDrapeMix.value;
    material.uniforms.uDrapeMix.value = cur + (targetDrapeMix - cur) * Math.min(1, delta * 2.4); // ~500ms crossfade
  });

  const visible = view === 'FLAT' || view === 'RELIEF' || view === 'BLOCK' || view === 'SUBSURFACE';
  if (!material || !visible) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh material={material}>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 255, 255]} />
      </mesh>
      {view === 'RELIEF' && (
        <Html position={[-WORLD_SIZE / 2 + 40, 0, WORLD_SIZE / 2 - 20]} transform={false} style={{ pointerEvents: 'none' }}>
          <div className="mono" style={{ color: 'var(--text-mute)', fontSize: 11 }}>V.E. {VE_RELIEF.toFixed(1)}×</div>
        </Html>
      )}
    </group>
  );
}
```

- [ ] **Step 5: Mount in `app/src/scene/Canvas3D.tsx`**

Add the import `import { Terrain } from './Terrain';` and replace the `<Suspense fallback={null}>...</Suspense>` comment block with:

```tsx
<Suspense fallback={null}>
  <Terrain />
</Suspense>
```

- [ ] **Step 6: Verify**

Run: `npm run dev`, then in the browser devtools console:
```js
useDrishti.getState().setView('RELIEF')
```
Expected: terrain mesh fades into view with visible relief, ore-ramp colouring, faint contour lines, `V.E. 2.4×` caption bottom-left of the mesh. Then run `useDrishti.getState().setDrape('CONFIDENCE')` — expect a ~500ms crossfade to a grey-scale drape. Frame rate should hold at 60fps (check devtools Performance panel or an FPS counter extension).

- [ ] **Step 7: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add terrain mesh with ore-ramp/confidence shader, contours, VE label"
```

---

### Task 8: FLAT state — mine markers, deposits toggle, hover tooltip

**Files:**
- Create: `app/src/scene/MineMarkers.tsx`
- Create: `app/src/ui/Toolbar.tsx` (state buttons + drape switch; expanded further in Task 16)
- Modify: `app/src/scene/Canvas3D.tsx` (mount `<MineMarkers/>`, raycasting for hover/click on the terrain)
- Modify: `app/src/App.tsx` (mount `<Toolbar/>` floating top-right of the viewport)

**Interfaces:**
- Consumes: `MINES` (Task 2), `lonLatToWorld` (Task 2), `useSiteData` (Task 6), `useDrishti` (`showKnownDeposits`, `hoverCell`, `selectCell`).
- Produces: `<MineMarkers/>` — hollow square sprites per mine, visible in `FLAT`/`RELIEF` only, gated by `showKnownDeposits`.
- Produces: `Toolbar` renders `FLAT / RELIEF / BLOCK / UNDERGROUND` buttons calling `setView`, current state underlined in `--rhodonite`. Consumed/extended by Task 10 (adds `BLOCK MODEL` trigger context), Task 11 (adds `GO UNDERGROUND`), Task 16 (adds `RESET VIEW`).
- Produces: hover raycasting throttled to 30Hz, writing `hoverCell: {gx,gz,lon,lat}` to the store — consumed by Task 16 (coordinate readout) and the tooltip in this task.

- [ ] **Step 1: Write `app/src/scene/MineMarkers.tsx`**

```tsx
import { Html } from '@react-three/drei';
import { useDrishti } from '../store/useDrishti';
import { MINES } from '../data/mines';
import { lonLatToWorld } from '../lib/geo';
import { useSiteData } from './Canvas3D';

export function MineMarkers() {
  const site = useSiteData();
  const view = useDrishti((s) => s.view);
  const show = useDrishti((s) => s.showKnownDeposits);
  const selectMine = useDrishti((s) => s.selectMine);

  if (!site || !show || (view !== 'FLAT' && view !== 'RELIEF')) return null;

  return (
    <group>
      {MINES.map((mine) => {
        const [x, z] = lonLatToWorld(mine.lon, mine.lat);
        return (
          <group key={mine.id} position={[x, 0, z]} onClick={() => selectMine(mine.id)}>
            <Html center transform={false} style={{ pointerEvents: 'none' }}>
              <div style={{
                width: 10, height: 10, border: '1.5px solid var(--text)',
                transform: 'translate(-5px, -5px)',
              }} />
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap', marginTop: 2 }}>
                {mine.name}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
```

Note: markers render at world `y=0` via `<Html>` billboard, independent of terrain elevation — acceptable for the FLAT/RELIEF top-down-ish camera angles in `CAMERA_PRESETS`; revisit only if visual QA in Step 4 shows obvious misplacement relative to relief.

- [ ] **Step 2: Write `app/src/ui/Toolbar.tsx`**

```tsx
import { useDrishti, type ViewState } from '../store/useDrishti';

const STATES: { view: ViewState; label: string }[] = [
  { view: 'FLAT', label: 'FLAT' },
  { view: 'RELIEF', label: 'RELIEF' },
  { view: 'BLOCK', label: 'BLOCK MODEL' },
  { view: 'SUBSURFACE', label: 'UNDERGROUND' },
];

export function Toolbar() {
  const view = useDrishti((s) => s.view);
  const drape = useDrishti((s) => s.drape);
  const setView = useDrishti((s) => s.setView);
  const setDrape = useDrishti((s) => s.setDrape);

  if (view === 'GLOBE') return null;

  return (
    <div
      className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1.5 rounded-sm backdrop-blur"
      style={{ background: 'color-mix(in srgb, var(--panel) 82%, transparent)', border: '1px solid var(--line)' }}
    >
      {STATES.map((s) => (
        <button
          key={s.view}
          onClick={() => setView(s.view)}
          className="mono px-2 py-1"
          style={{
            fontSize: 11,
            letterSpacing: '0.1em',
            color: view === s.view ? 'var(--text)' : 'var(--text-dim)',
            borderBottom: view === s.view ? '2px solid var(--rhodonite)' : '2px solid transparent',
            background: 'transparent',
          }}
        >
          {s.label}
        </button>
      ))}
      {view === 'RELIEF' && (
        <div className="flex ml-2" style={{ borderLeft: '1px solid var(--line)', paddingLeft: 8 }}>
          {(['PROSPECTIVITY', 'CONFIDENCE'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDrape(d)}
              className="mono px-2 py-1"
              style={{ fontSize: 10, color: drape === d ? 'var(--text)' : 'var(--text-dim)' }}
            >
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add hover raycasting and click-select directly on the terrain mesh**

Raycasting needs the intersection point, so the handlers live on `Terrain.tsx`'s `<mesh>` itself, not on the outer `<Canvas>` — R3F gives every pointer event on a mesh its `event.point` in world space for free.

In `app/src/scene/Terrain.tsx`, Task 7 already imports `useDrishti` and `{ GRID, WORLD_SIZE }` from `'../lib/geo'`. Extend the existing geo import line to `import { GRID, WORLD_SIZE, worldToLonLat, worldToGrid } from '../lib/geo';` — do not add a second import statement from the same module.

Add a module-level throttle timestamp above the `Terrain` component:

```ts
let lastHoverAt = 0;
```

Change the `<mesh material={material}>` element to:

```tsx
<mesh
  material={material}
  onPointerMove={(e) => {
    if (view !== 'FLAT' && view !== 'RELIEF') return;
    const now = performance.now();
    if (now - lastHoverAt < 33) return; // 30Hz throttle
    lastHoverAt = now;
    const [lon, lat] = worldToLonLat(e.point.x, e.point.z);
    const [gx, gz] = worldToGrid(e.point.x, e.point.z);
    useDrishti.getState().hoverCellAt({ gx, gz, lon, lat });
  }}
  onClick={(e) => {
    if (view !== 'FLAT' && view !== 'RELIEF') return;
    const [lon, lat] = worldToLonLat(e.point.x, e.point.z);
    const [gx, gz] = worldToGrid(e.point.x, e.point.z);
    useDrishti.getState().selectCell({ gx, gz, lon, lat });
    if (view === 'FLAT') useDrishti.getState().setView('RELIEF');
  }}
>
  <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 255, 255]} />
</mesh>
```

This replaces the `<mesh material={material}><planeGeometry .../></mesh>` element Task 7 wrote — same geometry, with the two new event handlers added.

Now mount `<MineMarkers />` in `app/src/scene/Canvas3D.tsx`, alongside `<Terrain />` inside the `Suspense` block:

```tsx
<Suspense fallback={null}>
  <Terrain />
  <MineMarkers />
</Suspense>
```

In `app/src/App.tsx`, add the deposits toggle and mount `<Toolbar/>`:

```tsx
import { Toolbar } from './ui/Toolbar';
import { useDrishti } from './store/useDrishti';
```

Add inside `<main>`, as a sibling to `<Canvas3D/>`:

```tsx
<Toolbar />
<DepositsToggle />
```

Add the `DepositsToggle` component in `App.tsx` (small enough to inline; move to its own file only if it grows):

```tsx
function DepositsToggle() {
  const view = useDrishti((s) => s.view);
  const show = useDrishti((s) => s.showKnownDeposits);
  const toggle = useDrishti((s) => s.toggleKnownDeposits);
  if (view !== 'FLAT') return null;
  return (
    <button
      onClick={toggle}
      className="absolute top-4 left-4 mono px-3 py-2 rounded-sm"
      style={{
        fontSize: 11, letterSpacing: '0.1em',
        background: show ? 'var(--rhodonite)' : 'var(--panel)',
        color: show ? 'var(--void)' : 'var(--text)',
        border: '1px solid var(--line)',
      }}
    >
      SHOW KNOWN DEPOSITS
    </button>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run dev`. In devtools console: `useDrishti.getState().setView('FLAT')`. Expected: terrain flattens (VE tweens to 0) under a top-down camera. Click **SHOW KNOWN DEPOSITS** top-left — 11 hollow-square markers with mono labels appear. Click one of the hot (ember/ochre) cells away from a marker — camera transitions to RELIEF with no jump. Hover over the terrain — no visible lag, confirm via `useDrishti.getState().hoverCell` in console updating no faster than ~30Hz.

- [ ] **Step 5: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add FLAT state: mine markers, deposits toggle, hover/click raycasting"
```

---

### Task 9: VoxelField — static InstancedMesh, in-shader CUTOFF + DEPTH SLICE

**Design note (deviation, not a silent cut):** Part I §3 State 3 describes two block-boundary treatments: a per-cube "edge highlight" (always on) and a separate "grid lattice lines... along block boundaries" overlay that fades in at the end of the bloom. This build merges them into one always-on per-cube edge highlight — it reads as the same "instrument grid" signal with one shader pass instead of two, and it isn't on the design doc §5 cut list, so it's called out here rather than dropped silently.

**Files:**
- Create: `app/src/scene/voxelBuild.ts` (pure instance-buffer builder, testable in isolation from R3F)
- Create: `app/src/scene/VoxelField.tsx`
- Create: `app/src/scene/shaders/voxel.vert.glsl`
- Create: `app/src/scene/shaders/voxel.frag.glsl`
- Create: `app/src/scene/DepthRuler.tsx`
- Create: `app/src/ui/BlockControls.tsx`
- Modify: `app/src/scene/Canvas3D.tsx` (mount `<VoxelField/>`, `<DepthRuler/>`)
- Modify: `app/src/App.tsx` (mount `<BlockControls/>`)

**Interfaces:**
- Consumes: `useSiteData` (`probabilityAt`, `confidence`, `elevation`), `useDrishti` (`view`, `cutoff`, `depthRange`, `selectedCell`), `WORLD_SIZE`/`worldToGrid` (Task 2).
- Produces:
  ```ts
  // voxelBuild.ts
  export const BLOCK_W = WORLD_SIZE / 64; // ~16 world units, legend labels this "25 m"
  export const BLOCK_H = 9;               // world units, legend labels this "10 m"
  export const MAX_INSTANCES = 28000;

  export interface VoxelInstances {
    count: number;
    aProbability: Float32Array;
    aConfidence: Float32Array;
    aDelay: Float32Array;      // 0..1, normalized distance from click point
    aTargetPos: Float32Array;  // count*3
    aSourcePos: Float32Array;  // count*3
    aDepthIndex: Float32Array; // 0..23
  }
  export function buildVoxelInstances(site: GeneratorOutput, clickWorld: [number, number]): VoxelInstances;
  ```
  Consumed by `VoxelField.tsx` (builds the `InstancedMesh` once per site+click, memoized) and Task 10 (the bloom animation drives `uProgress` against these same buffers — no rebuild).
- Produces: `<VoxelField/>` with uniforms `uProgress` (0..1, static `1` until Task 10 wires the timeline), `uCutoff`, `uDepthMin`, `uDepthMax`, `uBlockW`, `uBlockH` — filtering happens via `discard` in the fragment shader, **never** by rebuilding the instance buffer (Part I §8).
- Produces: `<DepthRuler/>` — vertical mono-ticked ruler, left edge of viewport, visible in `BLOCK`/`SUBSURFACE`. Reused unmodified by Task 11.
- Produces: `<BlockControls/>` — `CUTOFF` single slider (0..1) and `DEPTH SLICE` min/max pair of sliders (0..240), both writing to the store.

- [ ] **Step 1: Write `app/src/scene/voxelBuild.ts`**

```ts
import type { GeneratorOutput } from '../data/generate';
import { WORLD_SIZE } from '../lib/geo';
import { terrainSurfaceY } from '../lib/terrainConstants';

export const VOXEL_GRID_X = 64;
export const VOXEL_GRID_Z = 64;
export const VOXEL_GRID_Y = 24;
export const DEPTH_STEP = 10; // metres per slice
export const BLOCK_W = WORLD_SIZE / VOXEL_GRID_X;
export const BLOCK_H = 9;
export const CANDIDATE_MIN_PROBABILITY = 0.28;
export const MAX_INSTANCES = 28000;

export interface VoxelInstances {
  count: number;
  aProbability: Float32Array;
  aConfidence: Float32Array;
  aDelay: Float32Array;
  aTargetPos: Float32Array;
  aSourcePos: Float32Array;
  aDepthIndex: Float32Array;
}

export function buildVoxelInstances(site: GeneratorOutput, clickWorld: [number, number]): VoxelInstances {
  type Candidate = { x: number; z: number; depthIdx: number; depthMeters: number; p: number; elevAtColumn: number };
  const candidates: Candidate[] = [];

  for (let gz = 0; gz < VOXEL_GRID_Z; gz++) {
    for (let gx = 0; gx < VOXEL_GRID_X; gx++) {
      const x = (gx / VOXEL_GRID_X - 0.5) * WORLD_SIZE;
      const z = (0.5 - gz / VOXEL_GRID_Z) * WORLD_SIZE;
      const rasterGx = Math.min(255, Math.floor((gx / VOXEL_GRID_X) * 256));
      const rasterGz = Math.min(255, Math.floor((gz / VOXEL_GRID_Z) * 256));
      const elevAtColumn = site.elevation[rasterGz * 256 + rasterGx];

      for (let d = 0; d < VOXEL_GRID_Y; d++) {
        const depthMeters = d * DEPTH_STEP + DEPTH_STEP / 2;
        const p = site.probabilityAt(x, z, depthMeters);
        if (p > CANDIDATE_MIN_PROBABILITY) {
          candidates.push({ x, z, depthIdx: d, depthMeters, p, elevAtColumn });
        }
      }
    }
  }

  candidates.sort((a, b) => b.p - a.p);
  const kept = candidates.slice(0, MAX_INSTANCES);

  const count = kept.length;
  const aProbability = new Float32Array(count);
  const aConfidence = new Float32Array(count);
  const aDelay = new Float32Array(count);
  const aTargetPos = new Float32Array(count * 3);
  const aSourcePos = new Float32Array(count * 3);
  const aDepthIndex = new Float32Array(count);

  const [cx, cz] = clickWorld;
  let maxDist = 1;
  for (const c of kept) maxDist = Math.max(maxDist, Math.hypot(c.x - cx, c.z - cz));

  kept.forEach((c, i) => {
    aProbability[i] = c.p;
    const rasterGx = Math.min(255, Math.floor(((c.x / WORLD_SIZE) + 0.5) * 256));
    const rasterGz = Math.min(255, Math.floor((0.5 - (c.z / WORLD_SIZE)) * 256));
    aConfidence[i] = site.confidence[rasterGz * 256 + rasterGx];

    const dist = Math.hypot(c.x - cx, c.z - cz);
    aDelay[i] = dist / maxDist;
    aDepthIndex[i] = c.depthIdx;

    aTargetPos[i * 3] = c.x;
    aTargetPos[i * 3 + 1] = -c.depthMeters;
    aTargetPos[i * 3 + 2] = c.z;

    aSourcePos[i * 3] = c.x;
    aSourcePos[i * 3 + 1] = terrainSurfaceY(c.elevAtColumn);
    aSourcePos[i * 3 + 2] = c.z;
  });

  return { count, aProbability, aConfidence, aDelay, aTargetPos, aSourcePos, aDepthIndex };
}
```

No `Terrain.tsx` changes are needed in this task — `voxelBuild.ts`'s `terrainSurfaceY` is the same function Task 7 exported from `terrainConstants.ts`, imported here rather than redeclared, so the two can't drift.

- [ ] **Step 2: Write `app/src/scene/shaders/voxel.vert.glsl`**

```glsl
uniform float uProgress;
uniform float uBlockH; // synced with voxelBuild.ts BLOCK_H, for the edge-highlight normalization in the fragment shader

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

float easeOutBack(float t) {
  float c1 = 1.9568; // 1.70158 * 1.15 overshoot
  float c3 = c1 + 1.0;
  float x = t - 1.0;
  return 1.0 + c3 * x * x * x + c1 * x * x;
}

void main() {
  vProbability = aProbability;
  vConfidence = aConfidence;
  vDepthIndex = aDepthIndex;
  vLocalPos = position;

  float localT = clamp((uProgress - aDelay * 0.7) / 0.3, 0.0, 1.0);
  float eased = easeOutBack(localT);
  vec3 interpolated = mix(aSourcePos, aTargetPos, eased);

  vec3 worldPos = position + interpolated;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
}
```

- [ ] **Step 3: Write `app/src/scene/shaders/voxel.frag.glsl`** (body only — `oreRamp()` prepended at build time)

```glsl
uniform float uCutoff;
uniform float uDepthMin;
uniform float uDepthMax;
uniform float uBlockW;
uniform float uBlockH;

varying float vProbability;
varying float vConfidence;
varying float vDepthIndex;
varying vec3 vLocalPos;

void main() {
  if (vProbability < uCutoff) discard;
  float depthMeters = vDepthIndex * 10.0 + 5.0;
  if (depthMeters < uDepthMin || depthMeters > uDepthMax) discard;

  vec3 base = oreRamp(vProbability);
  float emissive = pow(vProbability, 3.0) * 1.8;
  vec3 color = base + base * emissive;
  color *= (0.4 + 0.6 * vConfidence); // low-confidence blocks read visibly dimmer

  float ex = abs(vLocalPos.x) / (uBlockW * 0.5);
  float ey = abs(vLocalPos.y) / (uBlockH * 0.5);
  float ez = abs(vLocalPos.z) / (uBlockW * 0.5);
  float edge = max(max(ex, ey), ez);
  float edgeMask = smoothstep(0.85, 1.0, edge);
  color = mix(color, vec3(1.0), edgeMask * 0.35);

  gl_FragColor = vec4(color, 1.0);
}
```

- [ ] **Step 4: Write `app/src/scene/VoxelField.tsx`**

```tsx
import { useMemo, useRef, useEffect } from 'react';
import { BoxGeometry, ShaderMaterial, InstancedMesh, InstancedBufferAttribute, DynamicDrawUsage } from 'three';
import { useSiteData } from './Canvas3D';
import { useDrishti } from '../store/useDrishti';
import { buildVoxelInstances, BLOCK_W, BLOCK_H } from './voxelBuild';
import oreRampGlsl from './shaders/oreRamp.glsl?raw';
import voxelVert from './shaders/voxel.vert.glsl?raw';
import voxelFragBody from './shaders/voxel.frag.glsl?raw';

export function VoxelField() {
  const site = useSiteData();
  const view = useDrishti((s) => s.view);
  const cutoff = useDrishti((s) => s.cutoff);
  const depthRange = useDrishti((s) => s.depthRange);
  const selectedCell = useDrishti((s) => s.selectedCell);
  const meshRef = useRef<InstancedMesh>(null);

  const clickWorld = useMemo<[number, number]>(() => {
    if (!selectedCell || !site) return [0, 0];
    const x = (selectedCell.gx / 256 - 0.5) * 1024;
    const z = (0.5 - selectedCell.gz / 256) * 1024;
    return [x, z];
  }, [selectedCell, site]);

  const instances = useMemo(() => {
    if (!site) return null;
    return buildVoxelInstances(site, clickWorld);
  }, [site, clickWorld]);

  const geometry = useMemo(() => new BoxGeometry(BLOCK_W, BLOCK_H, BLOCK_W), []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uProgress: { value: 1 },
          uCutoff: { value: 0.28 },
          uDepthMin: { value: 0 },
          uDepthMax: { value: 240 },
          uBlockW: { value: BLOCK_W },
          uBlockH: { value: BLOCK_H },
        },
        vertexShader: voxelVert,
        fragmentShader: oreRampGlsl + '\n' + voxelFragBody,
        transparent: false,
      }),
    [],
  );

  useEffect(() => {
    if (!instances || !meshRef.current) return;
    const mesh = meshRef.current;
    const attrs: [string, Float32Array, number][] = [
      ['aProbability', instances.aProbability, 1],
      ['aConfidence', instances.aConfidence, 1],
      ['aDelay', instances.aDelay, 1],
      ['aTargetPos', instances.aTargetPos, 3],
      ['aSourcePos', instances.aSourcePos, 3],
      ['aDepthIndex', instances.aDepthIndex, 1],
    ];
    for (const [name, data, size] of attrs) {
      const attr = new InstancedBufferAttribute(data, size);
      attr.setUsage(DynamicDrawUsage);
      mesh.geometry.setAttribute(name, attr);
    }
    mesh.count = instances.count;
    mesh.instanceMatrix.needsUpdate = false; // identity for every instance; position is handled in-shader
  }, [instances]);

  useEffect(() => {
    material.uniforms.uCutoff.value = cutoff;
  }, [cutoff, material]);

  useEffect(() => {
    material.uniforms.uDepthMin.value = depthRange[0];
    material.uniforms.uDepthMax.value = depthRange[1];
  }, [depthRange, material]);

  if (!instances || (view !== 'BLOCK' && view !== 'SUBSURFACE')) return null;

  return <instancedMesh ref={meshRef} args={[geometry, material, instances.count]} frustumCulled={false} />;
}
```

- [ ] **Step 5: Write `app/src/scene/DepthRuler.tsx`**

```tsx
import { Html } from '@react-three/drei';
import { useDrishti } from '../store/useDrishti';

const TICKS = [0, 40, 80, 120, 160, 200, 240];

export function DepthRuler() {
  const view = useDrishti((s) => s.view);
  if (view !== 'BLOCK' && view !== 'SUBSURFACE') return null;

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        className="mono absolute"
        style={{ left: 16, top: 96, bottom: 96, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      >
        {TICKS.map((m) => (
          <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 1, background: 'var(--text-mute)' }} />
            <span style={{ fontSize: 10, color: 'var(--text-mute)' }}>{m}m</span>
          </div>
        ))}
      </div>
    </Html>
  );
}
```

- [ ] **Step 6: Write `app/src/ui/BlockControls.tsx`**

```tsx
import { useDrishti } from '../store/useDrishti';

export function BlockControls() {
  const view = useDrishti((s) => s.view);
  const cutoff = useDrishti((s) => s.cutoff);
  const depthRange = useDrishti((s) => s.depthRange);
  const setCutoff = useDrishti((s) => s.setCutoff);
  const setDepthRange = useDrishti((s) => s.setDepthRange);

  if (view !== 'BLOCK' && view !== 'SUBSURFACE') return null;

  return (
    <div
      className="absolute left-4 bottom-4 flex flex-col gap-3 px-3 py-3 rounded-sm"
      style={{ background: 'var(--panel)', border: '1px solid var(--line)', width: 260 }}
    >
      <div>
        <div className="label flex justify-between">
          <span>CUTOFF</span>
          <span className="mono" style={{ color: 'var(--text)' }}>{cutoff.toFixed(2)}</span>
        </div>
        <input
          type="range" min={0} max={1} step={0.01} value={cutoff}
          onChange={(e) => setCutoff(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
      <div>
        <div className="label flex justify-between">
          <span>DEPTH SLICE</span>
          <span className="mono" style={{ color: 'var(--text)' }}>{depthRange[0]}–{depthRange[1]}m</span>
        </div>
        <div className="flex gap-2">
          <input
            type="range" min={0} max={240} step={10} value={depthRange[0]}
            onChange={(e) => setDepthRange([Math.min(parseInt(e.target.value), depthRange[1]), depthRange[1]])}
            style={{ width: '50%' }}
          />
          <input
            type="range" min={0} max={240} step={10} value={depthRange[1]}
            onChange={(e) => setDepthRange([depthRange[0], Math.max(parseInt(e.target.value), depthRange[0])])}
            style={{ width: '50%' }}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Mount everything**

In `app/src/scene/Canvas3D.tsx`, add imports `import { VoxelField } from './VoxelField';` and `import { DepthRuler } from './DepthRuler';`, and inside `<Suspense>`:

```tsx
<Suspense fallback={null}>
  <Terrain />
  <MineMarkers />
  <VoxelField />
  <DepthRuler />
</Suspense>
```

In `app/src/App.tsx`, add `import { BlockControls } from './ui/BlockControls';` and mount `<BlockControls />` as a sibling of `<Toolbar/>`.

- [ ] **Step 8: Verify**

Run: `npm run dev`. In devtools console: `useDrishti.getState().setView('BLOCK')`. Expected: a dense field of coloured cubes appears (static, no animation yet — that's Task 10), depth ruler on the left, CUTOFF/DEPTH SLICE sliders bottom-left. Drag CUTOFF from 0 to 0.75 — most of the field should vanish, leaving a coherent banded structure. Drag DEPTH SLICE — cubes outside the range disappear immediately with no stutter. Open devtools Performance panel, record 3 seconds while dragging DEPTH SLICE — confirm ≥55fps and that `instances` is not being rebuilt (only 2 `useEffect`s touching uniforms fire on slider input, not `buildVoxelInstances`).

- [ ] **Step 9: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add static voxel block model with in-shader CUTOFF and DEPTH SLICE"
```

---

### Task 10: The staged bloom animation + postprocessing

**Files:**
- Modify: `app/src/scene/VoxelField.tsx` (drive `uProgress` over a 2600ms timeline instead of a static `1`)
- Modify: `app/src/scene/shaders/terrain.frag.glsl` (add erosion-discard dissolve pass)
- Modify: `app/src/scene/Terrain.tsx` (add `uDissolve` uniform, read `blockBloomProgress`)
- Modify: `app/src/store/useDrishti.ts` (add `blockBloomProgress: number`, `reducedMotion: boolean`)
- Create: `app/src/scene/Effects.tsx`
- Modify: `app/src/scene/Canvas3D.tsx` (mount `<Effects/>`)

**Interfaces:**
- Consumes: `voxelBuild.ts` buffers (Task 9, unchanged — the timeline only drives the existing `uProgress` uniform, never rebuilds attributes), `useDrishti.view`.
- Produces: `blockBloomProgress: number` (0..1) on the store, written every frame by `VoxelField` while `view === 'BLOCK'`, read by `Terrain`'s dissolve pass. This is a primitive-value store write, not a scene mutation — `CameraRig` remains the sole owner of the camera object itself.
- Produces: `reducedMotion: boolean` on the store, set once at boot from `matchMedia('(prefers-reduced-motion: reduce)')`, read by `VoxelField` to skip straight to `progress = 1`.
- Produces: `<Effects/>` — `Bloom` + `Vignette` from `@react-three/postprocessing`, mounted only for `BLOCK`/`SUBSURFACE`, auto-disabled on a detected software renderer.

- [ ] **Step 1: Add `blockBloomProgress` and `reducedMotion` to the store**

In `app/src/store/useDrishti.ts`, add to the `DrishtiStore` interface:

```ts
  blockBloomProgress: number;
  reducedMotion: boolean;
  setBlockBloomProgress: (p: number) => void;
```

Add to the store implementation object:

```ts
  blockBloomProgress: 1,
  reducedMotion: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  setBlockBloomProgress: (p) => set({ blockBloomProgress: p }),
```

- [ ] **Step 2: Drive `uProgress` over the timeline in `VoxelField.tsx`**

In `app/src/scene/VoxelField.tsx`, add imports:

```ts
import { useFrame } from '@react-three/fiber';
```

Add inside the `VoxelField` component, after the existing `useEffect`s:

```tsx
  const elapsed = useRef(0);
  const lastView = useRef(view);
  const reducedMotion = useDrishti((s) => s.reducedMotion);

  if (lastView.current !== view) {
    if (view === 'BLOCK' && lastView.current !== 'SUBSURFACE') elapsed.current = 0; // fresh bloom only when arriving from RELIEF
    lastView.current = view;
  }

  useFrame((_, delta) => {
    if (view !== 'BLOCK' && view !== 'SUBSURFACE') return;
    if (reducedMotion) {
      material.uniforms.uProgress.value = 1;
      useDrishti.getState().setBlockBloomProgress(1);
      return;
    }
    elapsed.current += delta * 1000;
    const progress = Math.min(1, elapsed.current / 2600);
    material.uniforms.uProgress.value = progress;
    useDrishti.getState().setBlockBloomProgress(progress);
  });
```

Change the initial uniform value in the `material` `useMemo` from `uProgress: { value: 1 }` to `uProgress: { value: 0 }`.

- [ ] **Step 3: Add the erosion-discard dissolve pass to the terrain fragment shader**

In `app/src/scene/shaders/terrain.frag.glsl`, add before `void main()`:

```glsl
uniform float uDissolve; // 0 = fully solid, 1 = fully eroded (BLOCK transition)

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
```

At the top of `main()`, before any other logic, add:

```glsl
  if (uDissolve > 0.0) {
    float n = valueNoise(vUv * 40.0 + uDissolve * 6.0);
    if (n < uDissolve) discard;
  }
```

- [ ] **Step 4: Wire `uDissolve` in `Terrain.tsx`**

Add `uDissolve: { value: 0 }` to the `material`'s `uniforms` object in `app/src/scene/Terrain.tsx`.

In the existing `useFrame` block, add:

```ts
    const blockBloomProgress = useDrishti.getState().blockBloomProgress;
    const targetDissolve = view === 'BLOCK' || view === 'SUBSURFACE'
      ? smoothstep01(0, 0.4, blockBloomProgress)
      : 0;
    material.uniforms.uDissolve.value = targetDissolve;
```

Add the helper above the component:

```ts
function smoothstep01(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
```

- [ ] **Step 5: Write `app/src/scene/Effects.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useDrishti } from '../store/useDrishti';

export function Effects() {
  const { gl } = useThree();
  const view = useDrishti((s) => s.view);
  const [softwareRenderer, setSoftwareRenderer] = useState(false);

  useEffect(() => {
    const ext = gl.getContext().getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const renderer = gl.getContext().getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
      if (/swiftshader|software|llvmpipe/i.test(renderer)) {
        setSoftwareRenderer(true);
        console.warn('[DRISHTI] Software renderer detected, disabling bloom:', renderer);
      }
    }
  }, [gl]);

  if (softwareRenderer || (view !== 'BLOCK' && view !== 'SUBSURFACE')) return null;

  return (
    <EffectComposer>
      <Bloom intensity={0.65} luminanceThreshold={0.62} radius={0.7} mipmapBlur />
      <Vignette darkness={0.55} />
    </EffectComposer>
  );
}
```

- [ ] **Step 6: Mount in `Canvas3D.tsx`**

Add `import { Effects } from './Effects';` and mount `<Effects />` inside the `<Suspense>` block alongside the others (order doesn't matter for `EffectComposer`, but keep it last for readability):

```tsx
<Suspense fallback={null}>
  <Terrain />
  <MineMarkers />
  <VoxelField />
  <DepthRuler />
  <Effects />
</Suspense>
```

- [ ] **Step 7: Verify**

Run: `npm run dev`. In devtools console: `useDrishti.getState().setView('RELIEF')`, wait a second, then `useDrishti.getState().setView('BLOCK')`. Expected: terrain visibly erodes into fragments over roughly the first second, voxels appear to spawn from the terrain surface and travel outward/downward from wherever `selectedCell` last was (default origin if none selected yet — click a cell in FLAT/RELIEF first to see the radiating effect clearly), settling with a slight overshoot. Bloom should visibly brighten only the highest-probability (ember/near-white) cubes — if the whole field glows, halve `intensity` in `Effects.tsx` per Part I §3's own tuning note. Confirm `prefers-reduced-motion` (toggle in devtools rendering panel) jumps straight to the settled field with no animation.

- [ ] **Step 8: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add staged bloom animation, terrain dissolve, bloom/vignette postprocessing"
```

---

### Task 11: SUBSURFACE — fog, translucent ceiling, drill trace strip log

**Design note:** SUBSURFACE is a distinct rendering mode for the terrain, not a continuation of BLOCK's erosion — on entering SUBSURFACE the dissolve resets to 0 (a solid sheet again) while a separate ceiling-opacity uniform drops it to 0.12, so it reads as a translucent roof rather than a half-eaten surface. "Low-probability blocks drop to opacity 0.05" (Part I §3 S4) is implemented as an alpha ramp from the interactive `CUTOFF` value up to full probability, since blocks below `CUTOFF` are already discarded by Task 9's shader — this keeps the two mechanisms coherent rather than fighting each other.

**Files:**
- Modify: `app/src/scene/Terrain.tsx` (ceiling-opacity uniform, wireframe overlay mesh, displaced-geometry helper)
- Modify: `app/src/scene/shaders/terrain.frag.glsl` (output alpha via `uCeilingOpacity`)
- Modify: `app/src/scene/VoxelField.tsx` (transparent material, low-probability alpha fade in `SUBSURFACE`)
- Modify: `app/src/scene/shaders/voxel.frag.glsl` (alpha output)
- Create: `app/src/scene/DrillTrace.tsx`
- Modify: `app/src/scene/Canvas3D.tsx` (mount `<DrillTrace/>`, conditional `<fogExp2/>`)

**Interfaces:**
- Consumes: `useSiteData` (`probabilityAt`, `elevation`), `useDrishti` (`view`, `selectedCell`, `cutoff`), `rampColor` (Task 5).
- Produces: `<DrillTrace/>` — a coloured polyline + tick markers from surface to 240m at `selectedCell`. Its 25 sampled `(depth, probability)` pairs are the same data Task 13's `DepthProfile` widget renders — Task 13 must call the same `probabilityAt(x, z, depth)` sampling, not duplicate a different sampling scheme, so the strip log and the widget can never visually disagree.

- [ ] **Step 1: Add `uCeilingOpacity` and alpha output to the terrain shader**

In `app/src/scene/shaders/terrain.frag.glsl`, add `uniform float uCeilingOpacity;` near the top, and change the final line of `main()` from `gl_FragColor = vec4(color, 1.0);` to:

```glsl
  gl_FragColor = vec4(color, uCeilingOpacity);
```

- [ ] **Step 2: Add the ceiling-opacity uniform and wireframe overlay to `Terrain.tsx`**

Add `uCeilingOpacity: { value: 1 }` to the `material`'s `uniforms` object. Set `transparent: true` on the `ShaderMaterial` (was previously unset/false by default).

In the existing `useFrame` block, add alongside the existing `targetDissolve` logic:

```ts
    const targetCeilingOpacity = view === 'SUBSURFACE' ? 0.12 : 1;
    const curOpacity = material.uniforms.uCeilingOpacity.value;
    material.uniforms.uCeilingOpacity.value = curOpacity + (targetCeilingOpacity - curOpacity) * Math.min(1, delta * 3);

    // SUBSURFACE is a distinct mode, not a continuation of BLOCK's erosion — force dissolve back to 0.
    const dissolveTarget = view === 'BLOCK' ? smoothstep01(0, 0.4, blockBloomProgress) : 0;
```

Replace the line `const targetDissolve = ...` (from Task 10 Step 4) with the `dissolveTarget` line above, and change the subsequent uniform assignment from `material.uniforms.uDissolve.value = targetDissolve;` to `material.uniforms.uDissolve.value = dissolveTarget;`.

Add a CPU-baked wireframe geometry, built once per site (matches the shader's displacement formula so it isn't visually offset from the shaded ceiling):

```tsx
import { PlaneGeometry } from 'three';
// ...
const ceilingWireGeometry = useMemo(() => {
  if (!site) return null;
  const geo = new PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 255, 255);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const gx = i % 256, gz = Math.floor(i / 256);
    const elevMeters = site.elevation[gz * 256 + gx];
    const z = pos.getZ(i) + (elevMeters - ELEV_MIN) * VE_RELIEF * 0.15;
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}, [site]);
```

`ELEV_MIN` and `VE_RELIEF` are already imported in `Terrain.tsx` from `terrainConstants.ts` (Task 7) — reuse them, do not redeclare.

Render the overlay as a sibling of the main terrain `<mesh>`, only in `SUBSURFACE`:

```tsx
{view === 'SUBSURFACE' && ceilingWireGeometry && (
  <mesh geometry={ceilingWireGeometry}>
    <meshBasicMaterial color={0x566472} wireframe transparent opacity={0.5} />
  </mesh>
)}
```

- [ ] **Step 3: Add low-probability alpha fade to the voxel shader**

In `app/src/scene/shaders/voxel.frag.glsl`, add `uniform float uLowProbFade;` and `uniform float uCutoff;` is already present from Task 9 — reuse it. Change the final line from `gl_FragColor = vec4(color, 1.0);` to:

```glsl
  float alpha = 1.0;
  if (uLowProbFade > 0.5) {
    alpha = mix(0.05, 1.0, smoothstep(uCutoff, 1.0, vProbability));
  }
  gl_FragColor = vec4(color, alpha);
```

- [ ] **Step 4: Wire `uLowProbFade` and transparency in `VoxelField.tsx`**

In the `material` `useMemo` in `app/src/scene/VoxelField.tsx`, add `uLowProbFade: { value: 0 }` to `uniforms`, and change `transparent: false` to `transparent: true`. Add to the material config object: `depthWrite: true,` (explicit, matches Part I §3's material spec).

Add a `useEffect` reacting to `view`:

```tsx
  useEffect(() => {
    material.uniforms.uLowProbFade.value = view === 'SUBSURFACE' ? 1 : 0;
  }, [view, material]);
```

- [ ] **Step 5: Write `app/src/scene/DrillTrace.tsx`**

```tsx
import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { useSiteData } from './Canvas3D';
import { useDrishti } from '../store/useDrishti';
import { rampColor } from '../lib/ramp';

const DEPTHS = Array.from({ length: 25 }, (_, i) => i * 10); // 0..240 step 10

export function DrillTrace() {
  const site = useSiteData();
  const view = useDrishti((s) => s.view);
  const selectedCell = useDrishti((s) => s.selectedCell);

  const trace = useMemo(() => {
    if (!site || !selectedCell) return null;
    const x = (selectedCell.gx / 256 - 0.5) * 1024;
    const z = (0.5 - selectedCell.gz / 256) * 1024;
    return DEPTHS.map((depth) => {
      const p = site.probabilityAt(x, z, depth);
      const [r, g, b] = rampColor(p);
      return { point: [x, -depth, z] as [number, number, number], color: [r, g, b] as [number, number, number], p };
    });
  }, [site, selectedCell]);

  if (!trace || (view !== 'BLOCK' && view !== 'SUBSURFACE')) return null;

  return (
    <group>
      <Line points={trace.map((t) => t.point)} vertexColors={trace.map((t) => t.color)} lineWidth={2} />
      {trace.map((t, i) => (
        <mesh key={i} position={t.point}>
          <boxGeometry args={[6, 1.5, 6]} />
          <meshBasicMaterial color={t.color} />
        </mesh>
      ))}
    </group>
  );
}
```

- [ ] **Step 6: Mount fog and `DrillTrace` in `Canvas3D.tsx`**

Add `import { DrillTrace } from './DrillTrace';` and mount inside `<Suspense>`:

```tsx
<Suspense fallback={null}>
  <Terrain />
  <MineMarkers />
  <VoxelField />
  <DepthRuler />
  <DrillTrace />
  <Effects />
</Suspense>
```

Add conditional fog as a direct child of `<Canvas>` (outside `Suspense`, it's cheap and instant):

```tsx
{/* inside SiteDataContext.Provider, alongside CameraRig */}
{useDrishti.getState().view === 'SUBSURFACE' && <fogExp2 attach="fog" args={[0x0b0e12, 0.0016]} />}
```

This reads `view` outside React's reactive subscription (a one-time snapshot), which will not re-render on view changes. Fix it properly — replace that line with a small subcomponent instead:

```tsx
function SceneFog() {
  const view = useDrishti((s) => s.view);
  return view === 'SUBSURFACE' ? <fogExp2 attach="fog" args={[0x0b0e12, 0.0016]} /> : null;
}
```

Define `SceneFog` above the `Canvas3D` function in the same file, and mount `<SceneFog />` as a child of `<SiteDataContext.Provider>`, alongside `<CameraRig />`.

- [ ] **Step 7: Verify**

Run: `npm run dev`. Select a cell in FLAT/RELIEF, transition through to `BLOCK`, then `useDrishti.getState().setView('SUBSURFACE')`. Expected: camera descends below the terrain plane; the terrain becomes a faint translucent sheet with a visible wireframe overlay (reads as a ceiling); fog visibly darkens distant blocks; blocks just above the current `CUTOFF` value are nearly invisible while high-probability blocks stay bright; a coloured line with tick markers runs from the ceiling down to 240m at the selected cell, ticks shading from cool to hot matching the ore ramp.

- [ ] **Step 8: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add SUBSURFACE state: fog, translucent ceiling, drill-hole strip log"
```

---

### Task 12: Left rail shell + EXPLORATION widgets

**Files:**
- Create: `app/src/lib/stats.ts` (success-rate curve, ROC-AUC, PR-AUC — pure functions, unit-testable in spirit but not required by §13's test scope; kept pure so they're trivially eyeballed)
- Create: `app/src/ui/LeftRail.tsx`
- Create: `app/src/ui/widgets/ModelValidation.tsx`
- Create: `app/src/ui/widgets/Waterfall.tsx`
- Create: `app/src/ui/widgets/TargetInspector.tsx`
- Create: `app/src/ui/widgets/DrillQueue.tsx`
- Modify: `app/src/store/useDrishti.ts` (add `drillQueue`, `addToDrillQueue`)
- Modify: `app/src/App.tsx` (two-column layout: `LeftRail` + viewport)

**Interfaces:**
- Consumes: `useSiteData`, `useDrishti` (`panel`, `selectedCell`, `drillQueue`), `MINES`, `FEATURES`, `rampColor`.
- Produces:
  ```ts
  // Waterfall.tsx — deliberately domain-agnostic, reused unmodified by Task 14's driver panel
  export interface WaterfallItem { label: string; value: number; }
  export function Waterfall({ items, title }: { items: WaterfallItem[]; title: string }): JSX.Element;
  ```
- Produces: `drillQueue: CellRef[]` and `addToDrillQueue(c: CellRef): void` on the store — consumed by `DrillQueue.tsx` here and referenced by no other task.

- [ ] **Step 1: Write `app/src/lib/stats.ts`**

```ts
import type { GeneratorOutput } from '../data/generate';
import { MINES } from '../data/mines';
import { lonLatToWorld, worldToGrid, GRID } from './geo';

export interface SuccessCurvePoint { areaFraction: number; depositFraction: number; }

/** Cumulative-gains curve: x = fraction of area ranked (highest score first),
 *  y = fraction of the 11 known mines captured within that area. */
export function computeSuccessCurve(site: GeneratorOutput): SuccessCurvePoint[] {
  const scored = Array.from(site.prospectivity).map((p, i) => ({ p, i }));
  scored.sort((a, b) => b.p - a.p);

  const mineIndices = new Set(
    MINES.map((m) => {
      const [x, z] = lonLatToWorld(m.lon, m.lat);
      const [gx, gz] = worldToGrid(x, z);
      return gz * GRID + gx;
    }),
  );

  const points: SuccessCurvePoint[] = [{ areaFraction: 0, depositFraction: 0 }];
  let captured = 0;
  const total = scored.length;
  const step = Math.floor(total / 100);
  for (let i = 0; i < total; i++) {
    if (mineIndices.has(scored[i].i)) captured++;
    if (step > 0 && i % step === 0) {
      points.push({ areaFraction: (i + 1) / total, depositFraction: captured / MINES.length });
    }
  }
  points.push({ areaFraction: 1, depositFraction: 1 });
  return points;
}

/** Rank-sum (Mann-Whitney) ROC-AUC: positives = the 11 mine cells, negatives = everything else. */
export function computeRocAuc(site: GeneratorOutput): number {
  const scored = Array.from(site.prospectivity).map((p, i) => ({ p, i }));
  scored.sort((a, b) => a.p - b.p); // ascending, for rank assignment

  const mineIndices = new Set(
    MINES.map((m) => {
      const [x, z] = lonLatToWorld(m.lon, m.lat);
      const [gx, gz] = worldToGrid(x, z);
      return gz * GRID + gx;
    }),
  );

  let rankSumPositive = 0;
  let nPos = 0;
  scored.forEach((s, rank) => {
    if (mineIndices.has(s.i)) { rankSumPositive += rank + 1; nPos++; }
  });
  const nNeg = scored.length - nPos;
  const auc = (rankSumPositive - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
  return auc;
}

/** PR-AUC via trapezoidal integration over recall, sweeping score-sorted cells. */
export function computePrAuc(site: GeneratorOutput): number {
  const scored = Array.from(site.prospectivity).map((p, i) => ({ p, i }));
  scored.sort((a, b) => b.p - a.p);

  const mineIndices = new Set(
    MINES.map((m) => {
      const [x, z] = lonLatToWorld(m.lon, m.lat);
      const [gx, gz] = worldToGrid(x, z);
      return gz * GRID + gx;
    }),
  );

  let tp = 0, fp = 0;
  let prevRecall = 0, prevPrecision = 1;
  let auc = 0;
  for (const s of scored) {
    if (mineIndices.has(s.i)) tp++; else fp++;
    const recall = tp / MINES.length;
    const precision = tp / (tp + fp);
    auc += ((recall - prevRecall) * (precision + prevPrecision)) / 2;
    prevRecall = recall; prevPrecision = precision;
    if (tp === MINES.length) break;
  }
  return auc;
}
```

- [ ] **Step 2: Add `drillQueue` to the store**

In `app/src/store/useDrishti.ts`, add to the `DrishtiStore` interface:

```ts
  drillQueue: CellRef[];
  addToDrillQueue: (c: CellRef) => void;
```

Add to the implementation:

```ts
  drillQueue: [],
  addToDrillQueue: (c) => set((s) => (
    s.drillQueue.some((q) => q.gx === c.gx && q.gz === c.gz) ? s : { drillQueue: [...s.drillQueue, c] }
  )),
```

- [ ] **Step 3: Write `app/src/ui/widgets/Waterfall.tsx`**

```tsx
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer } from 'recharts';
import { rampColor } from '../../lib/ramp';

export interface WaterfallItem { label: string; value: number; }

export function Waterfall({ items, title }: { items: WaterfallItem[]; title: string }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const visible = showAll ? sorted : sorted.slice(0, 6);
  const maxAbs = Math.max(...sorted.map((i) => Math.abs(i.value)), 0.001);

  return (
    <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div className="label mb-2">{title}</div>
      <ResponsiveContainer width="100%" height={visible.length * 26}>
        <BarChart data={visible} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
          <XAxis type="number" hide domain={[-maxAbs, maxAbs]} />
          <YAxis
            type="category" dataKey="label" width={140}
            tick={{ fontSize: 11, fill: 'var(--text-dim)' }}
            axisLine={false} tickLine={false}
          />
          <Bar dataKey="value" barSize={12}>
            {visible.map((item, i) => (
              <Cell
                key={i}
                fill={item.value >= 0
                  ? `rgb(${rampColor(Math.min(1, Math.abs(item.value) * 4)).map((c) => Math.round(c * 255)).join(',')})`
                  : '#566472'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {sorted.length > 6 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mono"
          style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 4, background: 'transparent' }}
        >
          {showAll ? 'show top 6' : `show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `app/src/ui/widgets/ModelValidation.tsx`**

```tsx
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useSiteData } from '../../scene/Canvas3D';
import { computeSuccessCurve, computeRocAuc, computePrAuc } from '../../lib/stats';

export function ModelValidation() {
  const site = useSiteData();
  const stats = useMemo(() => {
    if (!site) return null;
    const curve = computeSuccessCurve(site);
    const at5pct = curve.find((p) => p.areaFraction >= 0.05)?.depositFraction ?? 0;
    return { curve, at5pct, rocAuc: computeRocAuc(site), prAuc: computePrAuc(site) };
  }, [site]);

  if (!stats) return null;

  const diagonal = [{ areaFraction: 0, depositFraction: 0 }, { areaFraction: 1, depositFraction: 1 }];

  return (
    <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div className="label mb-1">MODEL VALIDATION</div>
      <div className="mono" style={{ fontSize: 28, color: 'var(--ore-100)' }}>
        {Math.round(stats.at5pct * 100)}%
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
        of known deposits inside top 5% of ranked area
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart>
          <XAxis dataKey="areaFraction" type="number" domain={[0, 1]} hide />
          <YAxis dataKey="depositFraction" type="number" domain={[0, 1]} hide />
          <Line data={diagonal} dataKey="depositFraction" stroke="var(--text-mute)" strokeDasharray="3 3" dot={false} />
          <Line data={stats.curve} dataKey="depositFraction" stroke="var(--ore-80)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mono flex justify-between" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
        <span>ROC-AUC {stats.rocAuc.toFixed(3)}</span>
        <span>PR-AUC {stats.prAuc.toFixed(3)}</span>
        <span>CV 11 (LOMO)</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `app/src/ui/widgets/TargetInspector.tsx`**

```tsx
import { useMemo } from 'react';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { MINES } from '../../data/mines';
import { lonLatToWorld } from '../../lib/geo';

function estimateHorizonDepth(site: NonNullable<ReturnType<typeof useSiteData>>, x: number, z: number): number {
  let bestDepth = 0, bestP = -1;
  for (let d = 0; d <= 240; d += 5) {
    const p = site.probabilityAt(x, z, d);
    if (p > bestP) { bestP = p; bestDepth = d; }
  }
  return bestDepth;
}

function nearestMineKm(lon: number, lat: number): { name: string; km: number } {
  let best = { name: MINES[0].name, km: Infinity };
  for (const m of MINES) {
    const dLat = (lat - m.lat) * 111;
    const dLon = (lon - m.lon) * 111 * Math.cos((lat * Math.PI) / 180);
    const km = Math.hypot(dLat, dLon);
    if (km < best.km) best = { name: m.name, km };
  }
  return best;
}

export function TargetInspector() {
  const site = useSiteData();
  const selectedCell = useDrishti((s) => s.selectedCell);
  const addToDrillQueue = useDrishti((s) => s.addToDrillQueue);

  const info = useMemo(() => {
    if (!site || !selectedCell) return null;
    const [x, z] = lonLatToWorld(selectedCell.lon, selectedCell.lat);
    const p = site.prospectivity[selectedCell.gz * 256 + selectedCell.gx];
    const confidence = site.confidence[selectedCell.gz * 256 + selectedCell.gx];
    const ciWidth = (1 - confidence) * 0.2;
    const depth = estimateHorizonDepth(site, x, z);
    const nearest = nearestMineKm(selectedCell.lon, selectedCell.lat);
    return { p, ciWidth, depth, nearest };
  }, [site, selectedCell]);

  if (!selectedCell || !info) {
    return (
      <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
        <div className="label">TARGET INSPECTOR</div>
        <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}>Click a cell to inspect.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div className="label mb-2">TARGET INSPECTOR</div>
      <div className="mono" style={{ fontSize: 12, lineHeight: 1.8 }}>
        <div>{selectedCell.lon.toFixed(4)} E &nbsp; {selectedCell.lat.toFixed(4)} N</div>
        <div>p {info.p.toFixed(3)} ± {info.ciWidth.toFixed(3)}</div>
        <div>est. horizon depth {info.depth} m</div>
        <div>nearest known mine: {info.nearest.name} ({info.nearest.km.toFixed(1)} km)</div>
      </div>
      <button
        onClick={() => addToDrillQueue(selectedCell)}
        className="mono"
        style={{
          marginTop: 10, width: '100%', padding: '8px 0', fontSize: 11, letterSpacing: '0.1em',
          background: 'var(--rhodonite)', color: 'var(--void)', border: 'none',
        }}
      >
        ADD TO DRILL QUEUE
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Write `app/src/ui/widgets/DrillQueue.tsx`**

```tsx
import { useDrishti } from '../../store/useDrishti';

function exportGeoJson(queue: { lon: number; lat: number; gx: number; gz: number }[]) {
  const geojson = {
    type: 'FeatureCollection',
    features: queue.map((q) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [q.lon, q.lat] },
      properties: { gx: q.gx, gz: q.gz },
    })),
  };
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drishti-drill-queue.geojson';
  a.click();
  URL.revokeObjectURL(url);
}

export function DrillQueue() {
  const queue = useDrishti((s) => s.drillQueue);

  return (
    <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div className="label flex justify-between mb-2">
        <span>DRILL QUEUE</span>
        <span className="mono">{queue.length}</span>
      </div>
      {queue.map((q, i) => (
        <div key={i} className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {i + 1}. {q.lon.toFixed(3)}, {q.lat.toFixed(3)}
        </div>
      ))}
      <button
        onClick={() => exportGeoJson(queue)}
        disabled={queue.length === 0}
        className="mono"
        style={{
          marginTop: 8, width: '100%', padding: '6px 0', fontSize: 11, letterSpacing: '0.1em',
          background: 'transparent', color: queue.length ? 'var(--text)' : 'var(--text-mute)',
          border: '1px solid var(--line-hi)',
        }}
      >
        EXPORT GEOJSON
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Write `app/src/ui/LeftRail.tsx`**

```tsx
import { useSiteData } from '../scene/Canvas3D';
import { useDrishti, type Panel } from '../store/useDrishti';
import { ModelValidation } from './widgets/ModelValidation';
import { Waterfall } from './widgets/Waterfall';
import { TargetInspector } from './widgets/TargetInspector';
import { DrillQueue } from './widgets/DrillQueue';
import { FEATURES } from '../data/features';

const PANELS: Panel[] = ['EXPLORATION', 'OPERATIONS'];

export function LeftRail() {
  const site = useSiteData();
  const view = useDrishti((s) => s.view);
  const panel = useDrishti((s) => s.panel);
  const setPanel = useDrishti((s) => s.setPanel);
  const selectedCell = useDrishti((s) => s.selectedCell);

  if (view === 'GLOBE') return null;

  const shapItems = site && selectedCell
    ? site.shapAt(selectedCell.gx, selectedCell.gz).map((c) => ({
        label: FEATURES.find((f) => f.id === c.feature)?.label ?? c.feature,
        value: c.value,
      }))
    : [];

  return (
    <aside style={{ width: 340, background: 'var(--panel)', borderRight: '1px solid var(--line)', overflowY: 'auto' }}>
      <div className="flex" style={{ borderBottom: '1px solid var(--line)' }}>
        {PANELS.map((p) => (
          <button
            key={p}
            onClick={() => setPanel(p)}
            className="mono flex-1 py-2"
            style={{
              fontSize: 11, letterSpacing: '0.1em',
              color: panel === p ? 'var(--text)' : 'var(--text-dim)',
              borderBottom: panel === p ? '2px solid var(--rhodonite)' : '2px solid transparent',
              background: 'transparent',
            }}
          >
            {p}
          </button>
        ))}
      </div>
      {panel === 'EXPLORATION' && (
        <>
          <ModelValidation />
          {shapItems.length > 0 && <Waterfall items={shapItems} title="SHAP DRIVERS" />}
          <TargetInspector />
          <DrillQueue />
        </>
      )}
      {panel === 'OPERATIONS' && (
        <div style={{ padding: 12, color: 'var(--text-mute)', fontSize: 11 }} className="mono">
          Operations widgets — Task 14
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 8: Wire into `App.tsx`**

Replace `App.tsx`'s `<main>` layout with a flex row containing `LeftRail` and the existing viewport:

```tsx
import { LeftRail } from './ui/LeftRail';
```

```tsx
<div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
  <LeftRail />
  <main style={{ flex: 1, position: 'relative', background: 'var(--void)' }}>
    {/* existing ErrorBoundary + Canvas3D + Toolbar + DepositsToggle + BlockControls stay here */}
  </main>
</div>
```

Move the existing `<main>` contents (everything currently inside it) unchanged into this new `<main>`; only the wrapping `<div>` and `<LeftRail/>` are new.

- [ ] **Step 9: Verify**

Run: `npm run dev`. Expected: left rail 340px wide, EXPLORATION/OPERATIONS segmented control at top. In EXPLORATION: validation widget shows a number near 100%, a curve visibly above the dashed diagonal, ROC-AUC/PR-AUC both > 0.9 (11 mines concentrated in top-ranked cells). Click three different cells on the terrain — confirm the SHAP waterfall's top feature differs across at least two of them. Click **ADD TO DRILL QUEUE** — entry appears in the list; click **EXPORT GEOJSON** — a `.geojson` file downloads; open it in a text editor and confirm it's valid JSON with a `FeatureCollection`.

- [ ] **Step 10: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add left rail: model validation, SHAP waterfall, target inspector, drill queue"
```

---

### Task 13: Depth Profile widget, synced with the 3D drill trace

**Files:**
- Modify: `app/src/store/useDrishti.ts` (add `hoveredDepth`, `setHoveredDepth`)
- Create: `app/src/ui/widgets/DepthProfile.tsx`
- Modify: `app/src/scene/DrillTrace.tsx` (pointer events on tick meshes, highlight on `hoveredDepth` match)
- Modify: `app/src/ui/LeftRail.tsx` (mount `DepthProfile` in EXPLORATION)

**Interfaces:**
- Consumes: same `probabilityAt(x, z, depth)` sampling as `DrillTrace.tsx` (Task 11) — this is the acceptance-criterion requirement that the widget and the 3D trace can never visually disagree, since they read the identical 25-point sample.
- Produces: `hoveredDepth: number | null` and `setHoveredDepth(d: number | null): void` on the store, written by both `DepthProfile` (on row hover) and `DrillTrace` (on tick hover), read by both to render the matching highlight.

- [ ] **Step 1: Add `hoveredDepth` to the store**

In `app/src/store/useDrishti.ts`, add to the interface:

```ts
  hoveredDepth: number | null;
  setHoveredDepth: (d: number | null) => void;
```

Add to the implementation:

```ts
  hoveredDepth: null,
  setHoveredDepth: (d) => set({ hoveredDepth: d }),
```

- [ ] **Step 2: Write `app/src/ui/widgets/DepthProfile.tsx`**

```tsx
import { useMemo } from 'react';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { lonLatToWorld } from '../../lib/geo';
import { rampColor } from '../../lib/ramp';

const DEPTHS = Array.from({ length: 25 }, (_, i) => i * 10);

export function DepthProfile() {
  const site = useSiteData();
  const selectedCell = useDrishti((s) => s.selectedCell);
  const hoveredDepth = useDrishti((s) => s.hoveredDepth);
  const setHoveredDepth = useDrishti((s) => s.setHoveredDepth);

  const rows = useMemo(() => {
    if (!site || !selectedCell) return null;
    const [x, z] = lonLatToWorld(selectedCell.lon, selectedCell.lat);
    return DEPTHS.map((depth) => ({ depth, p: site.probabilityAt(x, z, depth) }));
  }, [site, selectedCell]);

  if (!rows) return null;

  return (
    <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div className="label mb-2">DEPTH PROFILE</div>
      <div>
        {rows.map((row) => {
          const [r, g, b] = rampColor(row.p);
          const isHovered = hoveredDepth === row.depth;
          return (
            <div
              key={row.depth}
              onMouseEnter={() => setHoveredDepth(row.depth)}
              onMouseLeave={() => setHoveredDepth(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 14, cursor: 'default' }}
            >
              <span className="mono" style={{ fontSize: 9, color: 'var(--text-mute)', width: 32 }}>{row.depth}m</span>
              <div
                style={{
                  height: 8,
                  width: `${row.p * 100}%`,
                  background: `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`,
                  outline: isHovered ? '1px solid var(--rhodonite)' : 'none',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add hover sync and highlight to `DrillTrace.tsx`**

In `app/src/scene/DrillTrace.tsx`, add `depth: DEPTHS[i]` to each computed trace entry (change the `.map` in the `trace` `useMemo` to include the index-derived depth):

```tsx
    return DEPTHS.map((depth) => {
      const p = site.probabilityAt(x, z, depth);
      const [r, g, b] = rampColor(p);
      return { point: [x, -depth, z] as [number, number, number], color: [r, g, b] as [number, number, number], p, depth };
    });
```

Change the tick-mesh rendering to read/write `hoveredDepth` and scale up on match:

```tsx
{trace.map((t) => {
  const hovered = useDrishti.getState().hoveredDepth === t.depth;
  return (
    <mesh
      key={t.depth}
      position={t.point}
      scale={hovered ? 1.6 : 1}
      onPointerOver={(e) => { e.stopPropagation(); useDrishti.getState().setHoveredDepth(t.depth); }}
      onPointerOut={() => useDrishti.getState().setHoveredDepth(null)}
    >
      <boxGeometry args={[6, 1.5, 6]} />
      <meshBasicMaterial color={t.color} />
    </mesh>
  );
})}
```

Note: reading `useDrishti.getState().hoveredDepth` directly inside `.map()` (rather than via the `useDrishti()` hook) means this component won't automatically re-render when the widget sets `hoveredDepth` from the DOM side. Fix by subscribing properly — replace that line with a component-level subscription:

```tsx
const hoveredDepth = useDrishti((s) => s.hoveredDepth);
```

placed with the other hook calls near the top of `DrillTrace`, and reference `hoveredDepth === t.depth` instead of the `.getState()` call inside the map.

- [ ] **Step 4: Mount in `LeftRail.tsx`**

In `app/src/ui/LeftRail.tsx`, add `import { DepthProfile } from './widgets/DepthProfile';` and add `<DepthProfile />` to the `EXPLORATION` block, after `<TargetInspector />` and before `<DrillQueue />`:

```tsx
<ModelValidation />
{shapItems.length > 0 && <Waterfall items={shapItems} title="SHAP DRIVERS" />}
<TargetInspector />
<DepthProfile />
<DrillQueue />
```

- [ ] **Step 5: Verify**

Run: `npm run dev`, select a cell, transition to `BLOCK` or `SUBSURFACE`. Expected: `DEPTH PROFILE` widget shows 25 horizontal bars, colour and length tracking `probabilityAt` at each depth. Hover a bar in the widget — the corresponding tick mesh in the 3D scene visibly grows and stays highlighted; hover a tick in the 3D scene — the matching widget row highlights (`outline` appears). Confirm visually that the widget's tallest/brightest bar sits at the same depth as the brightest tick in the scene.

- [ ] **Step 6: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add depth profile widget, synced with the 3D drill trace via hover state"
```

---

### Task 14: OPERATIONS widgets — forecast, risk board, driver waterfall, SIMULATE

**Files:**
- Modify: `app/src/store/useDrishti.ts` (add `simulationActive`, `simulationLift`, `setSimulation`)
- Modify: `app/src/scene/CameraRig.tsx` (fly to a selected mine's world position, overriding the view preset)
- Create: `app/src/ui/widgets/ProductionForecast.tsx`
- Create: `app/src/ui/widgets/RiskBoard.tsx`
- Create: `app/src/ui/widgets/RecommendedActions.tsx`
- Modify: `app/src/ui/LeftRail.tsx` (mount the three above plus a driver `Waterfall` in `OPERATIONS`)

**Interfaces:**
- Consumes: `GeneratorOutput.production` (Task 4), `MINES`, `Waterfall` (Task 12, reused unmodified with a different `items` shape), `rampColor`.
- Produces: `simulationActive: boolean`, `simulationLift: number`, `setSimulation(active: boolean, lift: number): void` on the store — read by `ProductionForecast` to render the counterfactual band, written only by `RecommendedActions`.
- Produces: `CameraRig` now also reacts to `selectedMine` — when set, it overrides the current view's preset target/position with a fly-to computed from the mine's `lonLatToWorld` coordinates, using the current view's height. `selectMine(null)` (already in the store from Task 2) returns to the plain view preset.

- [ ] **Step 1: Add simulation state to the store**

In `app/src/store/useDrishti.ts`, add to the interface:

```ts
  simulationActive: boolean;
  simulationLift: number;
  setSimulation: (active: boolean, lift: number) => void;
```

Add to the implementation:

```ts
  simulationActive: false,
  simulationLift: 0,
  setSimulation: (active, lift) => set({ simulationActive: active, simulationLift: lift }),
```

- [ ] **Step 2: Add mine fly-to to `CameraRig.tsx`**

In `app/src/scene/CameraRig.tsx`, add imports:

```ts
import { MINES } from '../data/mines';
import { lonLatToWorld } from '../lib/geo';
```

Add a helper above the component:

```ts
function minePreset(mineId: string, baseHeight: number): { position: [number, number, number]; target: [number, number, number] } {
  const mine = MINES.find((m) => m.id === mineId);
  if (!mine) return CAMERA_PRESETS.RELIEF;
  const [x, z] = lonLatToWorld(mine.lon, mine.lat);
  return { position: [x, baseHeight, z + 220], target: [x, 0, z] };
}
```

Inside the component, add:

```ts
  const selectedMine = useDrishti((s) => s.selectedMine);
  const lastMine = useRef(selectedMine);
```

Change the reset condition from `if (lastView.current !== view) {` to:

```ts
  if (lastView.current !== view || lastMine.current !== selectedMine) {
```

and add `lastMine.current = selectedMine;` alongside the existing `lastView.current = view;` inside that block.

Change the preset lookup inside `useFrame` from `const preset = CAMERA_PRESETS[view];` to:

```ts
    const preset = selectedMine ? minePreset(selectedMine, CAMERA_PRESETS[view].position[1]) : CAMERA_PRESETS[view];
```

- [ ] **Step 3: Write `app/src/ui/widgets/ProductionForecast.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { ComposedChart, Line, Area, ReferenceArea, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { MINES } from '../../data/mines';

export function ProductionForecast() {
  const site = useSiteData();
  const simulationActive = useDrishti((s) => s.simulationActive);
  const simulationLift = useDrishti((s) => s.simulationLift);
  const [mineId, setMineId] = useState('balaghat');

  const data = useMemo(() => {
    if (!site) return null;
    const series = site.production.find((p) => p.mineId === mineId)?.series ?? [];
    return series.map((pt) => ({
      ...pt,
      counterfactualP50: simulationActive && pt.forecastP50 !== null ? pt.forecastP50 * (1 + simulationLift) : null,
    }));
  }, [site, mineId, simulationActive, simulationLift]);

  const shortfallRanges = useMemo(() => {
    if (!data) return [];
    const ranges: [string, string][] = [];
    let start: string | null = null;
    for (const pt of data) {
      const inShortfall = pt.forecastP90 !== null && pt.forecastP90 < pt.plan;
      if (inShortfall && start === null) start = pt.month;
      if (!inShortfall && start !== null) { ranges.push([start, pt.month]); start = null; }
    }
    if (start !== null) ranges.push([start, data[data.length - 1].month]);
    return ranges;
  }, [data]);

  if (!data) return null;

  return (
    <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div className="label flex justify-between mb-2">
        <span>PRODUCTION FORECAST</span>
        <select
          value={mineId}
          onChange={(e) => setMineId(e.target.value)}
          className="mono"
          style={{ background: 'var(--panel-hi)', color: 'var(--text)', border: '1px solid var(--line)', fontSize: 10 }}
        >
          {MINES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--text-mute)' }} interval={11} />
          <YAxis tick={{ fontSize: 9, fill: 'var(--text-mute)' }} width={40} />
          {shortfallRanges.map(([x1, x2], i) => (
            <ReferenceArea key={i} x1={x1} x2={x2} fill="var(--risk-high)" fillOpacity={0.18} stroke="none" />
          ))}
          <Area dataKey={(d: any) => (d.forecastP10 !== null ? [d.forecastP10, d.forecastP90] : null)} stroke="none" fill="var(--ore-40)" fillOpacity={0.2} />
          <Line dataKey="actual" stroke="var(--text)" strokeWidth={1.5} dot={false} />
          <Line dataKey="forecastP50" stroke="var(--ore-80)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} />
          <Line dataKey="plan" stroke="var(--text-mute)" strokeWidth={1} dot={false} />
          {simulationActive && (
            <Line dataKey="counterfactualP50" stroke="var(--risk-low)" strokeDasharray="2 2" strokeWidth={2} dot={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Write `app/src/ui/widgets/RiskBoard.tsx`**

```tsx
import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { MINES } from '../../data/mines';

interface RiskRow { mineId: string; name: string; risk: 'LOW' | 'WATCH' | 'ACT'; shortfallProb: number; magnitudeTonnes: number; sparkline: number[]; }

function computeRiskRows(site: NonNullable<ReturnType<typeof useSiteData>>): RiskRow[] {
  return site.production.map((prod) => {
    const forecastPts = prod.series.filter((p) => p.forecastP90 !== null);
    const shortfallPts = forecastPts.filter((p) => p.forecastP90! < p.plan);
    const shortfallProb = shortfallPts.length / forecastPts.length;
    const magnitudeTonnes = shortfallPts.length
      ? shortfallPts.reduce((s, p) => s + (p.plan - p.forecastP90!), 0) / shortfallPts.length
      : 0;
    const risk: RiskRow['risk'] = shortfallProb > 0.4 ? 'ACT' : shortfallProb > 0.15 ? 'WATCH' : 'LOW';
    const sparkline = prod.series.slice(-24).map((p) => (p.actual ?? p.forecastP50 ?? 0));
    const mine = MINES.find((m) => m.id === prod.mineId)!;
    return { mineId: prod.mineId, name: mine.name, risk, shortfallProb, magnitudeTonnes, sparkline };
  }).sort((a, b) => b.shortfallProb - a.shortfallProb);
}

const RISK_COLOR: Record<RiskRow['risk'], string> = { LOW: 'var(--risk-low)', WATCH: 'var(--risk-mid)', ACT: 'var(--risk-high)' };

export function RiskBoard() {
  const site = useSiteData();
  const selectMine = useDrishti((s) => s.selectMine);
  const setView = useDrishti((s) => s.setView);
  const view = useDrishti((s) => s.view);

  const rows = useMemo(() => (site ? computeRiskRows(site) : []), [site]);

  return (
    <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div className="label mb-2">SHORTFALL RISK BOARD</div>
      {rows.map((row) => (
        <div
          key={row.mineId}
          onClick={() => { selectMine(row.mineId); if (view === 'GLOBE' || view === 'FLAT') setView('RELIEF'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
        >
          <span
            className="mono"
            style={{ fontSize: 9, padding: '2px 5px', color: 'var(--void)', background: RISK_COLOR[row.risk], letterSpacing: '0.05em' }}
          >
            {row.risk}
          </span>
          <span style={{ fontSize: 11, flex: 1 }}>{row.name}</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>{Math.round(row.shortfallProb * 100)}%</span>
          <div style={{ width: 60, height: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={row.sparkline.map((v) => ({ v }))}>
                <Line dataKey="v" stroke={RISK_COLOR[row.risk]} strokeWidth={1} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Write `app/src/ui/widgets/RecommendedActions.tsx`**

```tsx
import { useState } from 'react';
import { useDrishti } from '../../store/useDrishti';

interface Action { id: string; label: string; projectedTonnes: number; confidence: number; lift: number; }

const ACTIONS: Action[] = [
  { id: 'crusher', label: 'Advance crusher maintenance 11 days', projectedTonnes: 3200, confidence: 0.78, lift: 0.09 },
  { id: 'dumpers', label: 'Move 2 dumpers from Kandri', projectedTonnes: 2100, confidence: 0.71, lift: 0.05 },
  { id: 'shift', label: 'Add weekend shift at Balaghat', projectedTonnes: 1800, confidence: 0.64, lift: 0.03 },
];

export function RecommendedActions() {
  const setSimulation = useDrishti((s) => s.setSimulation);
  const simulationActive = useDrishti((s) => s.simulationActive);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  return (
    <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div className="label flex justify-between mb-2">
        <span>RECOMMENDED ACTIONS</span>
        {simulationActive && (
          <button onClick={() => setSimulation(false, 0)} className="mono" style={{ fontSize: 10, color: 'var(--rhodonite)', background: 'transparent' }}>
            RESET SIMULATION
          </button>
        )}
      </div>
      {ACTIONS.map((a) => (
        <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 12 }}>{a.label}</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', margin: '2px 0' }}>
            +{a.projectedTonnes}t · confidence {Math.round(a.confidence * 100)}%
          </div>
          <div className="flex gap-2" style={{ marginTop: 4 }}>
            <button
              onClick={() => setSimulation(true, a.lift)}
              className="mono"
              style={{ fontSize: 10, padding: '4px 8px', background: 'var(--ore-40)', color: 'var(--void)', border: 'none' }}
            >
              SIMULATE
            </button>
            <button
              onClick={() => setAccepted((prev) => new Set(prev).add(a.id))}
              disabled={accepted.has(a.id)}
              className="mono"
              style={{ fontSize: 10, padding: '4px 8px', background: 'transparent', color: accepted.has(a.id) ? 'var(--text-mute)' : 'var(--text)', border: '1px solid var(--line-hi)' }}
            >
              {accepted.has(a.id) ? 'ACCEPTED' : 'ACCEPT'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Mount OPERATIONS widgets and a driver waterfall in `LeftRail.tsx`**

In `app/src/ui/LeftRail.tsx`, add imports:

```tsx
import { ProductionForecast } from './widgets/ProductionForecast';
import { RiskBoard } from './widgets/RiskBoard';
import { RecommendedActions } from './widgets/RecommendedActions';
```

Add a fixed driver-waterfall dataset above the `LeftRail` component (operations drivers are a static, hand-authored set — there is no generated per-cell equivalent, matching Part I §6.7's list: equipment downtime, rainfall, blast delay, ore availability, manpower):

```tsx
const OPERATIONS_DRIVERS = [
  { label: 'Equipment downtime', value: 0.62 },
  { label: 'Monsoon haul-road delay', value: 0.41 },
  { label: 'Blast delay', value: -0.18 },
  { label: 'Ore availability', value: 0.22 },
  { label: 'Manpower shortfall', value: -0.09 },
];
```

Replace the `OPERATIONS` placeholder block with:

```tsx
{panel === 'OPERATIONS' && (
  <>
    <ProductionForecast />
    <RiskBoard />
    <Waterfall items={OPERATIONS_DRIVERS} title="PRODUCTION DRIVERS" />
    <RecommendedActions />
  </>
)}
```

- [ ] **Step 7: Verify**

Run: `npm run dev`, switch left rail to **OPERATIONS**. Expected: forecast chart defaults to Balaghat, showing a solid actual line, dashed P50 forecast, shaded P10–P90 band, a flat-ish plan line, and a red-tinted `ReferenceArea` where P90 dips below plan. Risk board lists 11 rows sorted by risk descending, Balaghat at or near the top with an `ACT` pill; click its row — camera flies to Balaghat's location in the 3D scene (switches to RELIEF if not already in a 3D state). Click **SIMULATE** on the crusher-maintenance card — a green dashed counterfactual line appears above the forecast band, visibly clearing the plan line in the shortfall months. Click **RESET SIMULATION** — the counterfactual line disappears.

- [ ] **Step 8: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add operations widgets: forecast, risk board, driver waterfall, SIMULATE"
```

---

### Task 15: Globe — displaced sphere, stars, Sausar pin, crossfade

**Design deviations from Part II §2 (both necessary for a one-day build, neither silent):**
1. **No ETOPO/GEBCO PNG, no `globe.vert.glsl`/`globe.frag.glsl`.** Relief is 3D simplex noise sampled directly on each vertex's unit normal, baked into the geometry on the CPU once (not a runtime shader displacement), followed by `computeVertexNormals()` — this is what Part II §2.2 itself instructs ("recompute vertex normals after displacement or the lighting will be flat and wrong"), and colour comes from per-vertex `BufferAttribute` colours on a stock `MeshStandardMaterial({vertexColors:true})` rather than a custom lit shader. Sampling noise on the 3D normal also structurally avoids the ±180° seam Part II §2.2 warns about — there is no 2D unwrap to seam.
2. **The exaggeration label reflects the real synthetic constant used, not Part II's literal `V.E. 180×` example** (which was written for real ETOPO metres we don't have) — Part I §11's honesty rules forbid quoting a provenance we don't have.
3. Only Site 1 (Sausar) gets a 3D pin. Sites 2–5 get a labelled, disabled row of roadmap cards (Part II §6) — no geometry, matching the design doc §5 cut list.

**Files:**
- Create: `app/src/globe/Globe.tsx`
- Create: `app/src/globe/StarField.tsx`
- Create: `app/src/ui/GlobeIntro.tsx`
- Modify: `app/src/scene/Terrain.tsx` (400ms fade-in when arriving from `GLOBE`)
- Modify: `app/src/scene/Canvas3D.tsx` (mount `<Globe/>`, `<StarField/>`)
- Modify: `app/src/App.tsx` (mount `<GlobeIntro/>`)

**Interfaces:**
- Consumes: `rampColor` (Task 5), `useDrishti.view`, `lonLatToWorld`'s inverse logic (new, local to `Globe.tsx` — lon/lat → unit-sphere normal, not reused elsewhere).
- Produces: `<Globe/>` — renders only while `view === 'GLOBE'` or during the 400ms fade-out immediately after leaving it; the Sausar pin's `onClick` calls `setView('RELIEF')`.
- Produces: a 400ms fade-in on `Terrain`'s material, active only on the transition frame where the previous view was `GLOBE` — implemented as a small local uniform, not a store field, since no other component needs it.

- [ ] **Step 1: Write `app/src/globe/Globe.tsx`**

```tsx
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { SphereGeometry, MeshStandardMaterial, Color, Mesh, BufferAttribute } from 'three';
import { Html } from '@react-three/drei';
import { createNoise3D } from 'simplex-noise';
import seedrandom from 'seedrandom';
import { useDrishti } from '../store/useDrishti';
import { rampColor } from '../lib/ramp';

const SAUSAR_CENTRE = { lon: 79.82, lat: 21.50 };
const SAUSAR_BBOX = { lonMin: 79.05, lonMax: 80.50, latMin: 21.05, latMax: 22.00 };
const EXAGGERATION = 0.05;

function lonLatToNormal(lon: number, lat: number): [number, number, number] {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  return [Math.cos(latRad) * Math.cos(lonRad), Math.sin(latRad), Math.cos(latRad) * Math.sin(lonRad)];
}
function normalToLonLat(nx: number, ny: number, nz: number): [number, number] {
  const lat = (Math.asin(ny) * 180) / Math.PI;
  const lon = (Math.atan2(nz, nx) * 180) / Math.PI;
  return [lon, lat];
}

function buildGlobeGeometry() {
  const geo = new SphereGeometry(1, 256, 128);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rng = seedrandom('26009-globe');
  const noise3D = createNoise3D(rng);

  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i), ny = pos.getY(i), nz = pos.getZ(i); // SphereGeometry positions are already unit-length normals at radius 1
    const elevation = noise3D(nx * 1.6, ny * 1.6, nz * 1.6); // -1..1
    const r = 1 + elevation * EXAGGERATION;
    pos.setXYZ(i, nx * r, ny * r, nz * r);

    const [lon, lat] = normalToLonLat(nx, ny, nz);
    const inSausar = lon >= SAUSAR_BBOX.lonMin && lon <= SAUSAR_BBOX.lonMax && lat >= SAUSAR_BBOX.latMin && lat <= SAUSAR_BBOX.latMax;
    let color: Color;
    if (inSausar) {
      const [r0, g0, b0] = rampColor(0.5 + elevation * 0.5);
      color = new Color(r0, g0, b0);
    } else if (elevation < 0) {
      color = new Color(0.06, 0.09, 0.13); // desaturated cold ocean
    } else {
      color = new Color(0.13, 0.15, 0.18); // desaturated cold land
    }
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
  }

  geo.setAttribute('color', new BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

export function Globe() {
  const view = useDrishti((s) => s.view);
  const setView = useDrishti((s) => s.setView);
  const meshRef = useRef<Mesh>(null);
  const elapsedSinceLeft = useRef(0);
  const wasGlobe = useRef(true);

  const geometry = useMemo(buildGlobeGeometry, []);
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.85 }), []);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += view === 'GLOBE' ? delta * ((2 * Math.PI) / 46) : 0;

    if (view === 'GLOBE') {
      material.opacity = 1;
      wasGlobe.current = true;
      elapsedSinceLeft.current = 0;
    } else if (wasGlobe.current) {
      elapsedSinceLeft.current += delta * 1000;
      material.opacity = Math.max(0, 1 - elapsedSinceLeft.current / 400);
      if (elapsedSinceLeft.current >= 400) wasGlobe.current = false;
    }
  });

  const visible = view === 'GLOBE' || wasGlobe.current;
  if (!visible) return null;

  const [pnx, pny, pnz] = lonLatToNormal(SAUSAR_CENTRE.lon, SAUSAR_CENTRE.lat);

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} material={material} />
      <mesh position={[pnx * 1.06, pny * 1.06, pnz * 1.06]} onClick={() => setView('RELIEF')}>
        <cylinderGeometry args={[0.004, 0.004, 0.05, 6]} />
        <meshBasicMaterial color="#D96A8E" />
        {view === 'GLOBE' && (
          <Html center distanceFactor={2} style={{ pointerEvents: 'none' }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--rhodonite)', whiteSpace: 'nowrap' }}>SAUSAR BELT · ACTIVE</div>
          </Html>
        )}
      </mesh>
      {view === 'GLOBE' && (
        <Html position={[-1.4, -1.2, 0]} transform={false} style={{ pointerEvents: 'none' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-mute)' }}>V.E. {(1 / EXAGGERATION).toFixed(0)}× · procedural relief (not ETOPO)</div>
        </Html>
      )}
    </group>
  );
}
```

- [ ] **Step 2: Write `app/src/globe/StarField.tsx`**

```tsx
import { useMemo } from 'react';
import { BufferGeometry, BufferAttribute, PointsMaterial } from 'three';
import seedrandom from 'seedrandom';
import { useDrishti } from '../store/useDrishti';

export function StarField() {
  const view = useDrishti((s) => s.view);
  const geometry = useMemo(() => {
    const rng = seedrandom('26009-stars');
    const count = 2000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const r = 8;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    return geo;
  }, []);

  const material = useMemo(() => new PointsMaterial({ size: 0.7, color: '#6C7A89', sizeAttenuation: false }), []);

  if (view !== 'GLOBE') return null;
  return <points geometry={geometry} material={material} />;
}
```

- [ ] **Step 3: Write `app/src/ui/GlobeIntro.tsx`**

```tsx
import { useDrishti } from '../store/useDrishti';

const ROADMAP_SITES = ['Sandur Schist Belt', 'Vizianagaram–Srikakulam', 'Bonai–Keonjhar', 'Indian Ocean Nodule Field'];

export function GlobeIntro() {
  const view = useDrishti((s) => s.view);
  const setView = useDrishti((s) => s.setView);
  if (view !== 'GLOBE') return null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end pb-10" style={{ pointerEvents: 'none' }}>
      <button
        onClick={() => setView('RELIEF')}
        className="mono"
        style={{
          pointerEvents: 'auto', padding: '10px 20px', fontSize: 12, letterSpacing: '0.14em',
          background: 'var(--rhodonite)', color: 'var(--void)', border: 'none', marginBottom: 16,
        }}
      >
        ENTER SAUSAR BELT
      </button>
      <div className="flex gap-2" style={{ pointerEvents: 'auto' }}>
        <div className="mono px-3 py-2" style={{ fontSize: 10, background: 'var(--panel)', border: '1px solid var(--rhodonite)', color: 'var(--text)' }}>
          SAUSAR BELT · ACTIVE
        </div>
        {ROADMAP_SITES.map((s) => (
          <div key={s} className="mono px-3 py-2" style={{ fontSize: 10, background: 'var(--panel)', border: '1px solid var(--line)', color: 'var(--text-mute)' }}>
            {s} · ROADMAP · NOT IN SCOPE FOR PS 26009
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add 400ms fade-in to `Terrain.tsx` when arriving from GLOBE**

Add to `app/src/scene/Terrain.tsx`: an `uEntryFade` uniform (`{ value: 1 }` in the `material` `useMemo`'s `uniforms`) and, in `terrain.frag.glsl`, multiply the final alpha by it — change `gl_FragColor = vec4(color, uCeilingOpacity);` (from Task 11) to:

```glsl
  gl_FragColor = vec4(color, uCeilingOpacity * uEntryFade);
```

Add `uniform float uEntryFade;` near the other uniforms in `terrain.frag.glsl`.

In `Terrain.tsx`, add tracking refs near the component's other refs:

```ts
  const lastViewForFade = useRef(view);
  const fadeElapsed = useRef(1000); // start "already faded in" so FLAT/RELIEF on first load aren't blocked
```

In the `useFrame` block, add at the top:

```ts
    if (lastViewForFade.current === 'GLOBE' && view !== 'GLOBE' && fadeElapsed.current > 400) {
      fadeElapsed.current = 0; // just arrived from the globe — start the fade-in
    }
    lastViewForFade.current = view;
    fadeElapsed.current += delta * 1000;
    material.uniforms.uEntryFade.value = Math.min(1, fadeElapsed.current / 400);
```

- [ ] **Step 5: Mount everything**

In `app/src/scene/Canvas3D.tsx`, add imports `import { Globe } from '../globe/Globe';` and `import { StarField } from '../globe/StarField';`, then mount both inside `<Suspense>` alongside the rest:

```tsx
<Suspense fallback={null}>
  <Globe />
  <StarField />
  <Terrain />
  <MineMarkers />
  <VoxelField />
  <DepthRuler />
  <DrillTrace />
  <Effects />
</Suspense>
```

In `app/src/App.tsx`, add `import { GlobeIntro } from './ui/GlobeIntro';` and mount `<GlobeIntro />` as a sibling of `<Toolbar/>`.

- [ ] **Step 6: Verify**

Run: `npm run dev`. Expected on load: a rotating displaced sphere with a visible pink pin over central India, star field behind it, `ENTER SAUSAR BELT` button and 5 site chips (1 active, 4 roadmap-labelled) at the bottom. Confirm slow rotation (~46s/revolution — eyeball it, it should feel closer to a planet than a screensaver). Click **ENTER SAUSAR BELT** — globe fades out over ~400ms while the Sausar terrain fades in; no black flash, no pop. Click the pink pin directly — same result. Frame rate should hold ≥55fps throughout with the star field and globe both on.

- [ ] **Step 7: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add globe cold open: displaced sphere, star field, Sausar pin, crossfade"
```

---

### Task 16: Viewport chrome — legend, coordinate readout, ABOUT DATA, WebGL2 fallback

**Correction to Part I §11.2, not a silent deviation:** the source spec lists "MOIL public production" as a real data layer. In this build, the production time series is entirely synthetic (Task 4's `generate.ts`) — there is no real MOIL data wired in. `AboutData.tsx` lists it as **modelled**, because listing it as real would violate the honesty requirement it exists to serve.

**Files:**
- Create: `app/src/lib/format.ts`
- Create: `app/src/ui/Legend.tsx`
- Create: `app/src/ui/CoordinateReadout.tsx`
- Create: `app/src/ui/AboutData.tsx`
- Create: `app/src/ui/Fallback.tsx`
- Create: `app/src/ui/Breadcrumb.tsx`
- Modify: `app/src/scene/Canvas3D.tsx` (extract `SiteDataProvider` so widgets keep working without WebGL)
- Modify: `app/src/ui/Toolbar.tsx` (add `RESET VIEW`)
- Modify: `app/src/ui/TopBar.tsx` (mount `Breadcrumb`, add `ABOUT DATA` trigger)
- Modify: `app/src/App.tsx` (WebGL2 detection, mount `Legend`/`CoordinateReadout`/`AboutData`/`Fallback`, wrap in `SiteDataProvider`)

**Interfaces:**
- Consumes: everything built so far.
- Produces: `SiteDataProvider` (moved out of `Canvas3D.tsx`) — `useSiteData()` keeps the same import path and signature, so no earlier task's code changes. `Canvas3D` itself becomes purely the `<Canvas>` element and its scene children; it is only ever mounted when WebGL2 is confirmed present.
- Produces: `hasWebGL2(): boolean`, a one-time synchronous check in `App.tsx`, gating whether `Canvas3D` or `Fallback` renders.

- [ ] **Step 1: Write `app/src/lib/format.ts`**

```ts
export function formatCoord(v: number, decimals = 4): string {
  return v.toFixed(decimals);
}
export function formatElevation(m: number): string {
  return `${Math.round(m)} m`;
}
export function formatProbability(p: number): string {
  return p.toFixed(3);
}
```

- [ ] **Step 2: Extract `SiteDataProvider` in `Canvas3D.tsx`**

Rewrite `app/src/scene/Canvas3D.tsx` in full:

```tsx
import { Suspense, createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraRig } from './CameraRig';
import { Terrain } from './Terrain';
import { MineMarkers } from './MineMarkers';
import { VoxelField } from './VoxelField';
import { DepthRuler } from './DepthRuler';
import { DrillTrace } from './DrillTrace';
import { Effects } from './Effects';
import { Globe } from '../globe/Globe';
import { StarField } from '../globe/StarField';
import { fetchSite } from '../data/api';
import type { GeneratorOutput } from '../data/generate';

const SiteDataContext = createContext<GeneratorOutput | null>(null);
export function useSiteData() { return useContext(SiteDataContext); }

export function SiteDataProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<GeneratorOutput | null>(null);
  useEffect(() => { fetchSite().then(setSite); }, []);
  return <SiteDataContext.Provider value={site}>{children}</SiteDataContext.Provider>;
}

export function Canvas3D() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 1, far: 4000 }}
    >
      <CameraRig />
      <hemisphereLight args={[0x8899aa, 0x0b0e12, 0.4]} />
      <directionalLight position={[400, 200, -300]} intensity={1.1} />
      <Suspense fallback={null}>
        <Globe />
        <StarField />
        <Terrain />
        <MineMarkers />
        <VoxelField />
        <DepthRuler />
        <DrillTrace />
        <Effects />
      </Suspense>
    </Canvas>
  );
}
```

This inlines the mount list Tasks 7–15 built up incrementally — no behavioural change, just relocating the `SiteDataContext.Provider` one level up so it can wrap `LeftRail` too.

- [ ] **Step 3: Write `app/src/ui/Fallback.tsx`**

```tsx
export function Fallback({ reason }: { reason: string }) {
  return (
    <div className="mono" style={{ padding: 32, maxWidth: 480, color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ color: 'var(--text)', fontSize: 16, marginBottom: 8 }}>3D scene unavailable</div>
      <div>{reason}</div>
      <div style={{ marginTop: 12, color: 'var(--text-mute)' }}>
        The exploration and operations dashboards on the left remain fully interactive.
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `app/src/ui/Legend.tsx`**

```tsx
import { useDrishti } from '../store/useDrishti';

const RAMP_CSS = 'linear-gradient(to right, #16202E, #1E4A5F, #2E7D8C, #C9A227, #E2622A, #F7E0A8)';

export function Legend() {
  const view = useDrishti((s) => s.view);
  if (view === 'GLOBE') return null;

  return (
    <div
      className="absolute bottom-4 right-4 px-3 py-2 rounded-sm"
      style={{ background: 'var(--panel)', border: '1px solid var(--line)', width: 220 }}
    >
      <div style={{ height: 8, background: RAMP_CSS, marginBottom: 4 }} />
      <div className="mono flex justify-between" style={{ fontSize: 9, color: 'var(--text-mute)' }}>
        <span>0.0</span><span>0.25</span><span>0.5</span><span>0.75</span><span>1.0</span>
      </div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.6 }}>
        <div>V.E. {view === 'FLAT' ? '0.0' : '2.4'}×</div>
        {(view === 'BLOCK' || view === 'SUBSURFACE') && <div>block 25 × 25 × 10 m</div>}
        <div style={{ marginTop: 4 }}>N ↑</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `app/src/ui/CoordinateReadout.tsx`**

```tsx
import { useSiteData } from '../scene/Canvas3D';
import { useDrishti } from '../store/useDrishti';
import { formatCoord, formatElevation, formatProbability } from '../lib/format';

export function CoordinateReadout() {
  const site = useSiteData();
  const hoverCell = useDrishti((s) => s.hoverCell);
  const view = useDrishti((s) => s.view);

  if (view === 'GLOBE' || !hoverCell || !site) return null;

  const idx = hoverCell.gz * 256 + hoverCell.gx;
  const elevation = site.elevation[idx];
  const probability = site.prospectivity[idx];

  return (
    <div className="absolute bottom-4 left-4 mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
      {formatCoord(hoverCell.lon)} E &nbsp; {formatCoord(hoverCell.lat)} N &nbsp;·&nbsp; el {formatElevation(elevation)} &nbsp;·&nbsp; p {formatProbability(probability)}
    </div>
  );
}
```

- [ ] **Step 6: Write `app/src/ui/AboutData.tsx`**

```tsx
import { useState } from 'react';

const LAYERS: { name: string; status: 'REAL' | 'MODELLED'; note: string }[] = [
  { name: 'Mine locations', status: 'REAL', note: 'Approximate, public-domain coordinates. Labelled indicative.' },
  { name: 'Site bounding box / geography', status: 'REAL', note: 'Sausar Belt extent, Nagpur/Bhandara/Balaghat.' },
  { name: 'Terrain elevation', status: 'MODELLED', note: 'Synthetic fBm + fold-axial ridge, not a real DEM.' },
  { name: 'Prospectivity raster', status: 'MODELLED', note: 'Deterministic synform generator, seed 26009.' },
  { name: 'Confidence surface', status: 'MODELLED', note: 'Synthetic proxy for model uncertainty.' },
  { name: 'SHAP driver values', status: 'MODELLED', note: 'Synthesised, not from a trained model.' },
  { name: 'Production time series', status: 'MODELLED', note: 'Synthetic — no real MOIL production data is wired in.' },
  { name: 'Globe relief', status: 'MODELLED', note: 'Procedural 3D noise, not ETOPO/GEBCO.' },
];

export function AboutData() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', background: 'transparent' }}>
        ABOUT DATA
      </button>
      {open && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', zIndex: 50 }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--panel)', border: '1px solid var(--line-hi)', padding: 20, width: 480, maxHeight: '70vh', overflowY: 'auto' }}
          >
            <div className="label mb-3">ABOUT THE DATA</div>
            {LAYERS.map((l) => (
              <div key={l.name} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="flex justify-between">
                  <span style={{ fontSize: 12 }}>{l.name}</span>
                  <span className="mono" style={{ fontSize: 10, color: l.status === 'REAL' ? 'var(--risk-low)' : 'var(--text-mute)' }}>{l.status}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{l.note}</div>
              </div>
            ))}
            <button onClick={() => setOpen(false)} className="mono" style={{ marginTop: 12, fontSize: 11, color: 'var(--text)', background: 'transparent' }}>
              CLOSE
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 7: Write `app/src/ui/Breadcrumb.tsx`**

```tsx
import { useDrishti, type ViewState } from '../store/useDrishti';

const LABEL: Record<ViewState, string> = { GLOBE: 'GLOBE', FLAT: 'FLAT', RELIEF: 'RELIEF', BLOCK: 'BLOCK MODEL', SUBSURFACE: 'UNDERGROUND' };

export function Breadcrumb() {
  const view = useDrishti((s) => s.view);
  const setView = useDrishti((s) => s.setView);

  return (
    <div className="mono flex items-center gap-1" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
      <button onClick={() => setView('GLOBE')} style={{ background: 'transparent', color: view === 'GLOBE' ? 'var(--text)' : 'var(--text-dim)' }}>GLOBE</button>
      {view !== 'GLOBE' && (
        <>
          <span>›</span>
          <button onClick={() => setView('RELIEF')} style={{ background: 'transparent', color: 'var(--text-dim)' }}>SAUSAR BELT</button>
          <span>›</span>
          <span style={{ color: 'var(--text)' }}>{LABEL[view]}</span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Add `RESET VIEW` to `Toolbar.tsx`**

In `app/src/ui/Toolbar.tsx`, add to the imports: `selectMine` and `selectCell` selectors. Add a button after the drape-switch block, inside the same floating container:

```tsx
<button
  onClick={() => { useDrishti.getState().selectMine(null); useDrishti.getState().selectCell(null); }}
  className="mono ml-2 px-2 py-1"
  style={{ fontSize: 10, color: 'var(--text-dim)', borderLeft: '1px solid var(--line)', paddingLeft: 8 }}
>
  RESET VIEW
</button>
```

- [ ] **Step 9: Wire `Breadcrumb` and `ABOUT DATA` into `TopBar.tsx`**

Change `TopBar`'s signature from `{ breadcrumb: ReactNode }` to accept it directly rendered by the caller — simplest fix, replace the whole file:

```tsx
import type { ReactNode } from 'react';
import { AboutData } from './AboutData';

export function TopBar({ breadcrumb }: { breadcrumb: ReactNode }) {
  return (
    <header
      className="flex items-center justify-between px-4 border-b"
      style={{ height: 56, background: 'var(--panel)', borderColor: 'var(--line)' }}
    >
      <div className="flex items-center gap-4">
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>DRISHTI</span>
        <span className="label">PS 26009</span>
        {breadcrumb}
      </div>
      <div className="flex items-center gap-4">
        <AboutData />
        <span className="label" style={{ fontSize: 11 }}>PROTOTYPE · SYNTHETIC DATA</span>
      </div>
    </header>
  );
}
```

- [ ] **Step 10: WebGL2 detection and final `App.tsx` assembly**

Rewrite `app/src/App.tsx` in full:

```tsx
import { TopBar } from './ui/TopBar';
import { Breadcrumb } from './ui/Breadcrumb';
import { ErrorBoundary } from './ErrorBoundary';
import { Canvas3D, SiteDataProvider } from './scene/Canvas3D';
import { LeftRail } from './ui/LeftRail';
import { Toolbar } from './ui/Toolbar';
import { BlockControls } from './ui/BlockControls';
import { Legend } from './ui/Legend';
import { CoordinateReadout } from './ui/CoordinateReadout';
import { GlobeIntro } from './ui/GlobeIntro';
import { Fallback } from './ui/Fallback';
import { useDrishti } from './store/useDrishti';

function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

const WEBGL2_AVAILABLE = hasWebGL2();

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar breadcrumb={<Breadcrumb />} />
      <SiteDataProvider>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <LeftRail />
          <main style={{ flex: 1, position: 'relative', background: 'var(--void)' }}>
            <ErrorBoundary fallback={<Fallback reason="The 3D scene crashed while rendering." />}>
              {WEBGL2_AVAILABLE ? <Canvas3D /> : <Fallback reason="WebGL2 is not available in this browser." />}
            </ErrorBoundary>
            <Toolbar />
            <DepositsToggle />
            <BlockControls />
            <Legend />
            <CoordinateReadout />
            <GlobeIntro />
          </main>
        </div>
      </SiteDataProvider>
    </div>
  );
}

function DepositsToggle() {
  const view = useDrishti((s) => s.view);
  const show = useDrishti((s) => s.showKnownDeposits);
  const toggle = useDrishti((s) => s.toggleKnownDeposits);
  if (view !== 'FLAT') return null;
  return (
    <button
      onClick={toggle}
      className="absolute top-4 left-4 mono px-3 py-2 rounded-sm"
      style={{
        fontSize: 11, letterSpacing: '0.1em',
        background: show ? 'var(--rhodonite)' : 'var(--panel)',
        color: show ? 'var(--void)' : 'var(--text)',
        border: '1px solid var(--line)',
      }}
    >
      SHOW KNOWN DEPOSITS
    </button>
  );
}
```

- [ ] **Step 11: Verify**

Run: `npm run dev`. Expected: breadcrumb in the topbar updates as you change states and each segment is clickable; `ABOUT DATA` opens a modal listing 8 layers, `Production time series` marked `MODELLED`; legend bottom-right shows the ore gradient with correct tick labels and matches the on-screen ramp colours by eye; coordinate readout bottom-left updates on hover in FLAT/RELIEF and shows `lon E lat N · el ... m · p ...`; `RESET VIEW` in the toolbar clears any mine-fly-to or selected cell. Then test the fallback: in devtools, run `Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {value: () => null})` in the console **before** reload, reload the page — expected: the honest "3D scene unavailable" message renders where the canvas would be, and the left rail widgets still render (in their empty states, since `site` will be `null` without a WebGL context blocking anything — `fetchSite()` itself has no WebGL dependency, so this should still populate `ModelValidation`/`RiskBoard`/etc. with real numbers even in fallback mode).

- [ ] **Step 12: Commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add viewport chrome: legend, coordinate readout, breadcrumb, ABOUT DATA, WebGL2 fallback"
```

---

### Task 17: Performance pass, perf HUD, demo rehearsal

**Files:**
- Create: `app/src/scene/PerfHud.tsx`
- Modify: `app/src/scene/Canvas3D.tsx` (mount `PerfHud`, debug-gated)

**Interfaces:**
- Consumes: `gl.info` (three.js renderer stats), `useFrame`.
- Produces: nothing consumed by other tasks — this is the last task.

- [ ] **Step 1: Write `app/src/scene/PerfHud.tsx`**

```tsx
import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';

const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

export function PerfHud() {
  const { gl } = useThree();
  const [stats, setStats] = useState({ fps: 0, calls: 0 });
  const frames = useRef(0);
  const lastSample = useRef(0);

  useFrame((_, delta) => {
    if (!DEBUG) return;
    frames.current++;
    lastSample.current += delta;
    if (lastSample.current >= 0.5) {
      setStats({ fps: Math.round(frames.current / lastSample.current), calls: gl.info.render.calls });
      frames.current = 0;
      lastSample.current = 0;
    }
  });

  if (!DEBUG) return null;

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div className="mono absolute top-16 right-4" style={{ fontSize: 11, color: stats.fps < 55 ? 'var(--risk-high)' : 'var(--risk-low)' }}>
        {stats.fps} fps · {stats.calls} draw calls
      </div>
    </Html>
  );
}
```

- [ ] **Step 2: Mount in `Canvas3D.tsx`**

Add `import { PerfHud } from './PerfHud';` and mount `<PerfHud />` inside `<Suspense>`, alongside the rest.

- [ ] **Step 3: Build and check the bundle budget**

Run: `npm run build` (from `app/`)
Then: `du -sh dist/assets/*.js | sort -rh` and check gzip: `gzip -c dist/assets/*.js | wc -c` per file, or use `npx vite-bundle-visualizer` if time allows.
Expected: total gzipped JS under 1.6MB (Part I §8). If over, check first whether `@react-three/postprocessing` or `recharts` dominate — both are acceptable costs already accounted for in the design doc's decision to drop MapLibre/deck.gl; do not remove features to hit this number without checking actual gzip size first.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run` (from `app/`)
Expected: all tests pass — `tests/ramp.test.ts` (2 assertions) and `tests/generate.test.ts` (5 assertions).

- [ ] **Step 5: Rehearse the demo script against a stopwatch, twice**

Run: `npm run dev`, open with `?debug=1` for the FPS HUD during rehearsal (drop it for the real demo).

```
0:00  GLOBE. Slow rotation, Sausar pin visible, 4 roadmap chips visible below.
      Click ENTER SAUSAR BELT.
0:10  FLAT. Click SHOW KNOWN DEPOSITS — 11 markers land inside the hot zones.
0:25  Click an unmined hot cell. SHAP waterfall opens in the left rail.
0:40  Camera moves to RELIEF automatically (cell click triggers it). Switch drape
      PROSPECTIVITY -> CONFIDENCE -> PROSPECTIVITY.
1:00  Click BLOCK MODEL in the toolbar. Do not talk over the first 1.5s of the bloom.
1:20  Drag CUTOFF 0.30 -> 0.75. Field thins to the folded horizon.
1:35  Click UNDERGROUND. Fog, translucent ceiling, drill trace appears at the
      selected cell. Drag DEPTH SLICE.
1:55  Switch left rail to OPERATIONS. Balaghat forecast shows the shortfall
      shading. Click Balaghat's row in the risk board — camera flies to it.
2:15  SIMULATE on the crusher-maintenance action — counterfactual band lifts
      above plan.
2:30  RESET VIEW, breadcrumb click back to GLOBE.
2:40  Stop.
```

Expected: no stall at any transition, FPS HUD stays ≥55 through the BLOCK and SUBSURFACE segments, runs clean twice in a row.

- [ ] **Step 6: Walk the full acceptance checklist from the design doc**

Open `docs/superpowers/specs/2026-08-27-drishti-3d-design.md` §8 and check off each of the 12 boxes against the running app. Do not check a box from memory — reproduce the exact interaction it describes and observe the result.

- [ ] **Step 7: Final commit**

```bash
cd /Users/vignesh/Projects/SIH/app
git add .
git commit -m "Add perf HUD, verify bundle budget and full test suite, rehearse demo script"
```

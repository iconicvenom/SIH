import { create } from 'zustand';

/** Five states, one continuous three.js scene. Part II's G1/G2 are cut (one site ships). */
export type ViewState = 'GLOBE' | 'FLAT' | 'RELIEF' | 'BLOCK' | 'SUBSURFACE';
export type Drape = 'PROSPECTIVITY' | 'CONFIDENCE';
export type Panel = 'EXPLORATION' | 'OPERATIONS';

/** Part III §2 — the four dashboard tabs. */
export type Tab = 'OVERVIEW' | 'EXPLORATION' | 'OPERATIONS' | 'ACQUISITIONS';

/** Part III §5.4 — five real scene layers. */
export interface Layers {
  mines: boolean;
  prospectivity: boolean;
  lineaments: boolean;
  swaths: boolean;
  risk: boolean;
}

/** Part III §5.3 — three what-if scenarios, each must visibly change the dock within 400ms. */
export interface Scenarios {
  monsoon: boolean;
  equipmentLoss: boolean;
  cutoffChange: boolean;
}

export interface CellRef {
  gx: number;
  gz: number;
  lon: number;
  lat: number;
  /** World-space Y of the exact picked point on the (possibly elevation-displaced) terrain
   *  surface, when known — a live terrain click has this from the raycast hit itself
   *  (continuous, sub-cell precision); a target picked from a list (e.g. Top Drill Targets)
   *  doesn't, since it never raycast anything, and callers fall back to the cell's stored
   *  elevation. Optional so every existing selectCell() call site keeps compiling as-is. */
  y?: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface DrishtiStore {
  // ---- navigation ----
  view: ViewState;
  tab: Tab;
  transitioning: boolean;
  /** Opening sequence stage 0..7, Part III §6. 7 === settled. */
  bootStage: number;
  reducedMotion: boolean;

  // ---- scene ----
  drape: Drape;
  panel: Panel;
  layers: Layers;
  showKnownDeposits: boolean;
  cutoff: number;
  depthRange: [number, number];
  blockBloomProgress: number;

  // ---- selection ----
  selectedCell: CellRef | null;
  selectedMine: string | null;
  selectedSensor: string | null;
  selectedAlert: string | null;
  hoverCell: CellRef | null;
  hoveredDepth: number | null;

  // ---- operations / what-if ----
  scenarios: Scenarios;
  simulationActive: boolean;
  simulationLift: number;

  camera: { position: Vec3; target: Vec3 };

  // ---- actions ----
  setView: (v: ViewState) => void;
  setTab: (t: Tab) => void;
  setBootStage: (s: number) => void;
  setDrape: (d: Drape) => void;
  setPanel: (p: Panel) => void;
  toggleLayer: (k: keyof Layers) => void;
  toggleKnownDeposits: () => void;
  setCutoff: (v: number) => void;
  setDepthRange: (r: [number, number]) => void;
  setBlockBloomProgress: (p: number) => void;
  selectCell: (c: CellRef | null) => void;
  selectMine: (id: string | null) => void;
  selectSensor: (id: string | null) => void;
  selectAlert: (id: string | null) => void;
  hoverCellAt: (c: CellRef | null) => void;
  setHoveredDepth: (d: number | null) => void;
  toggleScenario: (k: keyof Scenarios) => void;
  setSimulation: (active: boolean, lift: number) => void;
  setCamera: (position: Vec3, target: Vec3) => void;
}

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useDrishti = create<DrishtiStore>((set) => ({
  view: 'GLOBE',
  tab: 'OVERVIEW',
  transitioning: false,
  bootStage: prefersReducedMotion ? 7 : 0,
  reducedMotion: prefersReducedMotion,

  drape: 'PROSPECTIVITY',
  panel: 'EXPLORATION',
  layers: { mines: true, prospectivity: true, lineaments: false, swaths: true, risk: true },
  showKnownDeposits: true,
  cutoff: 0.28,
  depthRange: [0, 240],
  blockBloomProgress: 1,

  selectedCell: null,
  selectedMine: null,
  selectedSensor: null,
  selectedAlert: null,
  hoverCell: null,
  hoveredDepth: null,

  scenarios: { monsoon: false, equipmentLoss: false, cutoffChange: false },
  simulationActive: false,
  simulationLift: 0,

  camera: { position: { x: 0, y: 600, z: 900 }, target: { x: 0, y: 0, z: 0 } },

  setView: (v) => set({ view: v, transitioning: true }),
  setTab: (t) => set({ tab: t }),
  setBootStage: (s) => set({ bootStage: s }),
  setDrape: (d) => set({ drape: d }),
  setPanel: (p) => set({ panel: p }),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  toggleKnownDeposits: () => set((s) => ({ showKnownDeposits: !s.showKnownDeposits })),
  setCutoff: (v) => set({ cutoff: v }),
  setDepthRange: (r) => set({ depthRange: r }),
  setBlockBloomProgress: (p) => set({ blockBloomProgress: p }),
  // Inspecting a spot must not clear the mine that anchors the camera's orbit.
  selectCell: (c) => set({ selectedCell: c }),
  selectMine: (id) => set({ selectedMine: id, ...(id ? { selectedCell: null } : {}) }),
  selectSensor: (id) => set({ selectedSensor: id }),
  selectAlert: (id) => set({ selectedAlert: id }),
  hoverCellAt: (c) => set({ hoverCell: c }),
  setHoveredDepth: (d) => set({ hoveredDepth: d }),
  toggleScenario: (k) =>
    set((s) => {
      const scenarios = { ...s.scenarios, [k]: !s.scenarios[k] };
      // Each scenario maps to a forecast lift; combined so the dock always reflects reality.
      const lift =
        (scenarios.monsoon ? -0.14 : 0) +
        (scenarios.equipmentLoss ? -0.09 : 0) +
        (scenarios.cutoffChange ? 0 : 0);
      const anyOn = scenarios.monsoon || scenarios.equipmentLoss;
      return { scenarios, simulationActive: anyOn, simulationLift: lift };
    }),
  setSimulation: (active, lift) => set({ simulationActive: active, simulationLift: lift }),
  setCamera: (position, target) => set({ camera: { position, target } }),
}));

// Dev-only escape hatch so manual/E2E verification can drive state transitions without
// needing pixel-perfect WebGL raycasting. Never included in a production build.
if (import.meta.env.DEV) {
  (window as unknown as { __drishti: typeof useDrishti }).__drishti = useDrishti;
}

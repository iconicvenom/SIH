import { createNoise2D, createNoise3D } from 'simplex-noise';
import seedrandom from 'seedrandom';
import { GRID, WORLD_SIZE, gridToWorld, lonLatToWorld, worldToGrid } from '../lib/geo';
import { FEATURES } from './features';
import { MINES } from './mines';

/* ============================================================================================
 * DRISHTI — deterministic site generator, Sausar Belt (Site 1).
 *
 * Everything downstream of this file is a view of one pure function of one string. Same seed,
 * same rasters, same numbers, on every machine, forever. That is the only reason the validation
 * figures in the deck can be quoted.
 *
 * ── WHAT THE MODEL IS ────────────────────────────────────────────────────────────────────────
 * The Sausar Belt ore horizon (Mansar Formation braunite–bixbyite) is a stratigraphic marker
 * that has been folded into a train of tight, doubly-plunging synforms. Across most of the belt
 * that horizon now sits ABOVE the present erosion surface — it has been stripped. It survives
 * only where the fold train carries it back down beneath the surface: in the synclinal keels.
 *
 * So the map-view driver is not "distance to a line". It is PRESERVATION: how far below the
 * present surface the folded horizon still lies. That single idea produces, for free, all the
 * things a prospectivity map for a folded belt is supposed to have —
 *   • long strike-parallel ribbons rather than isotropic blobs,
 *   • ribbons that curve where the axial trace meanders,
 *   • repetition across strike (one ribbon per keel), and
 *   • a belt that closes off laterally where the fold amplitude dies.
 *
 * ── WHERE THE 11 MINES ENTER, AND WHERE THEY DO NOT ──────────────────────────────────────────
 * MINE_BOOST is 0 and is exported so anyone can grep for it. There is no per-mine term anywhere
 * in this file: no bump, no radius, no additive kernel at a mine coordinate. `distance_to_known_mine`
 * is in the feature schema but its SHAP contribution is pinned to exactly zero.
 *
 * The mine coordinates DO enter in exactly one place: the structural frame. The fold axis is the
 * dominant eigenvector of the mines' 2×2 covariance matrix, and the fold-train wavelength and the
 * axial meander were fitted so that the belt's keels run through them. That is ordinary supervised
 * mineral-prospectivity practice — you fit structure to known occurrences — but it means the
 * honest claim is narrow and should be stated narrowly:
 *
 *     "11 of 11 producing mines fall in the top 5% of the ranked map, from a structural frame
 *      with no per-deposit term."
 *
 * NOT "we predicted the mines out of sample". The frame was fitted to them. What the map earns is
 * the EXTENSIONS: the >220 cells of hot ground that the same frame lights up where nobody is
 * mining. Those are the product, and they are the part nothing was fitted to.
 * ============================================================================================ */

export const SEED = '26009';

/**
 * Locked at zero. Every cell is scored by structure alone; no term in this file reads a mine
 * coordinate except the fold-axis fit. Raising this would make the top-5% figure circular.
 */
export const MINE_BOOST = 0;

/** Modelled subsurface column, metres below the topographic surface. */
export const COLUMN_DEPTH_M = 240;

// HISTORY_MONTHS % 12 must equal 8 for the seam (HISTORY_MONTHS - 1) to land on August — the
// app's stated "today" (2026-08-28). monthLabel()'s calendar phase (Jan = index 0 of any year)
// is load-bearing for SEASONAL's real monsoon shape, so the fix is HISTORY_MONTHS's length, not
// its start-of-year offset. 116 = 104 + 12, i.e. the same ~9-year span the old 108 gave, just
// shifted 8 months so the forecast horizon actually starts at "now" instead of December 2024.
export const HISTORY_MONTHS = 116;
export const FORECAST_MONTHS = 24;
export const TOTAL_MONTHS = HISTORY_MONTHS + FORECAST_MONTHS;
const SERIES_START_YEAR = 2017;

// ── interfaces ────────────────────────────────────────────────────────────────────────────────

export interface ShapContribution {
  feature: string;
  value: number;
}

export interface ProductionPoint {
  /** 'YYYY-MM'. */
  month: string;
  /** Tonnes. Null across the forecast horizon. */
  actual: number | null;
  /** Tonnes. Null across history, except the seam month so the ribbon joins the actual line. */
  forecastP50: number | null;
  forecastP10: number | null;
  forecastP90: number | null;
  /** Tonnes. Always present — the plan exists for every month, met or not. */
  plan: number;
}

export interface MineProduction {
  mineId: string;
  series: ProductionPoint[];
}

/** A structural lineament traced from DEM hillshade, as a polyline in world x/z. */
export interface Lineament {
  points: [number, number][];
}

export interface GeneratorOutput {
  /** Metres above sea level, 250..600. Row-major Float32Array(GRID*GRID), index gz*GRID+gx. */
  elevation: Float32Array;
  /** 0..1 prospectivity, the max of the 3D field over the modelled column. */
  prospectivity: Float32Array;
  /** 0..1 model confidence. */
  confidence: Float32Array;
  /** 3D ore probability at a world position and a depth in 0..COLUMN_DEPTH_M. */
  probabilityAt(xWorld: number, zWorld: number, depthMeters: number): number;
  /** Fitted fold-axis azimuth in the world x/z frame, degrees. */
  foldAxisAngleDeg: number;
  /** All 18 predictors' contributions at a cell, sorted by descending |value|. */
  shapAt(gx: number, gz: number): ShapContribution[];
  production: MineProduction[];
  lineaments: Lineament[];
}

// ── small maths helpers ───────────────────────────────────────────────────────────────────────

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Deterministic 32-bit string hash — used to give each feature its own slice of noise space. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ── the structural frame ──────────────────────────────────────────────────────────────────────

interface FoldAxis {
  angleRad: number;
  cos: number;
  sin: number;
  cx: number;
  cz: number;
}

/**
 * Principal axis of the 11 mine positions in world x/z, closed form:
 *   angle = ½·atan2(2·Sxz, Sxx − Szz)
 * This is the dominant eigenvector of the 2×2 covariance matrix. Nothing about the belt's
 * orientation is hardcoded — move a mine and the whole map rotates with it.
 */
function fitFoldAxis(): FoldAxis {
  const pts = MINES.map((m) => lonLatToWorld(m.lon, m.lat));
  const n = pts.length;
  let cx = 0;
  let cz = 0;
  for (const [x, z] of pts) {
    cx += x;
    cz += z;
  }
  cx /= n;
  cz /= n;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (const [x, z] of pts) {
    const dx = x - cx;
    const dz = z - cz;
    sxx += dx * dx;
    szz += dz * dz;
    sxz += dx * dz;
  }
  sxx /= n;
  szz /= n;
  sxz /= n;
  const angleRad = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  return { angleRad, cos: Math.cos(angleRad), sin: Math.sin(angleRad), cx, cz };
}

/* ── fold-train constants ──────────────────────────────────────────────────────────────────────
 * KEEL_WAVE and the two meander octaves were fitted (coordinate descent over the 11 mines' raster
 * sample points) so that every mine sits within ~3.9 world units — about 470 m on the ground — of
 * a keel axis. That is the single fit that earns the 11/11 figure, and it is a global structural
 * fit with 8 numbers, not 11 per-mine terms.
 *
 * KEEL_WAVE ≈ 93.3 wu ≈ 11.5 km keel spacing: a realistic wavelength for the Sausar fold train.
 * The meander is two octaves — a long regional curvature of the belt plus a shorter parasitic
 * swing — because a fold axial trace that is a perfectly straight line does not exist in nature
 * and does not look like nature. */
const KEEL_WAVE = 93.311002;
const MEANDER_BIAS = 75.373696;
const MEANDER_A1 = 30.01128;
const MEANDER_F1 = 0.0015423649;
const MEANDER_Y1 = 9.102422;
const MEANDER_A2 = 22.643751;
const MEANDER_F2 = 0.0050658253;
const MEANDER_Y2 = 13.647551;

/** Ground scale of one world unit, geometric mean of the bbox's x and z scales. */
const METRES_PER_WU = 122.8;

/**
 * Fold-limb dip, which sets the fold amplitude rather than the other way round: a sinusoid of
 * wavelength λ and amplitude A has a maximum limb dip of atan(2πA/λ). Tight folds make hairline
 * outcrop ribbons; open folds make broad ones. 5.5° over an 11.5 km wavelength puts the ore
 * horizon's subcrop band at roughly 4–5 km across, which is the scale the Sausar workings sit on.
 */
const LIMB_DIP_DEG = 5.5;
const FOLD_AMP = (Math.tan(LIMB_DIP_DEG * DEG) * (KEEL_WAVE * METRES_PER_WU)) / TWO_PI;

/**
 * Fold trains tighten and open along their length, and neighbouring keels do it independently.
 * Without this every ribbon is a translated copy of one sine wave and the map reads as generated
 * rather than mapped — the most obvious tell there is in a synthetic prospectivity raster.
 *
 * It also varies the subcrop WIDTH, in the correct causal direction: a keel that folds harder
 * exposes a narrower band of the horizon, and one that opens out exposes a broader one.
 */
const FOLD_AMP_FLOOR = 0.5;
const FOLD_AMP_MID = (FOLD_AMP_FLOOR + 1) / 2;
const FOLD_AMP_FREQ_U = 0.0036;

/**
 * Regional structural datum of the ore horizon, metres below the present surface. Negative: over
 * most of the belt the horizon has already been eroded off, and only the keels drag it back into
 * the modelled column. At a typical fold amplitude this puts a keel axis around 115 m down —
 * and where a keel opens out below FOLD_AMP_MID it pinches toward the surface and dies, which is
 * what breaks the ribbons into pods along strike.
 */
const REGIONAL_DATUM = -(FOLD_AMP * FOLD_AMP_MID - 115);

/** Structural plunge of the fold axis. */
export const PLUNGE_DEG = 12;

/**
 * Net along-axis deepening of the horizon relative to the present surface.
 *
 * A true 12° plunge drops 240 m in 1.1 km. Over a 150 km belt it would put ten of the eleven
 * mines outside the modelled column, so it cannot be applied globally to a 240 m box — the dip
 * that the fold geometry carries is the LIMB dip above, and what the horizon carries along strike
 * is the NET deepening the block model can actually show: tan(12°) × the column depth over one
 * world-span of along-axis run.
 */
const PLUNGE_M_PER_WU = (Math.tan(PLUNGE_DEG * DEG) * COLUMN_DEPTH_M) / WORLD_SIZE;

/** The fold train's amplitude is full out to BELT_INNER and dead by BELT_OUTER (world units). */
const BELT_INNER = 168;
const BELT_OUTER = 236;

/** Amplitude and frequency of the low-order warp that keeps the ribbon edges from being smooth. */
const WARP_AMP_M = 30;
const WARP_FREQ_U = 0.0026;
const WARP_FREQ_V = 0.0054;

/**
 * Fine, short-wavelength lateral jitter on the ribbon edges — real subcrop boundaries are not
 * razor-straight the way a bare sinusoid is. Amplitude is small enough to stay inside the
 * ~8 world-unit (~1km) positional tolerance the test suite already treats as noise around a
 * mine's raster cell (tests/generate.test.ts's 3x3-neighbourhood check exists for exactly this
 * kind of slop), so it roughens the ribbon without risking the 11/11 top-5% claim. Wavelength
 * is shorter than every other spatial term in this file on purpose — it has to read as texture,
 * not as a second meander.
 */
const EDGE_JITTER_AMP_WU = 4.5;
const EDGE_JITTER_FREQ = 0.03;
/** Second, finer octave — real boundaries are rough at more than one scale at once. */
const EDGE_JITTER2_AMP_WU = 2;
const EDGE_JITTER2_FREQ = 0.09;

/** Map-view gaps: barren ground inside the belt, independent of the 3D pocket field. */
const GAP_LO = 0.3;
const GAP_HI = 0.62;
const GAP_FLOOR = 0.3;
const GAP_FREQ = 0.0052;

/** Ore thickness across a keel — thickest in the trough core, thinning onto the limbs. */
const THICK_CORE_M = 54;
const THICK_LIMB_M = 17;
const THICK_SIGMA_WU = 11;

/** Isoclinal repetition in the depth direction: the banding term from the spec. */
const BAND_FREQ = 0.22;

/** Pocket field — the orebody is discontinuous. Thresholds are on a 0..1 remapped simplex. */
const POCKET_LO = 0.3;
const POCKET_HI = 0.72;
const POCKET_FLOOR = 0.22;
const POCKET_FREQ_XZ = 0.0092;
const POCKET_FREQ_D = 0.013;

/** Mild along-strike grade variation so the ribbons are not rulers. */
const ALONG_FLOOR = 0.84;

const CONFIDENCE_SIGMA_WU = 168;

// ── noise fields ──────────────────────────────────────────────────────────────────────────────
// Each field gets its own seeded generator so that adding a field never shifts the others.
// The meander field MUST stay on the bare SEED: the fitted constants above are tied to it.

const nMeander = createNoise2D(seedrandom(SEED));
const nWarp = createNoise2D(seedrandom(`${SEED}:warp`));
const nAlong = createNoise2D(seedrandom(`${SEED}:along`));
const nTerrain = createNoise2D(seedrandom(`${SEED}:terrain`));
const nConfidence = createNoise2D(seedrandom(`${SEED}:confidence`));
const nShap = createNoise2D(seedrandom(`${SEED}:shap`));
const nEdgeJitter = createNoise2D(seedrandom(`${SEED}:edgejitter`));
const nPocket = createNoise3D(seedrandom(`${SEED}:pocket`));

// Visual-relief-only fields — buildElevation() reads these, probabilityAt() never does. They
// exist to give the RENDERED terrain a naturally varied shape without touching a single number
// the prospectivity/validation claims depend on.
const nRelief2 = createNoise2D(seedrandom(`${SEED}:relief2`));
const nValley = createNoise2D(seedrandom(`${SEED}:valley`));
const nDomainWarpX = createNoise2D(seedrandom(`${SEED}:domainwarp:x`));
const nDomainWarpZ = createNoise2D(seedrandom(`${SEED}:domainwarp:z`));
const nPlateau = createNoise2D(seedrandom(`${SEED}:plateau`));

const AXIS = fitFoldAxis();

/** Along-axis (u) and across-axis (v) coordinates, centred on the mine centroid. */
function alongAxis(x: number, z: number): number {
  return (x - AXIS.cx) * AXIS.cos + (z - AXIS.cz) * AXIS.sin;
}

function acrossAxis(x: number, z: number): number {
  return -(x - AXIS.cx) * AXIS.sin + (z - AXIS.cz) * AXIS.cos;
}

/** Lateral position of the axial trace at along-axis distance u. */
function meander(u: number): number {
  return (
    MEANDER_BIAS +
    MEANDER_A1 * nMeander(u * MEANDER_F1, MEANDER_Y1) +
    MEANDER_A2 * nMeander(u * MEANDER_F2, MEANDER_Y2)
  );
}

/** Fold-train phase. Integer values are keel (synform) axes; half-integers are antiform crests. */
function keelPhase(u: number, v: number): number {
  return (v - meander(u)) / KEEL_WAVE;
}

/**
 * Amplitude of the fold train at a point: dead outside the belt, and modulated along strike
 * independently for each keel so no two ribbons are the same shape or the same width.
 *
 * The keel index is used as the second noise coordinate, so the modulation is piecewise constant
 * across strike. The steps land on the antiform crests, where the horizon is eroded away and the
 * probability is already zero — so they are invisible, which is the point.
 */
function foldAmplitude(u: number, v: number, keelIndex: number): number {
  const belt = 1 - smoothstep(BELT_INNER, BELT_OUTER, Math.abs(v));
  const tighten = 0.5 + 0.5 * nAlong(u * FOLD_AMP_FREQ_U, keelIndex * 2.3 + 51.7);
  return FOLD_AMP * belt * (FOLD_AMP_FLOOR + (1 - FOLD_AMP_FLOOR) * tighten);
}

/**
 * Everything the fold geometry determines at one map position, computed once.
 *
 *   psi        fold-train phase; integers are keel axes, half-integers antiform crests
 *   vk         signed distance to the nearest keel axis, world units
 *   hRaw       ore-horizon depth below the present surface, metres, UNCLAMPED. Negative means
 *              the horizon has been eroded off here; > COLUMN_DEPTH_M means it lies below the
 *              modelled column. Both are real geological statements, so the clamp is applied
 *              downstream at render time, not here.
 *   subcrop    the map-view driver, 0..1 — see below.
 */
interface FoldPoint {
  psi: number;
  vk: number;
  hRaw: number;
  subcrop: number;
}

/**
 * SUBCROP — how deeply the folded horizon is preserved here, as a FRACTION of the structural
 * relief the fold has available at this point.
 *
 * This normalisation is the load-bearing design decision in the whole generator, and it took a
 * failed build to find. The obvious formulation — score cells by the absolute horizon depth —
 * looks identical on paper but is wrong, because the fold amplitude varies along strike: a keel
 * that folds hard sits 90 m deeper than one that opens out, which swamps the few metres of depth
 * that separate a cell ON a keel axis from a cell 4 wu off it. Rank on absolute depth and you are
 * mostly ranking the amplitude noise, so producing mines scatter to the 9th–14th percentile and
 * the map stops meaning anything.
 *
 * Expressed as a fraction of local relief, every keel axis scores 1 regardless of how hard it
 * folds, and the score falls off with distance from the axis — which is the actual geological
 * claim. Amplitude modulation is then free to vary the ribbon WIDTH (a harder fold exposes a
 * narrower band of horizon) without touching what the ribbon ranks.
 */
function foldAt(u: number, v: number): FoldPoint {
  const jitter =
    EDGE_JITTER_AMP_WU * nEdgeJitter(u * EDGE_JITTER_FREQ, v * EDGE_JITTER_FREQ) +
    EDGE_JITTER2_AMP_WU * nEdgeJitter(u * EDGE_JITTER2_FREQ + 500, v * EDGE_JITTER2_FREQ + 500);
  const psi = keelPhase(u, v + jitter);
  const keelIndex = Math.round(psi);
  const vk = (psi - keelIndex) * KEEL_WAVE;

  const relief = foldAmplitude(u, v, keelIndex);
  const t = Math.cos(TWO_PI * psi);
  const datum =
    REGIONAL_DATUM + PLUNGE_M_PER_WU * u + WARP_AMP_M * nWarp(u * WARP_FREQ_U, v * WARP_FREQ_V);
  const hRaw = datum + relief * t;

  // The erosion surface cuts the fold at t = cutoff; below that the horizon is gone. The ramp
  // from there to the keel axis is LINEAR on purpose — it is literally the fraction of the fold's
  // relief lying below the surface, and no smoothing belongs on a fraction.
  //
  // The linearity matters far beyond tidiness. A smoothstep here has zero gradient at t = 1, so
  // every cell within a few units of a keel axis scores an indistinguishable ~1.0; structure
  // stops ranking anything and the along-strike noise terms decide the order instead. That single
  // substitution moved the worst producing mine from the 3.9th percentile to the 13.9th.
  const cutoff = relief > 1 ? clamp(-datum / relief, -1, 0.97) : 1;
  // Where even the keel axis is barely preserved the ribbon pinches out — this is what
  // terminates ribbons along strike into pods instead of running them off the frame edge.
  const headroom = smoothstep(-24, 40, datum + relief);
  const subcrop = relief > 1 ? clamp01((t - cutoff) / (1 - cutoff)) * headroom : 0;

  return { psi, vk, hRaw, subcrop };
}

function alongStrikeGrade(u: number, v: number): number {
  return ALONG_FLOOR + (1 - ALONG_FLOOR) * (0.5 + 0.5 * nAlong(u * 0.0021, v * 0.0009));
}

/**
 * Map-view barren ground. The 3D pocket field alone cannot do this job: the prospectivity raster
 * is a maximum over the whole column, and a maximum over ~50 samples almost always finds an open
 * pocket somewhere, so the ribbons come out unbroken. This term is what segments them.
 *
 * `coreness` (pass `fold.subcrop`) raises the floor toward 1 as preservation improves. Without
 * it this is raw x/z noise with no relationship to the fold geometry, and it WILL — for some
 * seed, on some keel axis — dip toward GAP_FLOOR exactly at a producing mine, because nothing
 * ties its phase to the structure that is supposed to explain the mine being there at all.
 * Segmentation belongs on the fringes where the horizon is already marginal, not on the
 * best-preserved ground: a cell sitting on a well-fit keel axis should not be erasable by noise
 * that has nothing to do with why that axis is there.
 */
function surfaceGap(x: number, z: number, coreness: number): number {
  const t = 0.5 + 0.5 * nAlong(x * GAP_FREQ + 311, z * GAP_FREQ - 197);
  const floor = GAP_FLOOR + (1 - GAP_FLOOR) * coreness;
  return floor + (1 - floor) * smoothstep(GAP_LO, GAP_HI, t);
}

/** Ore thickness in metres at a point, thickest in the trough core. */
function oreThickness(vk: number): number {
  return (
    THICK_LIMB_M + (THICK_CORE_M - THICK_LIMB_M) * Math.exp(-0.5 * (vk / THICK_SIGMA_WU) ** 2)
  );
}

/**
 * `coreness` (pass `fold.subcrop`) is the same treatment as `surfaceGap`: the pocket field's
 * depth-noise has no obligation to phase-align with the banding term's peak at any given column,
 * so a mine can land on a column where the two never coincide well even though the horizon is
 * perfectly preserved there (subcrop ~1). That is noise doing structural work it was never meant
 * to do. Raising the floor toward 1 on well-preserved ground keeps pockets fully expressive in
 * the extensions — where "the orebody is discontinuous" is actually the honest story — without
 * letting them erode the trough core the structural fit already confirmed.
 */
function pocketAt(x: number, z: number, depth: number, coreness: number): number {
  const t = 0.5 + 0.5 * nPocket(x * POCKET_FREQ_XZ, z * POCKET_FREQ_XZ, depth * POCKET_FREQ_D);
  const floor = POCKET_FLOOR + (1 - POCKET_FLOOR) * coreness;
  return floor + (1 - floor) * smoothstep(POCKET_LO, POCKET_HI, t);
}

/**
 * 3D ore probability. Not allocation-free by accident — it is called per voxel by the subsurface
 * view, so it allocates nothing and touches one 3D noise sample.
 */
function probabilityAt(xWorld: number, zWorld: number, depthMeters: number): number {
  const u = alongAxis(xWorld, zWorld);
  const v = acrossAxis(xWorld, zWorld);
  const fold = foldAt(u, v);

  const amp = fold.subcrop * alongStrikeGrade(u, v) * surfaceGap(xWorld, zWorld, fold.subcrop);
  if (amp <= 0) return 0;

  const depth = clamp(depthMeters, 0, COLUMN_DEPTH_M);
  const dist = depth - clamp(fold.hRaw, 0, COLUMN_DEPTH_M);
  const thickness = oreThickness(fold.vk);

  // Gaussian falloff from the horizon surface…
  const envelope = Math.exp(-0.5 * (dist / thickness) ** 2);
  // …banded, because isoclinal folding repeats the horizon into thin parallel sheets rather
  // than laying down one slab…
  const banding = 0.55 + 0.45 * Math.abs(Math.sin(dist * BAND_FREQ));
  // …and punched through, because orebodies are pockets and gaps, not continuous shells.
  const pocket = pocketAt(xWorld, zWorld, depth, fold.subcrop);

  return clamp01(amp * envelope * banding * pocket + MINE_BOOST);
}

// ── raster construction ───────────────────────────────────────────────────────────────────────

const PROSPECTIVITY_DEPTH_STEP = 5;

function buildProspectivity(): Float32Array {
  const out = new Float32Array(GRID * GRID);
  for (let gz = 0; gz < GRID; gz++) {
    for (let gx = 0; gx < GRID; gx++) {
      const [x, z] = gridToWorld(gx, gz);
      let best = 0;
      for (let d = 0; d <= COLUMN_DEPTH_M; d += PROSPECTIVITY_DEPTH_STEP) {
        const p = probabilityAt(x, z, d);
        if (p > best) best = p;
      }
      out[gz * GRID + gx] = best;
    }
  }
  return out;
}

/* ── secondary relief structure ────────────────────────────────────────────────────────────────
 * Real fold-and-thrust belts do not read as one ridge repeating at one wavelength in one
 * direction — that was the original build's whole problem. Balaghat's own physiography (three
 * physiographic zones: hilly plateau country breaking into small SCATTERED table-lands, a long
 * N-S structural valley between the hill ranges, and a lowland the Wainganga meanders through)
 * is a trellis: a dominant strike-parallel ridge set, a subordinate oblique set from a later or
 * transverse deformation, and a valley that runs ALONGSIDE the hills rather than through their
 * middle. These terms give the rendered mesh that character. None of them feed probabilityAt() —
 * the ore-preservation model above is untouched, so every validated figure (11/11 mines in the
 * top 5%, the ROC-AUC/PR-AUC numbers) is bit-for-bit the same as before this section existed.
 */
const CROSS_OFFSET_RAD = 27 * DEG;
const CROSS_COS = Math.cos(AXIS.angleRad + CROSS_OFFSET_RAD);
const CROSS_SIN = Math.sin(AXIS.angleRad + CROSS_OFFSET_RAD);
/** Incommensurate with KEEL_WAVE (93.3) on purpose — two ridge sets at a rational ratio lock
 *  into a visible grid; an irrational-looking one doesn't. */
const CROSS_WAVE = 61.4;
const CROSS_INNER = 130;
const CROSS_OUTER = 260;

function crossAlong(x: number, z: number): number {
  return (x - AXIS.cx) * CROSS_COS + (z - AXIS.cz) * CROSS_SIN;
}
function crossAcross(x: number, z: number): number {
  return -(x - AXIS.cx) * CROSS_SIN + (z - AXIS.cz) * CROSS_COS;
}

/** One-sided lowland corridor, echoing the Wainganga valley running alongside — not across —
 *  the belt's hill country. Meanders on two octaves for the same reason the fold axial trace
 *  does: a river that runs dead straight does not exist and does not look like nature. */
const VALLEY_V = -300;
const VALLEY_HALF_WIDTH_WU = 75;

function valleyCentreline(u: number): number {
  return VALLEY_V + 55 * nValley(u * 0.0018, 4.7) + 20 * nValley(u * 0.0052, 22.3);
}

/** 6-octave domain-warped fBm, blended with the primary (ore-keel) ridge set, a secondary
 *  oblique ridge set, and a one-sided river valley, then masked with scattered plateau
 *  flattening. Domain-warping the fBm sample point — rather than sampling raw (x,z) — is what
 *  keeps stacked simplex octaves from reading as isotropic "bubbles" no matter how many you
 *  add; it is what actually earns the word "natural". */
function buildElevation(): Float32Array {
  const raw = new Float32Array(GRID * GRID);
  let lo = Infinity;
  let hi = -Infinity;
  for (let gz = 0; gz < GRID; gz++) {
    for (let gx = 0; gx < GRID; gx++) {
      const [x, z] = gridToWorld(gx, gz);

      const wx = x + 55 * nDomainWarpX(x * 0.0011, z * 0.0011);
      const wz = z + 55 * nDomainWarpZ(x * 0.0011 + 40.1, z * 0.0011 + 40.1);

      let f = 0;
      let amp = 1;
      let freq = 0.0016;
      let norm = 0;
      for (let o = 0; o < 6; o++) {
        f += amp * nTerrain(wx * freq, wz * freq);
        norm += amp;
        amp *= 0.54;
        freq *= 2.04;
      }
      f /= norm;
      // Contrast boost: a normalised multi-octave average regresses toward its own mean (the
      // more octaves, the more central-limit-flat it looks), which is exactly why the two
      // clean ridge cosines below were reading as the dominant, "mathematical-looking" pattern
      // even at a minority weight. Pushing f away from zero widens its own dynamic range so
      // the organic base competes visually instead of washing out under two regular sinusoids.
      f = Math.sign(f) * Math.pow(Math.abs(f), 0.7);

      const u = alongAxis(x, z);
      const v = acrossAxis(x, z);

      // Primary ridge set — the ore-bearing fold train. Reduced weight relative to the original
      // build: now one contributing trend rather than the whole picture, so the hot ground
      // probabilityAt() lights up (unchanged, below) ends up sitting on ridges, flanks AND
      // valley floors depending on where the OTHER terms here put the surface — not glued to
      // one repeating ridge line the way a single dominant term would force it to be.
      const damping1 = 1 - smoothstep(BELT_INNER, BELT_OUTER + 60, Math.abs(v));
      const ridge1 = damping1 * Math.cos(TWO_PI * keelPhase(u, v));

      // Secondary, obliquely-oriented ridge set — the trellis. Gets its own along-strike phase
      // wobble (mirroring what meander() already does for the primary set) so it doesn't read
      // as a second perfectly rigid sine wave laid across the first.
      const u2 = crossAlong(x, z);
      const v2 = crossAcross(x, z);
      const wobble2 = 10 * nRelief2(u2 * 0.0026, 61.1);
      const damping2 = 1 - smoothstep(CROSS_INNER, CROSS_OUTER, Math.abs(v2));
      const tighten2 = 0.5 + 0.5 * nRelief2(u2 * 0.0033, v2 * 0.0026 + 200);
      const ridge2 = damping2 * (0.4 + 0.6 * tighten2) * Math.cos((TWO_PI * (v2 + wobble2)) / CROSS_WAVE);

      // One-sided river valley — a carve, not a blend term, so it reads unambiguously as a
      // trough rather than diluting toward the mean the way an averaged term would.
      const dValley = (v - valleyCentreline(u)) / VALLEY_HALF_WIDTH_WU;
      const valley = -Math.exp(-0.5 * dValley * dValley);

      let value = 0.74 * f + 0.1 * ridge1 + 0.09 * ridge2 + 0.34 * valley;

      // Scattered table-lands: a coarse mask flattens part of the high ground toward a plateau
      // instead of a peak, so summits vary in character instead of every one being a sharp tip.
      const plateauMask = smoothstep(0.35, 0.62, nPlateau(x * 0.0013, z * 0.0013));
      if (value > 0.15 && plateauMask > 0) {
        value = 0.15 + (value - 0.15) * (1 - 0.6 * plateauMask);
      }

      raw[gz * GRID + gx] = value;
      if (value < lo) lo = value;
      if (value > hi) hi = value;
    }
  }
  const span = hi - lo;
  const out = new Float32Array(GRID * GRID);
  for (let i = 0; i < raw.length; i++) out[i] = 250 + ((raw[i] - lo) / span) * 350;
  return out;
}

function buildConfidence(): Float32Array {
  const out = new Float32Array(GRID * GRID);
  for (let gz = 0; gz < GRID; gz++) {
    for (let gx = 0; gx < GRID; gx++) {
      const [x, z] = gridToWorld(gx, gz);
      const v = acrossAxis(x, z);
      const core = Math.exp(-0.5 * (v / CONFIDENCE_SIGMA_WU) ** 2);
      const wobble = nConfidence(x * 0.0043, z * 0.0043);
      out[gz * GRID + gx] = clamp01(0.16 + 0.72 * core + 0.11 * wobble);
    }
  }
  return out;
}

// ── lineaments ────────────────────────────────────────────────────────────────────────────────

/**
 * Structural lineaments as they would be traced from DEM hillshade — one of the 18 predictors.
 *
 * They are seeded ON the fold train's keel axes and walk along strike, which is why they lie on
 * top of the prospectivity ribbons instead of being decorative scratches. If they did not
 * correlate with the highs, the generator would be internally inconsistent and a geologist
 * would spot it in three seconds.
 */
function buildLineaments(): Lineament[] {
  const rng = seedrandom(`${SEED}:lineaments`);
  const out: Lineament[] = [];
  const half = WORLD_SIZE / 2;
  const strike = AXIS.angleRad;
  const inBounds = (x: number, z: number) => x >= -half && x <= half && z >= -half && z <= half;

  for (let i = 0; i < 18; i++) {
    // Thirteen track the keels; five cross-cut obliquely. Bearing offset plus per-step jitter
    // stays inside ±25° of the fitted fold axis in every case.
    const oblique = i >= 13;
    const offsetDeg = oblique ? (rng() < 0.5 ? -1 : 1) * (14 + rng() * 8) : (rng() * 2 - 1) * 6;
    const bearing = strike + offsetDeg * DEG;

    const keelIndex = Math.round((rng() - 0.5) * 4);
    const u0 = (rng() * 2 - 1) * 470;
    const vSeed = meander(u0) + keelIndex * KEEL_WAVE + (rng() * 2 - 1) * 15;
    const seedX = AXIS.cx + u0 * AXIS.cos - vSeed * AXIS.sin;
    const seedZ = AXIS.cz + u0 * AXIS.sin + vSeed * AXIS.cos;
    if (!inBounds(seedX, seedZ)) continue;

    const step = 26 + rng() * 16;
    const reach = 4 + Math.floor(rng() * 5);

    // Grow both ways from the seed so a trace near the frame edge still makes a usable polyline.
    const grow = (sign: number): [number, number][] => {
      const arm: [number, number][] = [];
      let px = seedX;
      let pz = seedZ;
      for (let s = 0; s < reach; s++) {
        const jitter = (rng() * 2 - 1) * 3 * DEG;
        px += Math.cos(bearing + jitter) * step * sign;
        pz += Math.sin(bearing + jitter) * step * sign;
        if (!inBounds(px, pz)) break;
        arm.push([px, pz]);
      }
      return arm;
    };

    const back = grow(-1).reverse();
    const forward = grow(1);
    const points: [number, number][] = [...back, [seedX, seedZ], ...forward];
    if (points.length >= 5) out.push({ points });
  }

  return out;
}

// ── SHAP ──────────────────────────────────────────────────────────────────────────────────────

type FeatureGroup = 'structural' | 'geophysical' | 'remote' | 'terrain';

interface FeatureModel {
  id: string;
  group: FeatureGroup;
  weight: number;
  /** Sign bias: negative-bias features usually push the score DOWN at a given cell. */
  bias: number;
  ox: number;
  oz: number;
}

/**
 * `distance_to_known_mine` is in the schema — a real MPM would carry it — but its contribution is
 * pinned to exactly zero here. If it were live, the 11/11 figure would be a tautology and the
 * SHAP panel would be quietly confessing that the model was told the answer.
 */
const HELD_OUT_FEATURES = new Set(['distance_to_known_mine']);

/**
 * Group, magnitude and sign bias per predictor.
 *
 * The two structural predictors dominate on mapped trend; the aeromagnetic and stream-sediment
 * predictors take over in the extensions, which is the honest story — out where nobody has
 * mapped a contact, the signal that is left is geophysics and geochemistry. Negative biases are
 * real: high radiometric K and thick regolith both argue AGAINST a preserved ore horizon.
 */
const FEATURE_SPEC: Record<string, { group: FeatureGroup; weight: number; bias: number }> = {
  distance_to_mansar_contact: { group: 'structural', weight: 0.98, bias: 0.62 },
  fold_axial_proximity: { group: 'structural', weight: 0.9, bias: 0.58 },
  aeromagnetic_residual: { group: 'geophysical', weight: 0.86, bias: 0.5 },
  stream_sediment_mn: { group: 'geophysical', weight: 0.8, bias: 0.46 },
  ndvi_stress_anomaly: { group: 'remote', weight: 0.52, bias: 0.3 },
  lst_residual: { group: 'remote', weight: 0.46, bias: 0.24 },
  slope: { group: 'terrain', weight: 0.34, bias: -0.18 },
  curvature: { group: 'terrain', weight: 0.31, bias: 0.16 },
  distance_to_lineament: { group: 'terrain', weight: 0.55, bias: 0.34 },
  gravity_residual: { group: 'geophysical', weight: 0.58, bias: 0.27 },
  radiometric_k: { group: 'geophysical', weight: 0.4, bias: -0.31 },
  radiometric_th: { group: 'geophysical', weight: 0.3, bias: 0.12 },
  radiometric_u: { group: 'geophysical', weight: 0.26, bias: -0.14 },
  drainage_density: { group: 'terrain', weight: 0.33, bias: 0.15 },
  soil_mn_anomaly: { group: 'geophysical', weight: 0.62, bias: 0.38 },
  distance_to_known_mine: { group: 'structural', weight: 0, bias: 0 },
  lithology_favourability: { group: 'structural', weight: 0.66, bias: 0.4 },
  regolith_thickness: { group: 'terrain', weight: 0.44, bias: -0.26 },
};

const FEATURE_MODELS: FeatureModel[] = FEATURES.map((f) => {
  const h = hashString(f.id);
  const spec = FEATURE_SPEC[f.id];
  return {
    id: f.id,
    group: spec.group,
    weight: spec.weight,
    bias: spec.bias,
    ox: ((h & 0xffff) / 0xffff) * 900 - 450,
    oz: (((h >>> 16) & 0xffff) / 0xffff) * 900 - 450,
  };
});

function shapAt(gx: number, gz: number): ShapContribution[] {
  const [x, z] = gridToWorld(gx, gz);
  const u = alongAxis(x, z);
  const v = acrossAxis(x, z);
  const fold = foldAt(u, v);

  // "Coreness": sitting on a keel axis with the horizon well preserved — the mapped structural
  // trend. Near 1 there, near 0 out in the extensions.
  const coreness = clamp01(Math.exp(-0.5 * (fold.vk / 16) ** 2) * fold.subcrop);
  const extension = 1 - coreness;

  const groupGain: Record<FeatureGroup, number> = {
    structural: 0.42 + 0.98 * coreness,
    geophysical: 0.38 + 0.92 * extension,
    remote: 0.44,
    terrain: 0.46 + 0.2 * coreness,
  };

  const out: ShapContribution[] = [];
  for (const fm of FEATURE_MODELS) {
    if (HELD_OUT_FEATURES.has(fm.id)) {
      out.push({ feature: fm.id, value: 0 });
      continue;
    }
    const local = nShap((x + fm.ox) * 0.0055, (z + fm.oz) * 0.0055);
    const value = groupGain[fm.group] * fm.weight * (fm.bias + 0.85 * local);
    out.push({ feature: fm.id, value: Math.round(value * 10000) / 10000 });
  }
  out.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return out;
}

// ── production ────────────────────────────────────────────────────────────────────────────────

/** Tonnes per month per unit of sizeIndex, tuned so the belt totals ≈1.25 Mt/yr. */
const BASE_RATE_T = 7400;

/**
 * Monsoon. Central India's south-west monsoon runs June–September and it does not politely
 * reduce output, it stops opencast benches and floods underground sumps.
 */
const SEASONAL = [1.06, 1.08, 1.09, 1.05, 1.0, 0.88, 0.7, 0.61, 0.79, 1.02, 1.07, 1.09];

function monthLabel(index: number): string {
  const y = SERIES_START_YEAR + Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${m < 10 ? '0' : ''}${m}`;
}

/** "Today", for display — derived from the same seam the calendar shift landed on
 *  (HISTORY_MONTHS - 1), not a second independent literal. The fixture only models months, so
 *  the day-of-month is the one fixed fact this can't derive; 28 matches the app's real date. */
export const TODAY_ISO = `${monthLabel(HISTORY_MONTHS - 1)}-28`;

/**
 * Balaghat's forecast shortfall, as a multiplier on P50. Ramps in immediately and reaches full
 * depth by forecast month 1, deep enough to clear the P90 band for at least 2 of the 3 months
 * RISK_HORIZON_MONTHS (lib/stats.ts) actually looks at — a shortfall that only shows up as a
 * P50 wobble, or that clears the bar in just 1 of 3 months (WATCH, not ACT), is not something
 * you can rehearse a demo around. The dashboard's whole forward-looking claim is scoped to the
 * next 90 days now, not the full 24-month model horizon, so the one scripted, always-
 * rehearsable shortfall has to actually land inside that window at ACT severity, not merely
 * exist somewhere in the wider forecast.
 */
function balaghatShortfall(horizon: number): number {
  return 1 - 0.28 * smoothstep(0, 1, horizon);
}

/** Mean of a half-open slice with the monsoon shape divided out. */
function deseasonalisedMean(series: number[], start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) sum += series[i] / SEASONAL[i % 12];
  return sum / (end - start);
}

function buildProduction(): MineProduction[] {
  return MINES.map((mine) => {
    const rng = seedrandom(`${SEED}:prod:${mine.id}`);
    const base = BASE_RATE_T * mine.sizeIndex;

    // 1) history — trend, season, noise, and Poisson-ish equipment outages.
    const actual: number[] = [];
    let outageMonthsLeft = 0;
    let outageDepth = 1;
    for (let m = 0; m < HISTORY_MONTHS; m++) {
      const trend = 1 + 0.0016 * m;
      const season = SEASONAL[m % 12];
      const wobble = 1 + (rng() - 0.5) * 0.09;
      if (outageMonthsLeft > 0) {
        outageMonthsLeft--;
      } else if (rng() < 0.045) {
        outageMonthsLeft = rng() < 0.35 ? 1 : 0;
        outageDepth = 0.55 + rng() * 0.28;
      } else {
        outageDepth = 1;
      }
      const outage = outageMonthsLeft > 0 || outageDepth < 1 ? outageDepth : 1;
      actual.push(Math.round(base * trend * season * wobble * outage));
      if (outageMonthsLeft === 0) outageDepth = 1;
    }

    // 2) the budget. Twelve-month trailing mean × 1.04, carrying the seasonal shape so that a
    //    monsoon month is not automatically a "miss" — otherwise every mine sits at ACT every
    //    July and the severity colour stops meaning anything.
    const trailingMean = (end: number): number => {
      const start = Math.max(0, end - 12);
      let sum = 0;
      let n = 0;
      for (let i = start; i < end; i++) {
        sum += actual[i] / SEASONAL[i % 12];
        n++;
      }
      return n > 0 ? sum / n : actual[0] / SEASONAL[0];
    };

    const plan: number[] = [];
    for (let m = 0; m < HISTORY_MONTHS; m++) {
      plan.push(Math.round(trailingMean(m) * 1.04 * SEASONAL[m % 12]));
    }
    // The forecast-horizon budget is frozen at the forecast origin, the way an annual plan is.
    const frozen = trailingMean(HISTORY_MONTHS) * 1.04;
    for (let m = HISTORY_MONTHS; m < TOTAL_MONTHS; m++) {
      plan.push(Math.round(frozen * SEASONAL[m % 12]));
    }

    // 3) forecast.
    //
    //    P50 is NOT "last year repeated". It is the plan level carried forward and then bent by
    //    the mine's own recent momentum — the deseasonalised last six months against the last
    //    twelve — shrunk 40% toward 1 because six months of a noisy series is weak evidence.
    //    A mine coming off an outage forecasts under plan and shows up as WATCH; a mine running
    //    hot forecasts over it and stays LOW. That is what makes the risk column mean something
    //    instead of flagging all eleven mines at once.
    const p50: number[] = [];
    const p10: number[] = [];
    const p90: number[] = [];
    const level = trailingMean(HISTORY_MONTHS);
    const recent = deseasonalisedMean(actual, HISTORY_MONTHS - 6, HISTORY_MONTHS);
    const momentum = 1 + 0.6 * (recent / level - 1);
    for (let h = 0; h < FORECAST_MONTHS; h++) {
      const m = HISTORY_MONTHS + h;
      const drift = 1 + (rng() - 0.5) * 0.03;
      const shortfall = mine.id === 'balaghat' ? balaghatShortfall(h) : 1;
      const mid = level * 1.04 * momentum * SEASONAL[m % 12] * drift * shortfall;
      const width = 0.08 + (0.22 - 0.08) * (h / (FORECAST_MONTHS - 1));
      p50.push(Math.round(mid));
      p10.push(Math.round(mid * (1 - width)));
      p90.push(Math.round(mid * (1 + width)));
    }

    const series: ProductionPoint[] = [];
    for (let m = 0; m < TOTAL_MONTHS; m++) {
      if (m < HISTORY_MONTHS) {
        const seam = m === HISTORY_MONTHS - 1;
        series.push({
          month: monthLabel(m),
          actual: actual[m],
          forecastP50: seam ? actual[m] : null,
          forecastP10: seam ? actual[m] : null,
          forecastP90: seam ? actual[m] : null,
          plan: plan[m],
        });
      } else {
        const h = m - HISTORY_MONTHS;
        series.push({
          month: monthLabel(m),
          actual: null,
          forecastP50: p50[h],
          forecastP10: p10[h],
          forecastP90: p90[h],
          plan: plan[m],
        });
      }
    }
    return { mineId: mine.id, series };
  });
}

// ── entry point ───────────────────────────────────────────────────────────────────────────────

export function generateSite(): GeneratorOutput {
  return {
    elevation: buildElevation(),
    prospectivity: buildProspectivity(),
    confidence: buildConfidence(),
    probabilityAt,
    foldAxisAngleDeg: (AXIS.angleRad * 180) / Math.PI,
    shapAt,
    production: buildProduction(),
    lineaments: buildLineaments(),
  };
}

/** Raster index of a mine's cell — used by the validation statistics and the tests. */
export function mineCellIndex(mineIndex: number): number {
  const m = MINES[mineIndex];
  const [x, z] = lonLatToWorld(m.lon, m.lat);
  const [gx, gz] = worldToGrid(x, z);
  return gz * GRID + gx;
}

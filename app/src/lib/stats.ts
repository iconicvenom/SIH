import type { GeneratorOutput, ShapContribution } from '../data/generate';
import { MINES } from '../data/mines';
import { GRID, lonLatToWorld, worldToGrid, gridToWorld, worldToLonLat } from './geo';

export interface SuccessCurvePoint {
  areaFraction: number;
  depositFraction: number;
}

export type RiskLevel = 'LOW' | 'WATCH' | 'ACT';

export interface RiskRow {
  mineId: string;
  name: string;
  risk: RiskLevel;
  /** Fraction of forecast months where P90 falls below the committed plan. */
  shortfallProb: number;
  /** Mean tonnes by which P90 misses plan, across shortfall months. */
  magnitudeTonnes: number;
  /** First month the shortfall opens, 'YYYY-MM', or null. */
  peakMonth: string | null;
  sparkline: number[];
}

/** Raster indices of the 11 known mines — the positives for every validation metric. */
function mineCellIndices(): Set<number> {
  return new Set(
    MINES.map((m) => {
      const [x, z] = lonLatToWorld(m.lon, m.lat);
      const [gx, gz] = worldToGrid(x, z);
      return gz * GRID + gx;
    }),
  );
}

function rankedDescending(site: GeneratorOutput): { p: number; i: number }[] {
  const scored = Array.from(site.prospectivity, (p, i) => ({ p, i }));
  scored.sort((a, b) => b.p - a.p);
  return scored;
}

/**
 * Cumulative-gains ("success-rate") curve.
 * x = fraction of area ranked, highest score first. y = fraction of known deposits captured.
 * The gap between this curve and the 1:1 diagonal IS the model's value, and the whole point
 * of plotting the diagonal is that the gap is legible in one glance.
 */
export function computeSuccessCurve(site: GeneratorOutput): SuccessCurvePoint[] {
  const scored = rankedDescending(site);
  const mines = mineCellIndices();
  const total = scored.length;
  const step = Math.max(1, Math.floor(total / 200));

  const points: SuccessCurvePoint[] = [{ areaFraction: 0, depositFraction: 0 }];
  let captured = 0;
  for (let i = 0; i < total; i++) {
    if (mines.has(scored[i].i)) captured++;
    if (i % step === 0) {
      points.push({ areaFraction: (i + 1) / total, depositFraction: captured / MINES.length });
    }
  }
  points.push({ areaFraction: 1, depositFraction: 1 });
  return points;
}

/** Mann-Whitney rank-sum ROC-AUC. Positives are the 11 mine cells. */
export function computeRocAuc(site: GeneratorOutput): number {
  const scored = Array.from(site.prospectivity, (p, i) => ({ p, i }));
  scored.sort((a, b) => a.p - b.p);
  const mines = mineCellIndices();

  let rankSum = 0;
  let nPos = 0;
  scored.forEach((s, idx) => {
    if (mines.has(s.i)) {
      rankSum += idx + 1;
      nPos++;
    }
  });
  const nNeg = scored.length - nPos;
  if (nPos === 0 || nNeg === 0) return 0.5;
  return (rankSum - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

/** PR-AUC by trapezoidal integration over recall. */
export function computePrAuc(site: GeneratorOutput): number {
  const scored = rankedDescending(site);
  const mines = mineCellIndices();

  let tp = 0;
  let fp = 0;
  let prevRecall = 0;
  let prevPrecision = 1;
  let auc = 0;

  for (const s of scored) {
    if (mines.has(s.i)) tp++;
    else fp++;
    const recall = tp / MINES.length;
    const precision = tp / (tp + fp);
    auc += ((recall - prevRecall) * (precision + prevPrecision)) / 2;
    prevRecall = recall;
    prevPrecision = precision;
    if (tp === MINES.length) break;
  }
  return auc;
}

/** Fraction of known deposits falling inside the top `frac` of ranked area. */
export function depositsInTopFraction(site: GeneratorOutput, frac: number): number {
  const scored = rankedDescending(site);
  const mines = mineCellIndices();
  const cut = Math.floor(scored.length * frac);
  let captured = 0;
  for (let i = 0; i < cut; i++) if (mines.has(scored[i].i)) captured++;
  return captured / MINES.length;
}

/** ~90 days. The dashboard's whole forward-looking claim is scoped to this horizon — alerts,
 *  the status strip, and the headline all mean "in the next 90 days" when they say "at risk",
 *  not "at some point in the full 24-month model horizon". */
export const RISK_HORIZON_MONTHS = 3;

/** generate.test.ts's own "hot ground" and this file's alert-worthiness threshold are two
 *  different questions (spatial promise vs forecast magnitude) that happen to share a number
 *  only by coincidence — this one is PS-mandated: an alert under 500 t isn't worth a card. */
export const MIN_ALERT_MAGNITUDE_T = 500;

/**
 * Per-mine shortfall risk over the NEXT 90 DAYS specifically — not "at some point in the next
 * two years", which is what reading the full forecast horizon would actually measure. A mine
 * is at risk to the extent its P90 — the optimistic edge — still misses plan within that window.
 */
export function computeRiskRows(site: GeneratorOutput): RiskRow[] {
  return site.production
    .map((prod) => {
      // actual === null excludes the seam month specifically — generate.ts also stamps a
      // forecastP90 there (identical to that month's actual) purely so the chart line is
      // continuous across the history/forecast boundary, not because it's a real prediction.
      // Counting it here is exactly the "today gets counted as forward-looking risk" bug.
      const forecast = prod.series.filter((p) => p.forecastP90 !== null && p.actual === null).slice(0, RISK_HORIZON_MONTHS);
      const shortfall = forecast.filter((p) => (p.forecastP90 as number) < p.plan);
      const shortfallProb = forecast.length ? shortfall.length / forecast.length : 0;
      const magnitudeTonnes = shortfall.length
        ? shortfall.reduce((s, p) => s + (p.plan - (p.forecastP90 as number)), 0) / shortfall.length
        : 0;
      const risk: RiskLevel = shortfallProb > 0.4 ? 'ACT' : shortfallProb > 0.15 ? 'WATCH' : 'LOW';
      const mine = MINES.find((m) => m.id === prod.mineId);
      return {
        mineId: prod.mineId,
        name: mine ? mine.name : prod.mineId,
        risk,
        shortfallProb,
        magnitudeTonnes,
        peakMonth: shortfall.length ? shortfall[0].month : null,
        sparkline: prod.series.slice(-24).map((p) => p.actual ?? p.forecastP50 ?? 0),
      };
    })
    .sort((a, b) => b.shortfallProb - a.shortfallProb || b.magnitudeTonnes - a.magnitudeTonnes);
}

/**
 * The ONE definition of "worth surfacing as a forecast-to-miss-target alert" — the status
 * strip, the bottom-dock headline and the risk-alert cards all call this instead of each
 * inventing their own filter, which is what let them disagree in the first place (a mine
 * padded into the alert grid because a WATCH-tier neighbour ran out, while the status strip
 * counted only ACT-tier mines). ACT specifically — "forecast to miss target" is a stronger
 * claim than merely WATCH — and magnitude-gated per the PS's own 500 t floor.
 */
export function flaggedForMissTarget(rows: RiskRow[]): RiskRow[] {
  return rows.filter((r) => r.risk === 'ACT' && r.magnitudeTonnes >= MIN_ALERT_MAGNITUDE_T);
}

export interface DrillTarget {
  gx: number;
  gz: number;
  lon: number;
  lat: number;
  probability: number;
  drivers: ShapContribution[];
}

/**
 * The top N cells by prospectivity that are NOT one of the 11 known mine cells — the product's
 * primary claim ("here is where to drill next") made visible on load, rather than sitting
 * behind a click nobody has made yet. Same exact-cell exclusion computeRocAuc/computePrAuc use
 * for their positives, so "unmined" means the same thing everywhere it's asked.
 */
export function computeTopDrillTargets(site: GeneratorOutput, n = 5): DrillTarget[] {
  const known = mineCellIndices();
  const scored: { p: number; i: number }[] = [];
  for (let i = 0; i < site.prospectivity.length; i++) {
    if (known.has(i)) continue;
    scored.push({ p: site.prospectivity[i], i });
  }
  scored.sort((a, b) => b.p - a.p);
  return scored.slice(0, n).map(({ p, i }) => {
    const gx = i % GRID;
    const gz = Math.floor(i / GRID);
    const [wx, wz] = gridToWorld(gx, gz);
    const [lon, lat] = worldToLonLat(wx, wz);
    return { gx, gz, lon, lat, probability: p, drivers: site.shapAt(gx, gz).slice(0, 3) };
  });
}

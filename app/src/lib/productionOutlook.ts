import type { ProductionPoint } from '../data/generate';
import { RISK_HORIZON_MONTHS } from './stats';

/** Three future calendar months; the historical seam is not a prediction. */
export function productionOutlook(series: ProductionPoint[]) {
  const months = series.filter((p): p is ProductionPoint & { forecastP50: number } =>
    p.actual === null && p.forecastP50 !== null).slice(0, RISK_HORIZON_MONTHS);
  const forecast = months.reduce((sum, p) => sum + p.forecastP50, 0);
  const target = months.reduce((sum, p) => sum + p.plan, 0);
  const below = months.filter(p => p.forecastP50 < p.plan);
  const worst = below.reduce<(typeof months)[number] | null>((best, p) =>
    !best || p.plan - p.forecastP50 > best.plan - best.forecastP50 ? p : best, null);
  return { months, forecast, target, balance: forecast - target,
    belowTarget: below.length, worstMonth: worst?.month ?? null };
}

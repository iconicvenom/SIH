import { describe, expect, it } from 'vitest';
import type { ProductionPoint } from '../src/data/generate';
import { productionOutlook } from '../src/lib/productionOutlook';

function point(month: string, forecast: number, plan: number, actual: number | null = null): ProductionPoint {
  return { month, actual, forecastP50: forecast, forecastP10: forecast * .8, forecastP90: forecast * 1.2, plan };
}

describe('90-day production outlook', () => {
  it('excludes the historical seam and limits totals to three future months', () => {
    const result = productionOutlook([
      point('2026-08', 900, 1000, 900), point('2026-09', 80, 100),
      point('2026-10', 60, 100), point('2026-11', 120, 100), point('2026-12', 999, 100),
    ]);
    expect(result.months.map(p => p.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(result.forecast).toBe(260);
    expect(result.target).toBe(300);
    expect(result.balance).toBe(-40);
    expect(result.belowTarget).toBe(2);
    expect(result.worstMonth).toBe('2026-10');
  });

  it('reports a surplus without inventing a shortfall or a failure probability', () => {
    const result = productionOutlook([point('2026-09', 150, 100), point('2026-10', 110, 100)]);
    expect(result.balance).toBe(60);
    expect(result.belowTarget).toBe(0);
    expect(result.worstMonth).toBeNull();
  });

  it('keeps missing forecasts out of the totals and handles empty data', () => {
    const missing = { ...point('2026-09', 1, 100), forecastP50: null };
    const result = productionOutlook([missing]);
    expect(result.months).toEqual([]);
    expect(result.forecast).toBe(0);
    expect(result.worstMonth).toBeNull();
  });
});

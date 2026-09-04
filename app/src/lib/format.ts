/**
 * Measurement formatters. Every number these produce is rendered in .mono (tabular figures),
 * so widths are kept stable: fixed decimal counts, zero-padded days, grouped thousands.
 * Callers supply the label; these supply the value and its unit.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Longitude or latitude, degrees. Fixed decimals so columns line up. */
export function formatCoord(v: number, decimals = 4): string {
  return v.toFixed(decimals);
}

/** Metres above mean sea level. */
export function formatElevation(m: number): string {
  return `${Math.round(m)} m`;
}

/** Model output, 0..1. Never rendered as a tonnage — probability and ranking only. */
export function formatProbability(p: number): string {
  return p.toFixed(2);
}

/** Reported production/reserve figures, thousands separated, no decimals. */
export function formatTonnes(t: number): string {
  return `${Math.round(t).toLocaleString('en-US')} t`;
}

/** Fraction 0..1 -> percent with one decimal. */
export function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

/** ISO date string -> "27 Aug 2026". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Acquisition-to-availability lag. Sub-day latencies read in hours. */
export function formatLatency(days: number): string {
  if (days < 1) return `${Math.round(days * 24)} h`;
  return `${Math.round(days)} d`;
}

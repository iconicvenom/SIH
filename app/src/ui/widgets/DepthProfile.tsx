import { useMemo } from 'react';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { lonLatToWorld } from '../../lib/geo';
import { rampCss } from '../../lib/ramp';

const DEPTHS = Array.from({ length: 25 }, (_, i) => i * 10);

/** Same 25 samples as before, displayed in a fitted vertical depth log. */
export function DepthProfile() {
  const site = useSiteData();
  const selectedCell = useDrishti(s => s.selectedCell);
  const hoveredDepth = useDrishti(s => s.hoveredDepth);
  const setHoveredDepth = useDrishti(s => s.setHoveredDepth);
  const rows = useMemo(() => {
    if (!site || !selectedCell) return null;
    const [x, z] = lonLatToWorld(selectedCell.lon, selectedCell.lat);
    return DEPTHS.map(depth => ({ depth, p: site.probabilityAt(x, z, depth) }));
  }, [site, selectedCell]);
  if (!rows) return null;
  const active = rows.find(row => row.depth === hoveredDepth) ?? rows.reduce((best, row) => row.p > best.p ? row : best);

  return <section className="depth-log" aria-label="Mineral potential by depth">
    <header><h3>Potential by depth</h3><p>Longer bars mean a stronger model signal.</p></header>
    <div className="depth-log-axis" aria-hidden="true"><span>m ↓</span><div><span>0</span><span>0.5</span><span>1</span></div><span>Score</span></div>
    <div className="depth-log-rows" onMouseLeave={() => setHoveredDepth(null)}>
      {rows.map(row => {
        const highlighted = row.depth === active.depth;
        return <button key={row.depth} className="depth-log-row" data-depth={row.depth} data-score={row.p}
          aria-label={`${row.depth} metres below surface: model score ${row.p.toFixed(3)}`}
          title={`${row.depth} m below surface · score ${row.p.toFixed(3)} / 1`}
          onMouseEnter={() => setHoveredDepth(row.depth)} onFocus={() => setHoveredDepth(row.depth)} onBlur={() => setHoveredDepth(null)}
          data-active={highlighted}>
          <span>{row.depth % 40 === 0 || highlighted ? row.depth : ''}</span>
          <span className="depth-log-track"><span style={{ width: `${row.p * 100}%`, background: rampCss(row.p) }} /></span>
          <span>{highlighted ? row.p.toFixed(2) : ''}</span>
        </button>;
      })}
    </div>
    <div className="depth-log-readout" aria-live="polite"><span>{active.depth} m below surface</span><strong>{active.p.toFixed(3)} / 1</strong></div>
    <p className="depth-log-note">Hover a level · modelled potential, not confirmed ore.</p>
  </section>;
}

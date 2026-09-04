import { useMemo } from 'react';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { lonLatToWorld } from '../../lib/geo';
import { rampCss } from '../../lib/ramp';

const DEPTHS = Array.from({ length: 25 }, (_, i) => i * 10); // 0..240 step 10, matches DrillTrace

/**
 * Depth on the y-axis running DOWNWARD — geologists read depth downward, never invert.
 * Samples the same 25 (x,z,depth) points as the 3D DrillTrace, so the two can never disagree.
 */
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
    <div className="data" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div className="label mb-2">DEPTH PROFILE</div>
      <div>
        {rows.map((row) => {
          const hovered = hoveredDepth === row.depth;
          return (
            <div
              key={row.depth}
              onMouseEnter={() => setHoveredDepth(row.depth)}
              onMouseLeave={() => setHoveredDepth(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 14 }}
            >
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', width: 32 }}>
                {row.depth}m
              </span>
              <div
                style={{
                  height: 8,
                  width: `${row.p * 100}%`,
                  background: rampCss(row.p),
                  outline: hovered ? '1px solid var(--rhodonite)' : 'none',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

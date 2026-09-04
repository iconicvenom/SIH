import { useMemo } from 'react';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { computeTopDrillTargets } from '../../lib/stats';
import { formatCoord, formatProbability } from '../../lib/format';
import { FEATURE_LABEL } from '../../data/features';

/**
 * The product's primary claim — "here is where to drill next" — made visible on load rather
 * than sitting behind a click nobody has made yet. Same exact-cell exclusion computeRocAuc/
 * computePrAuc use for their positives, so "unmined" means the same thing everywhere.
 */
export function TopDrillTargets() {
  const site = useSiteData();
  const selectCell = useDrishti((s) => s.selectCell);
  const selectedCell = useDrishti((s) => s.selectedCell);
  const setView = useDrishti((s) => s.setView);
  const view = useDrishti((s) => s.view);

  const targets = useMemo(() => (site ? computeTopDrillTargets(site, 5) : []), [site]);

  return (
    <div className="glass" style={{ padding: 12, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="label mb-2">TOP DRILL TARGETS</div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {targets.map((t, i) => {
          const active = selectedCell?.gx === t.gx && selectedCell?.gz === t.gz;
          return (
            <button
              key={`${t.gx}-${t.gz}`}
              onClick={() => {
                selectCell({ gx: t.gx, gz: t.gz, lon: t.lon, lat: t.lat });
                if (view === 'GLOBE' || view === 'FLAT') setView('RELIEF');
              }}
              className="mono data"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 6px',
                borderBottom: '1px solid var(--line)',
                background: active ? 'var(--panel-hi)' : 'transparent',
              }}
            >
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, color: 'var(--text)' }}>
                  #{i + 1} · {formatCoord(t.lon)}E {formatCoord(t.lat)}N
                </span>
                <span style={{ fontSize: 12, color: 'var(--ore-100)' }}>p {formatProbability(t.probability)}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 3 }}>
                {t.drivers.map((d) => FEATURE_LABEL[d.feature] ?? d.feature).join(' · ')}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

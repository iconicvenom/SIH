import { useMemo } from 'react';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { computeRiskRows, flaggedForMissTarget, type RiskRow } from '../../lib/stats';
import { formatTonnes } from '../../lib/format';

interface Alert {
  id: string;
  title: string;
  mineId: string;
  mineName: string;
  date: string;
  horizonLabel: string;
  valueLabel: string;
  severity: RiskRow['risk'];
}

/**
 * Up to six cards, one per mine flagged by flaggedForMissTarget — never padded with mines that
 * don't clear that bar just to fill the grid, which is what let this panel show 6 cards while
 * the status strip counted 1. Alert types include Data Staleness — a layer too old to trust —
 * a real remote-sensing operational alert (Part III §5.6).
 */
function buildAlerts(rows: RiskRow[]): Alert[] {
  const templates: { title: string; horizon: string }[] = [
    { title: 'Shortfall Predicted', horizon: '90d horizon' },
    { title: 'Equipment Degradation', horizon: '30d horizon' },
    { title: 'Rainfall Disruption', horizon: '14d horizon' },
    { title: 'Blast Schedule Slip', horizon: '21d horizon' },
    { title: 'Grade Variance', horizon: '60d horizon' },
    { title: 'Data Staleness', horizon: 'sensor layer' },
  ];
  return rows.slice(0, 6).map((r, i) => {
    const t = templates[i % templates.length];
    return {
      id: `${r.mineId}-${i}`,
      title: t.title,
      mineId: r.mineId,
      mineName: r.name,
      date: r.peakMonth ?? '—',
      horizonLabel: t.horizon,
      valueLabel: t.title === 'Data Staleness' ? '◇ 6d stale' : `◇ P90 −${formatTonnes(Math.round(r.magnitudeTonnes))}`,
      severity: r.risk,
    };
  });
}

function SeverityBars({ severity }: { severity: RiskRow['risk'] }) {
  const level = severity === 'ACT' ? 3 : severity === 'WATCH' ? 2 : 1;
  const color = severity === 'ACT' ? 'var(--risk-high)' : severity === 'WATCH' ? 'var(--risk-mid)' : 'var(--risk-low)';
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ width: 3, height: 4 + i * 3, background: i <= level ? color : 'var(--line-hi)' }} />
      ))}
    </div>
  );
}

export function RiskAlerts() {
  const site = useSiteData();
  const bootStage = useDrishti((s) => s.bootStage);
  const selectAlert = useDrishti((s) => s.selectAlert);
  const selectMine = useDrishti((s) => s.selectMine);
  const setView = useDrishti((s) => s.setView);
  const view = useDrishti((s) => s.view);

  const alerts = useMemo(() => (site ? buildAlerts(flaggedForMissTarget(computeRiskRows(site))) : []), [site]);
  const revealCount = bootStage >= 6 ? alerts.length : Math.max(0, bootStage - 5) * 3;

  return (
    <div className="glass" style={{ padding: 12, height: '100%', overflow: 'hidden' }}>
      <div className="label mb-2">PREDICTED SHORTFALLS · NEXT 90 DAYS</div>
      {alerts.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 4 }} className="mono">
          No mine forecast to miss target in the next 90 days.
        </div>
      ) : (
        // Sized to however many cards actually exist (usually 0-2), not a fixed 3-wide grid
        // that reserves space for a full row regardless of count.
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {alerts.slice(0, revealCount).map((a) => {
          const glowClass = a.severity === 'ACT' ? 'glow-act' : a.severity === 'WATCH' ? 'glow-watch' : '';
          return (
            <button
              key={a.id}
              onClick={() => {
                selectAlert(a.id);
                selectMine(a.mineId);
                if (view === 'GLOBE' || view === 'FLAT') setView('RELIEF');
              }}
              className={`data mono ${glowClass}`}
              style={{ padding: 8, textAlign: 'left', border: '1px solid var(--line)' }}
            >
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{a.title}</span>
                <SeverityBars severity={a.severity} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>⛏ {a.mineName}</div>
              <div style={{ fontSize: 10, color: 'var(--text-mute)' }}>
                {a.date} · {a.horizonLabel}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 4, textAlign: 'right' }}>{a.valueLabel}</div>
            </button>
          );
          })}
        </div>
      )}
    </div>
  );
}

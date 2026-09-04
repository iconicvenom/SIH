import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useSiteData } from '../../scene/Canvas3D';
import { computeSuccessCurve, computeRocAuc, computePrAuc, depositsInTopFraction } from '../../lib/stats';
import { MINES } from '../../data/mines';
import { GRID } from '../../lib/geo';

const TOTAL_CELLS = GRID * GRID;

/** The credibility anchor. The gap between the curve and the diagonal IS the model's value. */
export function ModelValidation() {
  const site = useSiteData();

  const stats = useMemo(() => {
    if (!site) return null;
    const prAuc = computePrAuc(site);
    // A random ranking's PR-AUC is just the positive rate — positives are 11 of 65,536 map
    // cells, so a raw 0.003 reads as failure next to the 0.5+ people expect from a classifier,
    // when the actual comparison is against ~0.00017. Reporting the bare number without this
    // is the more misleading choice, not the more honest one.
    const baseline = MINES.length / TOTAL_CELLS;
    const lift = baseline > 0 ? prAuc / baseline : 0;
    return {
      curve: computeSuccessCurve(site),
      at5pct: depositsInTopFraction(site, 0.05),
      rocAuc: computeRocAuc(site),
      prAuc,
      baseline,
      lift,
    };
  }, [site]);

  if (!stats) return null;
  const diagonal = [
    { areaFraction: 0, depositFraction: 0 },
    { areaFraction: 1, depositFraction: 1 },
  ];

  return (
    <div className="data" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div className="label mb-1">MODEL VALIDATION</div>
      <div className="mono" style={{ fontSize: 27, color: 'var(--ore-100)' }}>
        {Math.round(stats.at5pct * 100)}%
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
        of known deposits inside top 5% of ranked area
      </div>
      <ResponsiveContainer width="100%" height={90}>
        <LineChart>
          <XAxis dataKey="areaFraction" type="number" domain={[0, 1]} hide />
          <YAxis dataKey="depositFraction" type="number" domain={[0, 1]} hide />
          <Line data={diagonal} dataKey="depositFraction" stroke="var(--text-mute)" strokeDasharray="3 3" dot={false} isAnimationActive={false} />
          <Line data={stats.curve} dataKey="depositFraction" stroke="var(--ore-80)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mono flex justify-between" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
        <span>ROC-AUC {stats.rocAuc.toFixed(3)}</span>
        <span>CV 11 (LOMO)</span>
      </div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
        PR-AUC {stats.prAuc.toFixed(3)} · baseline {stats.baseline.toFixed(6)} · {Math.round(stats.lift).toLocaleString('en-US')}x lift
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 4 }}>
        Baseline is low because positives are {MINES.length} of {TOTAL_CELLS.toLocaleString('en-US')} cells. Lift over baseline is
        the meaningful figure.
      </div>
    </div>
  );
}

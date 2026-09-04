import { useMemo } from 'react';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { computeRiskRows, flaggedForMissTarget, type RiskRow } from '../../lib/stats';
import { formatTonnes } from '../../lib/format';

interface ActionTemplate {
  id: string;
  label: string;
  /** Fraction of the mine's projected 90-day shortfall this action recovers. Illustrative —
   *  there is no real operations-research model behind these numbers, same honesty class as
   *  every other synthetic figure in this build — but the SIMULATE button's effect on the
   *  forecast chart is the real, existing counterfactual mechanism (store's simulationLift),
   *  not a separate fake animation. */
  recoveryFraction: number;
}

/** PS vocabulary, not generic "take action" copy — these are the three levers a mine operator
 *  actually has on a 90-day horizon. */
const ACTION_TEMPLATES: ActionTemplate[] = [
  { id: 'schedule', label: 'ADJUST MINE SCHEDULE', recoveryFraction: 0.32 },
  { id: 'blasting', label: 'OPTIMISE BLASTING', recoveryFraction: 0.22 },
  { id: 'equipment', label: 'RE-DEPLOY EQUIPMENT', recoveryFraction: 0.18 },
];

interface ActionCard {
  id: string;
  label: string;
  mineId: string;
  mineName: string;
  recoveredTonnes: number;
  liftFraction: number;
}

function buildActions(rows: RiskRow[]): ActionCard[] {
  const cards: ActionCard[] = [];
  for (const r of rows) {
    for (const t of ACTION_TEMPLATES) {
      cards.push({
        id: `${r.mineId}-${t.id}`,
        label: t.label,
        mineId: r.mineId,
        mineName: r.name,
        recoveredTonnes: Math.round(r.magnitudeTonnes * t.recoveryFraction),
        liftFraction: t.recoveryFraction,
      });
    }
  }
  return cards;
}

export function RecommendedActions() {
  const site = useSiteData();
  const selectMine = useDrishti((s) => s.selectMine);
  const setSimulation = useDrishti((s) => s.setSimulation);
  const simulationActive = useDrishti((s) => s.simulationActive);
  const selectedMine = useDrishti((s) => s.selectedMine);

  const actions = useMemo(() => (site ? buildActions(flaggedForMissTarget(computeRiskRows(site))) : []), [site]);

  return (
    <div className="glass" style={{ padding: 12, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="label mb-2">RECOMMENDED ACTIONS</div>
      {actions.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-mute)' }} className="mono">
          No mine forecast to miss target — nothing to recommend.
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {actions.map((a) => {
            const active = simulationActive && selectedMine === a.mineId;
            return (
              <div key={a.id} className="mono data" style={{ padding: '8px 6px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>{a.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>⛏ {a.mineName}</div>
                <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--risk-low)' }}>+{formatTonnes(a.recoveredTonnes)} recovered</span>
                  <button
                    onClick={() => {
                      selectMine(a.mineId);
                      setSimulation(true, a.liftFraction);
                    }}
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      padding: '4px 10px',
                      background: active ? 'var(--risk-low)' : 'var(--panel-hi)',
                      color: active ? 'var(--void)' : 'var(--text)',
                      border: '1px solid var(--line-hi)',
                    }}
                  >
                    {active ? 'SIMULATING' : 'SIMULATE'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

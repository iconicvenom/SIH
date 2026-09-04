import { useDrishti, type Scenarios } from '../store/useDrishti';

const ROWS: { key: keyof Scenarios; label: string; icon: string }[] = [
  { key: 'monsoon', label: 'Monsoon event', icon: '☔' },
  { key: 'equipmentLoss', label: 'Equipment loss', icon: '⚙' },
  { key: 'cutoffChange', label: 'Cutoff change', icon: '◫' },
];

/**
 * Every row must visibly change the bottom dock within 400ms — Part III §5.3. This is the
 * most imitated-and-hollowed element in this style of dashboard; ours actually simulates.
 */
export function SimulateCluster() {
  const scenarios = useDrishti((s) => s.scenarios);
  const toggleScenario = useDrishti((s) => s.toggleScenario);
  const setView = useDrishti((s) => s.setView);
  const setCutoff = useDrishti((s) => s.setCutoff);

  return (
    <div className="glass" style={{ padding: 10, marginTop: 8, pointerEvents: 'auto' }}>
      <div className="label mb-2">SIMULATE</div>
      {ROWS.map((row) => {
        const active = scenarios[row.key];
        return (
          <button
            key={row.key}
            onClick={() => {
              toggleScenario(row.key);
              if (row.key === 'cutoffChange' && !active) {
                setView('BLOCK');
                setCutoff(0.75);
              }
            }}
            className="mono flex w-full items-center gap-2"
            style={{
              padding: '7px 6px',
              fontSize: 12,
              color: active ? 'var(--text)' : 'var(--text-dim)',
              background: active ? 'var(--panel-hi)' : 'transparent',
              borderRadius: 6,
              marginBottom: 2,
            }}
          >
            <span style={{ width: 16, textAlign: 'center' }}>{row.icon}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>{row.label}</span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: active ? 'var(--rhodonite)' : 'var(--line-hi)',
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

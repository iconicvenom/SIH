import { useDrishti } from '../store/useDrishti';
import { SENSORS } from '../data/sensors';
import { formatDate, formatPercent } from '../lib/format';

/** ACQUISITIONS tab: the honest analogue of a conjunction list is an acquisition schedule. */
export function SensorStrip() {
  const selectedSensor = useDrishti((s) => s.selectedSensor);
  const selectSensor = useDrishti((s) => s.selectSensor);

  const sorted = [...SENSORS].sort((a, b) => a.nextPassUtc.localeCompare(b.nextPassUtc));

  return (
    <div className="flex gap-2 overflow-x-auto" style={{ pointerEvents: 'auto', paddingBottom: 4 }}>
      {sorted.map((s) => {
        const active = s.id === selectedSensor;
        const usable = s.cloudForecast < 0.3;
        return (
          <button
            key={s.id}
            onClick={() => selectSensor(active ? null : s.id)}
            className="glass mono flex-shrink-0"
            style={{
              padding: '8px 10px',
              minWidth: 150,
              textAlign: 'left',
              border: active ? '1px solid var(--rhodonite)' : 'var(--panel-border)',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text)' }}>{s.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 2 }}>{formatDate(s.nextPassUtc)}</div>
            <div
              style={{
                fontSize: 10,
                marginTop: 4,
                display: 'inline-block',
                padding: '1px 6px',
                borderRadius: 3,
                background: usable ? 'rgba(62,142,107,0.18)' : 'rgba(196,72,46,0.18)',
                color: usable ? 'var(--risk-low)' : 'var(--risk-high)',
              }}
            >
              cloud {formatPercent(s.cloudForecast)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

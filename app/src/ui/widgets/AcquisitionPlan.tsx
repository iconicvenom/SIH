import { useDrishti } from '../../store/useDrishti';
import { SENSORS } from '../../data/sensors';
import { formatDate, formatPercent, formatLatency } from '../../lib/format';

/**
 * The honest analogue of a conjunction-prediction panel: acquisition planning is a real
 * operational problem in remote-sensing work (Part III §1). This panel is what makes the
 * space-technology framing defensible rather than decorative.
 */
export function AcquisitionPlan() {
  const selectSensor = useDrishti((s) => s.selectSensor);
  const sorted = [...SENSORS].sort((a, b) => a.nextPassUtc.localeCompare(b.nextPassUtc));
  const next = sorted[0];

  return (
    <div className="data" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div className="label mb-2">ACQUISITION PLAN</div>
      {next && (
        <div className="mono" style={{ fontSize: 12, color: 'var(--ore-80)', marginBottom: 8 }}>
          NEXT USABLE: {next.name}, {formatDate(next.nextPassUtc)} UTC, cloud {formatPercent(next.cloudForecast)}
        </div>
      )}
      <div className="mono" style={{ fontSize: 11 }}>
        {sorted.map((s) => {
          const usable = s.cloudForecast < 0.3;
          return (
            <div
              key={s.id}
              onClick={() => selectSensor(s.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1fr 0.8fr 0.8fr 0.8fr',
                gap: 6,
                padding: '5px 0',
                borderBottom: '1px solid var(--line)',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: 'var(--text)' }}>{s.name}</span>
              <span style={{ color: 'var(--text-dim)' }}>{formatDate(s.nextPassUtc)}</span>
              <span style={{ color: 'var(--text-dim)' }}>{formatPercent(s.cloudForecast)}</span>
              <span style={{ color: 'var(--text-dim)' }}>{formatLatency(s.latencyDays)}</span>
              <span style={{ color: usable ? 'var(--risk-low)' : 'var(--risk-high)' }}>
                {usable ? 'usable' : 'marginal'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

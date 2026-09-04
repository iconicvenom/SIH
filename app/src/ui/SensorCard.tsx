import { useDrishti } from '../store/useDrishti';
import { SENSORS } from '../data/sensors';
import { FEATURE_LABEL } from '../data/features';
import { formatDate, formatPercent, formatLatency } from '../lib/format';

function IconSensor() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="10" y="10" width="8" height="8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 14H2M26 14h-4M14 6V2M14 26v-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M10 10 4 4M18 10l6-6M10 18l-6 6M18 18l6 6" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

/**
 * Part III §5.5. The "Feeds features" line is the whole point — it converts a decorative
 * panel into an argument about the model. Never a 3D spacecraft render.
 */
export function SensorCard() {
  const selectedSensor = useDrishti((s) => s.selectedSensor);
  const sensor = SENSORS.find((s) => s.id === selectedSensor);
  if (!sensor) return null;

  const rows: [string, string][] = [
    ['Bands used', sensor.bands.join(' ')],
    ['Native resolution', sensor.resolution],
    ['Revisit', sensor.revisit],
    ['Next pass', `${formatDate(sensor.nextPassUtc)} · cloud ${formatPercent(sensor.cloudForecast)}`],
    ['Data latency', formatLatency(sensor.latencyDays)],
  ];

  return (
    <div className="glass" style={{ padding: 12, width: 220, pointerEvents: 'auto' }}>
      <div className="flex items-center justify-between">
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}>{sensor.name}</div>
      </div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)', marginBottom: 8 }}>
        {sensor.agency}
      </div>
      <div style={{ color: 'var(--text-mute)', marginBottom: 8 }}>
        <IconSensor />
      </div>
      <div className="data mono" style={{ fontSize: 11, borderTop: '1px solid var(--line)' }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--text-mute)' }}>{k}</span>
            <span style={{ color: 'var(--text)', textAlign: 'right', maxWidth: 130 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="label" style={{ fontSize: 10 }}>
          FEEDS FEATURES
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {sensor.feedsFeatures.map((fid) => (
            <span
              key={fid}
              className="mono"
              style={{ fontSize: 10, padding: '2px 6px', background: 'var(--panel-hi)', color: 'var(--ore-40)', borderRadius: 3 }}
            >
              {FEATURE_LABEL[fid] ?? fid}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

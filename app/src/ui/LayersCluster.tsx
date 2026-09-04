import { useDrishti, type Layers } from '../store/useDrishti';

const ROWS: { key: keyof Layers; label: string; icon: string }[] = [
  { key: 'mines', label: 'Mines', icon: '⛏' },
  { key: 'prospectivity', label: 'Prospectivity', icon: '◆' },
  { key: 'lineaments', label: 'Lineaments', icon: '╱' },
  { key: 'risk', label: 'Risk', icon: '▲' },
];

/** Four real scene layers. Ground-track swaths were dropped from the globe (the brief called
 *  them "grids... longitude and latitude lines"), so the toggle that controlled them is gone
 *  too rather than left as a checkbox that visibly does nothing. */
export function LayersCluster() {
  const layers = useDrishti((s) => s.layers);
  const toggleLayer = useDrishti((s) => s.toggleLayer);

  return (
    <div className="glass" style={{ padding: 10, marginTop: 8, pointerEvents: 'auto' }}>
      <div className="label mb-2">LAYERS</div>
      {ROWS.map((row) => {
        const on = layers[row.key];
        return (
          <label
            key={row.key}
            className="mono flex items-center gap-2"
            style={{ padding: '6px 6px', fontSize: 12, cursor: 'pointer' }}
          >
            <input type="checkbox" checked={on} onChange={() => toggleLayer(row.key)} />
            <span style={{ width: 16, textAlign: 'center' }}>{row.icon}</span>
            <span style={{ color: on ? 'var(--text)' : 'var(--text-dim)' }}>{row.label}</span>
          </label>
        );
      })}
    </div>
  );
}

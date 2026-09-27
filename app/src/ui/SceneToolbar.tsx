import { useDrishti, type ViewState } from '../store/useDrishti';
import { useSiteData } from '../scene/Canvas3D';
import { resetCameraOffset } from '../scene/CameraRig';
import { confidenceColor, ORE_RAMP_CSS } from '../lib/ramp';
import { VE_RELIEF } from '../lib/terrainConstants';
import { formatCoord, formatElevation, formatProbability } from '../lib/format';

const STATES: { view: ViewState; label: string }[] = [
  { view: 'FLAT', label: 'FLAT' },
  { view: 'RELIEF', label: 'RELIEF' },
  { view: 'BLOCK', label: 'BLOCK MODEL' },
  { view: 'SUBSURFACE', label: 'UNDERGROUND' },
];

const CONFIDENCE_RAMP_CSS = `linear-gradient(90deg, ${[0, 1].map(value =>
  `rgb(${confidenceColor(value).map(channel => Math.round(channel * 255)).join(',')})`,
).join(', ')})`;

/**
 * Part I's viewport chrome (§7), restyled to the glass system and moved to bottom-centre
 * over the open canvas — the only zone in Part III's layout that isn't claimed by a rail
 * or the dock. Part III's shell is additive, not a replacement: the state controls,
 * CUTOFF/DEPTH SLICE and the legend are hard acceptance criteria ("states transition in
 * either direction", "drag CUTOFF 0.30 to 0.75") that Part III's own text never depicts
 * but never cuts either.
 */
export function SceneToolbar() {
  const view = useDrishti((s) => s.view);
  const drape = useDrishti((s) => s.drape);
  const setView = useDrishti((s) => s.setView);
  const showKnownDeposits = useDrishti((s) => s.showKnownDeposits);
  const toggleKnownDeposits = useDrishti((s) => s.toggleKnownDeposits);
  const cutoff = useDrishti((s) => s.cutoff);
  const setCutoff = useDrishti((s) => s.setCutoff);
  const depthRange = useDrishti((s) => s.depthRange);
  const setDepthRange = useDrishti((s) => s.setDepthRange);
  const hoverCell = useDrishti((s) => s.hoverCell);
  const selectMine = useDrishti((s) => s.selectMine);
  const selectCell = useDrishti((s) => s.selectCell);
  const site = useSiteData();

  if (view === 'GLOBE') return null;

  const idx = hoverCell ? hoverCell.gz * 256 + hoverCell.gx : -1;
  const hoverElevation = site && idx >= 0 ? site.elevation[idx] : null;
  const hoverProb = site && idx >= 0 ? site.prospectivity[idx] : null;
  const confidenceLegend = drape === 'CONFIDENCE' && (view === 'FLAT' || view === 'RELIEF');

  return (
    <div
      className="scene-toolbar absolute flex flex-col items-center gap-2"
    >
      {(view === 'BLOCK' || view === 'SUBSURFACE') && (
        <div className="scene-toolbar-depth glass mono flex items-center gap-3" style={{ pointerEvents: 'auto', padding: '6px 10px' }}>
          <div className="flex items-center gap-2">
            <span className="label" style={{ fontSize: 10 }}>
              CUTOFF
            </span>
            <input type="range" min={0} max={1} step={0.01} value={cutoff} onChange={(e) => setCutoff(parseFloat(e.target.value))} style={{ width: 100 }} />
            <span style={{ fontSize: 11, color: 'var(--text)' }}>{cutoff.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2" style={{ borderLeft: '1px solid var(--line)', paddingLeft: 12 }}>
            <span className="label" style={{ fontSize: 10 }}>
              DEPTH SLICE
            </span>
            <input
              type="range"
              min={0}
              max={240}
              step={10}
              value={depthRange[0]}
              onChange={(e) => setDepthRange([Math.min(parseInt(e.target.value), depthRange[1]), depthRange[1]])}
              style={{ width: 70 }}
            />
            <input
              type="range"
              min={0}
              max={240}
              step={10}
              value={depthRange[1]}
              onChange={(e) => setDepthRange([depthRange[0], Math.max(parseInt(e.target.value), depthRange[0])])}
              style={{ width: 70 }}
            />
            <span style={{ fontSize: 11, color: 'var(--text)' }}>
              {depthRange[0]}–{depthRange[1]}m
            </span>
          </div>
        </div>
      )}

      <div
        className="scene-toolbar-main glass mono"
      >
        <div className="scene-toolbar-controls">
        <div className="scene-toolbar-views">
          {STATES.map((s) => (
            <button
              key={s.view}
              onClick={() => setView(s.view)}
              className="mono"
              style={{
                whiteSpace: 'nowrap',
                fontSize: 10,
                letterSpacing: '0.04em',
                color: view === s.view ? 'var(--text)' : 'var(--text-dim)',
                borderBottom: view === s.view ? '1px solid var(--rhodonite)' : '1px solid transparent',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>


        <section
          className="scene-toolbar-legend"
          aria-label="Map colour legend"
          style={{ flexShrink: 0, borderLeft: '1px solid var(--line)', paddingLeft: 8, fontFamily: 'var(--font-body)' }}
        >
          <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 3 }}>
            {confidenceLegend ? 'Model confidence · proxy' : 'Modelled mineral potential'}
          </div>
          <div aria-hidden="true" style={{ height: 4, background: confidenceLegend ? CONFIDENCE_RAMP_CSS : ORE_RAMP_CSS, borderRadius: 2 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 10, color: 'var(--text-dim)' }}>
            <span>Low</span><span>Moderate</span><span>High</span>
          </div>

        </section>

        <button
          onClick={() => {
            selectMine(null);
            selectCell(null);
            resetCameraOffset.current();
          }}
          className="mono"
          style={{ padding: '4px 5px 4px 8px', flexShrink: 0, fontSize: 10, color: 'var(--text-mute)', borderLeft: '1px solid var(--line)' }}
        >
          RESET
        </button>
        </div>
        <div className="scene-toolbar-foot">
          <span>{view === 'FLAT' ? 'Flat surface'
            : view === 'RELIEF' ? `Height exaggerated ${VE_RELIEF.toFixed(1)}×`
              : 'Brighter blocks = higher potential'}</span>
          {view === 'FLAT' && <button className="scene-toolbar-mines" onClick={toggleKnownDeposits}
            aria-label={showKnownDeposits ? 'Hide known deposits' : 'Show known deposits'} aria-pressed={showKnownDeposits}>
            {showKnownDeposits ? 'Hide mines' : 'Show mines'}
          </button>}
          {hoverCell && <span className="scene-toolbar-readout">
            {formatCoord(hoverCell.lon)}E {formatCoord(hoverCell.lat)}N
            {hoverElevation !== null && ` · ${formatElevation(hoverElevation)}`}
            {hoverProb !== null && ` · Score ${formatProbability(hoverProb)}`}
          </span>}
        </div>
      </div>
    </div>
  );
}

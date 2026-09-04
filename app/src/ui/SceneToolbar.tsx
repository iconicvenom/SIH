import { useDrishti, type ViewState } from '../store/useDrishti';
import { useSiteData } from '../scene/Canvas3D';
import { resetCameraOffset } from '../scene/CameraRig';
import { ORE_RAMP_CSS } from '../lib/ramp';
import { formatCoord, formatElevation, formatProbability } from '../lib/format';

const STATES: { view: ViewState; label: string }[] = [
  { view: 'FLAT', label: 'FLAT' },
  { view: 'RELIEF', label: 'RELIEF' },
  { view: 'BLOCK', label: 'BLOCK MODEL' },
  { view: 'SUBSURFACE', label: 'UNDERGROUND' },
];

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
  const setDrape = useDrishti((s) => s.setDrape);
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

  return (
    <div
      className="absolute flex flex-col items-center gap-2"
      style={{ left: '50%', transform: 'translateX(-50%)', bottom: 292, pointerEvents: 'none' }}
    >
      {(view === 'BLOCK' || view === 'SUBSURFACE') && (
        <div className="glass mono flex items-center gap-4 px-4 py-3" style={{ pointerEvents: 'auto' }}>
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

      <div className="glass mono flex items-center gap-4 px-4 py-3" style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center gap-1">
          {STATES.map((s) => (
            <button
              key={s.view}
              onClick={() => setView(s.view)}
              className="mono px-3 py-1"
              style={{
                fontSize: 11,
                letterSpacing: '0.06em',
                color: view === s.view ? 'var(--text)' : 'var(--text-dim)',
                borderBottom: view === s.view ? '2px solid var(--rhodonite)' : '2px solid transparent',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {view === 'RELIEF' && (
          <div className="flex" style={{ borderLeft: '1px solid var(--line)', paddingLeft: 10 }}>
            {(['PROSPECTIVITY', 'CONFIDENCE'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDrape(d)}
                className="mono px-3 py-1"
                style={{ fontSize: 10, color: drape === d ? 'var(--text)' : 'var(--text-dim)' }}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {view === 'FLAT' && (
          <button
            onClick={toggleKnownDeposits}
            className="mono px-3 py-1"
            style={{
              fontSize: 10,
              letterSpacing: '0.06em',
              borderLeft: '1px solid var(--line)',
              paddingLeft: 10,
              color: showKnownDeposits ? 'var(--rhodonite)' : 'var(--text-dim)',
            }}
          >
            SHOW KNOWN DEPOSITS
          </button>
        )}

        <div className="flex items-center gap-2" style={{ borderLeft: '1px solid var(--line)', paddingLeft: 10 }}>
          <div style={{ width: 60, height: 6, background: ORE_RAMP_CSS, borderRadius: 2 }} />
          <span style={{ fontSize: 10, color: 'var(--text-mute)' }}>V.E. {view === 'FLAT' ? '0.0' : '2.4'}×</span>
        </div>

        {hoverCell && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)', borderLeft: '1px solid var(--line)', paddingLeft: 10 }}>
            {formatCoord(hoverCell.lon)}E {formatCoord(hoverCell.lat)}N
            {hoverElevation !== null && ` · ${formatElevation(hoverElevation)}`}
            {hoverProb !== null && ` · p${formatProbability(hoverProb)}`}
          </div>
        )}

        <button
          onClick={() => {
            selectMine(null);
            selectCell(null);
            resetCameraOffset.current();
          }}
          className="mono px-3 py-1"
          style={{ fontSize: 10, color: 'var(--text-mute)', borderLeft: '1px solid var(--line)', paddingLeft: 10 }}
        >
          RESET
        </button>
      </div>
    </div>
  );
}

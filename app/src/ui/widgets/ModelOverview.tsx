import { useMemo } from 'react';
import { COLUMN_DEPTH_M } from '../../data/generate';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti, type Drape } from '../../store/useDrishti';
import { buildModelOverview, PATCH_SIZE, type OverviewVoxel } from '../../lib/modelOverview';
import { computeTopDrillTargets } from '../../lib/stats';
import { confidenceColor, rampCss } from '../../lib/ramp';
import './ModelOverview.css';

function VolumePreview({ voxels, peakDepth }: { voxels: OverviewVoxel[]; peakDepth: number | null }) {
  return (
    <svg className="model-overview-volume" viewBox="0 0 260 200" role="img" aria-label="Local block model, showing scores above the cutoff in the selected depth interval">
      <g fill="none" stroke="var(--line-hi)" strokeWidth="0.8">
        <path d="M130 24 228 59 130 94 32 59Z M32 59v84l98 35 98-35V59 M130 94v84" />
        <path d="M130 24v84L32 143 M130 108l98 35" strokeDasharray="2 4" opacity="0.5" />
      </g>
      {voxels.map((v) => {
        const x = 130 + (v.x - v.z) * 14;
        const y = 24 + (v.x + v.z) * 5 + v.depth / COLUMN_DEPTH_M * 84;
        const h = v.height / COLUMN_DEPTH_M * 84;
        return (
          <g key={`${v.x}-${v.z}-${v.depth}`} fill={rampCss(v.value)} stroke="var(--void)" strokeWidth="0.35" strokeLinejoin="round">
            <path d={`M${x - 14} ${y + 5}l14 5v${h}l-14 -5Z`} fillOpacity="0.5" />
            <path d={`M${x + 14} ${y + 5}l-14 5v${h}l14 -5Z`} fillOpacity="0.72" />
            <path d={`M${x} ${y}l14 5-14 5-14 -5Z`} fillOpacity="0.92" />
          </g>
        );
      })}
      {peakDepth !== null && (
        <g stroke="var(--rhodonite)" fill="var(--rhodonite)">
          <path d="M130 59v84" strokeDasharray="2 3" strokeWidth="1" />
          <circle cx="130" cy={59 + peakDepth / COLUMN_DEPTH_M * 84} r="2.5" />
        </g>
      )}
      <g fill="var(--text-dim)" fontSize="10" className="mono">
        <text x="14" y="21">0 m</text>
        <text x="246" y="193" textAnchor="end">{COLUMN_DEPTH_M} m</text>
      </g>
      {voxels.length === 0 && <text x="130" y="116" textAnchor="middle" fill="var(--text)" fontSize="10">No blocks above cutoff</text>}
    </svg>
  );
}

function LocalMap({ patch, drape }: { patch: ReturnType<typeof buildModelOverview>['patch']; drape: Drape }) {
  return (
    <svg viewBox="0 0 130 78" role="img" aria-label={`Local ${drape === 'PROSPECTIVITY' ? 'prospectivity' : 'confidence proxy'} map; selected cell at the crosshair`}>
      {patch.map((cell, i) => {
        if (!cell) return null;
        const rgb = confidenceColor(cell.confidence);
        return <rect key={i} x={(i % PATCH_SIZE) * 10} y={Math.floor(i / PATCH_SIZE) * 6} width="10" height="6"
          fill={drape === 'PROSPECTIVITY' ? rampCss(cell.score) : `rgb(${rgb.map(c => Math.round(c * 255)).join(',')})`} />;
      })}
      <path d="M59 39h12M65 33v12" stroke="var(--void)" strokeWidth="3" />
      <path d="M59 39h12M65 33v12" stroke="var(--text)" strokeWidth="1" />
    </svg>
  );
}

export function ModelOverview() {
  const site = useSiteData();
  const selectedCell = useDrishti(s => s.selectedCell);
  const depthRange = useDrishti(s => s.depthRange);
  const cutoff = useDrishti(s => s.cutoff);
  const selectCell = useDrishti(s => s.selectCell);
  const setView = useDrishti(s => s.setView);
  const setDrape = useDrishti(s => s.setDrape);
  const fallback = useMemo(() => site ? computeTopDrillTargets(site, 1)[0] : null, [site]);
  const target = selectedCell ?? fallback;
  const overview = useMemo(() => site && target
    ? buildModelOverview(site, target.gx, target.gz, depthRange, cutoff)
    : null, [site, target, depthRange, cutoff]);

  function inspect(drape?: Drape) {
    if (!target) return;
    selectCell({ gx: target.gx, gz: target.gz, lon: target.lon, lat: target.lat });
    if (drape) setDrape(drape);
    setView(drape ? 'RELIEF' : 'BLOCK');
  }

  return (
    <section className="model-overview" aria-label="Model overview">
      <header className="model-overview-header">
        <h2>Model overview</h2>
        <span className="model-overview-badge" title="Derived from the illustrative fold model, not field-verified estimates">Modelled</span>
      </header>
      {!overview || !target ? <p className="model-overview-loading" role="status">Loading model…</p> : (
        <div className="model-overview-body">
          <div className="model-overview-target">
            <span>{selectedCell ? 'Selected target' : 'Leading target'}</span>
            <span className="mono">T-{target.gx}-{target.gz}</span>
          </div>
          <VolumePreview voxels={overview.voxels} peakDepth={overview.peakDepth} />
          <div className="model-overview-caption">Local block model <span className="mono">≥ {cutoff.toFixed(2)}</span></div>
          <div className="model-overview-score">
            <strong className="mono">{overview.score.toFixed(2)}</strong>
            <div><span>Prospectivity score</span><small>0–1 · full {COLUMN_DEPTH_M} m column</small></div>
          </div>
          <dl className="model-overview-readings">
            <div><dt>Regional rank</dt><dd>Above {overview.abovePercent > 99.9 ? '99.9' : overview.abovePercent.toFixed(1)}% of cells</dd></div>
            <div><dt>Confidence proxy</dt><dd>{overview.confidence.toFixed(2)} / 1</dd></div>
            <div><dt>Interval peak</dt><dd>{overview.peakDepth === null ? 'No signal' : `${overview.peakDepth} m below surface`}</dd></div>
          </dl>
          <div className="model-overview-maps">
            {(['PROSPECTIVITY', 'CONFIDENCE'] as const).map(drape => (
              <button key={drape} onClick={() => inspect(drape)} aria-label={`Show ${drape === 'PROSPECTIVITY' ? 'prospectivity' : 'confidence'} on terrain`}>
                <LocalMap patch={overview.patch} drape={drape} />
                <span>{drape === 'PROSPECTIVITY' ? 'Prospectivity' : 'Confidence proxy'}</span>
              </button>
            ))}
          </div>
          <div className="model-overview-footer"><span>Fold model</span><span className="mono">Depth {depthRange[0]}–{depthRange[1]} m</span></div>
          <button className="model-overview-inspect" onClick={() => inspect()}>
            Inspect in 3D <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
          </button>
        </div>
      )}
    </section>
  );
}

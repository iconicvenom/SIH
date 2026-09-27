import { useDrishti } from '../store/useDrishti';

interface Layer {
  name: string;
  status: 'REAL' | 'MODELLED';
  note: string;
}

const LAYERS: Layer[] = [
  { name: 'Mine locations & districts', status: 'REAL', note: 'Public-domain, approximate coordinates. Labelled indicative.' },
  { name: 'Site bounding box / geography', status: 'REAL', note: 'Sausar Belt extent — Nagpur, Bhandara, Balaghat.' },
  { name: 'Sensor platform specs', status: 'REAL', note: 'Published bands, resolution and revisit for each satellite.' },
  { name: 'Terrain elevation', status: 'MODELLED', note: 'Synthetic fBm + fold-axial ridge. Not a real DEM.' },
  { name: 'Prospectivity raster', status: 'MODELLED', note: 'Deterministic synform generator, seed 26009.' },
  { name: 'Confidence surface', status: 'MODELLED', note: 'Synthetic proxy for model uncertainty.' },
  { name: 'SHAP driver values', status: 'MODELLED', note: 'Synthesised — no trained model sits behind this.' },
  { name: 'Structural lineaments', status: 'MODELLED', note: 'Traced along the fitted fold axis, not real hillshade.' },
  { name: 'Production time series', status: 'MODELLED', note: 'Fully synthetic. No real MOIL production data is wired in.' },
  { name: 'Globe colour & relief', status: 'REAL', note: 'NASA Blue Marble colour + DEM-derived relief (three.js reference textures), on a true undistorted sphere — relief is lighting-only (bump-mapped), not a shape distortion.' },
  { name: 'Scene thumbnails', status: 'REAL', note: 'NASA GIBS (MODIS Terra) true-colour imagery of the actual Sausar Belt bbox, 2025-03-05 — a real clear-sky pass, not a live feed. Late-August passes here are ~80% cloud, so a current date would show nothing.' },
  { name: 'Terrain surface photo', status: 'REAL', note: 'Same 2025-03-05 GIBS image, draped pixel-for-pixel across the 3D terrain as its base layer; the prospectivity/confidence colour is masked over it, not painted flat.' },
  { name: 'Pass times & cloud forecasts', status: 'MODELLED', note: 'Illustrative, not a live acquisition-planning feed.' },
  { name: 'Satellite models on the globe', status: 'MODELLED', note: 'Sentinel-2B, Landsat-9 and Cartosat-3: visual reconstructions from ESA, NASA and ISRO references, enlarged for visibility. All three follow continuous 18-second presentation loops over India and surrounding waters. Paths, timing and attitude are illustrative, not real or live orbital positions. Mission specifications are nominal published values.' },
];

export function AboutData({ onClose }: { onClose: () => void }) {
  const reducedMotion = useDrishti((s) => s.reducedMotion);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', zIndex: 100, pointerEvents: 'auto' }}
      onClick={onClose}
    >
      <div
        className="glass"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 20, width: 520, maxHeight: '76vh', overflowY: 'auto' }}
      >
        <div className="label mb-1">ABOUT THE DATA</div>
        <div style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 14 }}>
          DRISHTI does not command spacecraft. Satellite movement is a regional presentation
          animation; acquisition forecasts below remain illustrative.
        </div>

        <div className="data">
          {LAYERS.map((l) => (
            <div key={l.name} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 13 }}>{l.name}</span>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: l.status === 'REAL' ? 'var(--risk-low)' : 'var(--text-mute)' }}
                >
                  {l.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{l.note}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between" style={{ marginTop: 14 }}>
          <label className="flex items-center gap-2 mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => useDrishti.setState({ reducedMotion: e.target.checked })}
            />
            Reduced motion
          </label>
          <button
            onClick={onClose}
            className="mono"
            style={{ fontSize: 12, color: 'var(--text)', border: '1px solid var(--line-hi)', padding: '6px 12px' }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { MINES } from '../data/mines';
import { useDrishti } from '../store/useDrishti';
import { useSiteData } from '../scene/Canvas3D';
import { GRID, haversineKm, lonLatToWorld, worldToGrid } from '../lib/geo';

const districts = [...new Set(MINES.map(mine => mine.district))];
const states = [...new Set(MINES.map(mine => mine.state))];

export function RegionSummary() {
  const view = useDrishti(s => s.view);
  const cell = useDrishti(s => s.selectedCell);
  const mineId = useDrishti(s => s.selectedMine);
  const site = useSiteData();
  const selection = useMemo(() => {
    if (view === 'GLOBE') return null;
    const mine = MINES.find(m => m.id === mineId);
    const point = cell ?? mine;
    if (!point) return null;
    const [gx, gz] = cell ? [cell.gx, cell.gz] : worldToGrid(...lonLatToWorld(point.lon, point.lat));
    const nearest = MINES.map(m => ({ mine: m, km: haversineKm(point.lon, point.lat, m.lon, m.lat) }))
      .reduce((best, item) => item.km < best.km ? item : best);
    const index = gz * GRID + gx;
    return { ...point, mine: cell ? null : mine, nearest,
      elevation: site?.elevation[index], score: site?.prospectivity[index] };
  }, [view, cell, mineId, site]);

  if (selection) return (
    <section className="glass region-summary" aria-label="Region at a glance">
      <div aria-live="polite">
        <h2 className="label">{selection.mine ? 'SELECTED MINE' : 'SELECTED LOCATION'}</h2>
        <p className="region-summary-name">{selection.mine?.name ?? `Near ${selection.nearest.mine.name}`}</p>
        <p className="region-summary-location mono">{selection.lat.toFixed(4)}° N · {selection.lon.toFixed(4)}° E</p>
        <dl>
          <div><dt>Modelled elevation</dt><dd>{selection.elevation === undefined ? '—' : `${Math.round(selection.elevation)} m`}</dd></div>
          <div><dt>Mineral potential</dt><dd>{selection.score?.toFixed(2) ?? '—'}</dd></div>
        </dl>
        {selection.mine ? <p className="region-summary-context">
          {selection.mine.type === 'underground' ? 'Underground mine' : 'Open-pit mine'}<br />
          {selection.mine.district} · {selection.mine.state}
        </p> : <p className="region-summary-context">
          Nearest known mine: {selection.nearest.mine.name}<br />
          Approx. {selection.nearest.km.toFixed(1)} km away
        </p>}
        <p className="region-summary-note">Potential: relative score from 0–1, not a confirmed deposit. Elevation is above sea level.</p>
      </div>
    </section>
  );

  return (
    <section className="glass region-summary" aria-label="Region at a glance">
      <h2 className="label">REGION AT A GLANCE</h2>
      <p className="region-summary-name">Sausar Belt</p>
      <p className="region-summary-location">{states.join(' · ')}</p>
      <dl>
        <div><dt>Known mines</dt><dd>{MINES.length}</dd></div>
        <div><dt>Mapped districts</dt><dd>{districts.length}</dd></div>
      </dl>
      <p className="region-summary-districts">{districts.join(' · ')}</p>
      {view !== 'GLOBE' && <p className="region-summary-note">Click a mine name or double-click the terrain for local details.</p>}
      {view === 'GLOBE' && (
        <button onClick={() => useDrishti.getState().setView('RELIEF')}>
          Explore terrain <span aria-hidden="true">↗</span>
        </button>
      )}
    </section>
  );
}

import { Html } from '@react-three/drei';
import { useDrishti } from '../store/useDrishti';
import { MINES } from '../data/mines';
import { GRID, lonLatToWorld, worldToGrid } from '../lib/geo';
import { terrainSurfaceY } from '../lib/terrainConstants';
import { useSiteData } from './Canvas3D';

/** Hollow squares — reference points, not data. Part I §3. */
export function MineMarkers() {
  const site = useSiteData();
  const view = useDrishti((s) => s.view);
  const showKnownDeposits = useDrishti((s) => s.showKnownDeposits);
  const layersOn = useDrishti((s) => s.layers.mines);
  const selectedMine = useDrishti((s) => s.selectedMine);
  const selectMine = useDrishti((s) => s.selectMine);
  const setView = useDrishti((s) => s.setView);

  const show = layersOn && showKnownDeposits && (view === 'FLAT' || view === 'RELIEF');
  if (!site || !show) return null;

  return (
    <group>
      {MINES.map((mine) => {
        const [x, z] = lonLatToWorld(mine.lon, mine.lat);
        const [gx, gz] = worldToGrid(x, z);
        const y = view === 'RELIEF' ? terrainSurfaceY(site.elevation[gz * GRID + gx]) : 0;
        return (
          <group key={mine.id} position={[x, y, z]}>
            <Html transform={false} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  width: 10,
                  height: 10,
                  border: '1.5px solid var(--text)',
                  transform: 'translate(-5px, -5px)',
                }}
              />
              <button
                type="button"
                className="mono"
                data-mine-label={mine.id}
                aria-pressed={selectedMine === mine.id}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  selectMine(mine.id);
                  if (view === 'FLAT') setView('RELIEF');
                }}
                style={{
                  position: 'absolute',
                  top: 6,
                  padding: '4px 6px',
                  pointerEvents: 'auto',
                  transform: 'translateX(-50%)',
                  fontSize: 11,
                  color: selectedMine === mine.id ? 'var(--rhodonite)' : 'var(--text)',
                  whiteSpace: 'nowrap',
                  textShadow: '0 1px 3px var(--void)',
                }}
              >
                {mine.name}
              </button>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

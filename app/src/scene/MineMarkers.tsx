import { Html } from '@react-three/drei';
import { useDrishti } from '../store/useDrishti';
import { MINES } from '../data/mines';
import { lonLatToWorld } from '../lib/geo';
import { useSiteData } from './Canvas3D';

/** Hollow squares — reference points, not data. Part I §3. */
export function MineMarkers() {
  const site = useSiteData();
  const view = useDrishti((s) => s.view);
  const showKnownDeposits = useDrishti((s) => s.showKnownDeposits);
  const layersOn = useDrishti((s) => s.layers.mines);
  const selectMine = useDrishti((s) => s.selectMine);

  const show = layersOn && showKnownDeposits && (view === 'FLAT' || view === 'RELIEF');
  if (!site || !show) return null;

  return (
    <group>
      {MINES.map((mine) => {
        const [x, z] = lonLatToWorld(mine.lon, mine.lat);
        return (
          <group key={mine.id} position={[x, 0, z]} onClick={() => selectMine(mine.id)}>
            <Html center transform={false} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  border: '1.5px solid var(--text)',
                  transform: 'translate(-5px, -5px)',
                }}
              />
              <div
                className="mono"
                style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', marginTop: 2 }}
              >
                {mine.name}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

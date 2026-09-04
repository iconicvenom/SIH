import { Html } from '@react-three/drei';
import { useDrishti } from '../store/useDrishti';

const TICKS = [0, 40, 80, 120, 160, 200, 240];

export function DepthRuler() {
  const view = useDrishti((s) => s.view);
  if (view !== 'BLOCK' && view !== 'SUBSURFACE') return null;

  return (
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <div
        className="mono absolute"
        style={{
          left: 16,
          top: 96,
          bottom: 96,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {TICKS.map((m) => (
          <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 1, background: 'var(--text-mute)' }} />
            <span style={{ fontSize: 11, color: '#fff' }}>{m}m</span>
          </div>
        ))}
      </div>
    </Html>
  );
}

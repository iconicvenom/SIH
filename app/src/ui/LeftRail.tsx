import { useDrishti } from '../store/useDrishti';
import { ScenePreview } from './ScenePreview';
import { SimulateCluster } from './SimulateCluster';
import { DriverWaterfall } from './widgets/DriverWaterfall';

export function LeftRail() {
  const tab = useDrishti((s) => s.tab);
  const bootStage = useDrishti((s) => s.bootStage);

  const revealed = bootStage >= 3;

  return (
    <aside
      className="absolute left-4 flex flex-col"
      style={{
        top: 84,
        bottom: 292,
        width: 260,
        pointerEvents: 'none',
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateX(0)' : 'translateX(-12px)',
        transition: 'opacity 500ms var(--ease-entrance), transform 500ms var(--ease-entrance)',
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        <ScenePreview />
        <SimulateCluster />
      </div>

      {/* EXPLORATION has nothing here by design — Target Inspector and Depth Profile are a
          popup at the clicked point itself (widgets/TargetInspector.tsx), not a rail panel. */}
      {tab === 'OPERATIONS' && (
        <div className="glass mt-2" style={{ flex: 1, overflowY: 'auto', pointerEvents: 'auto' }}>
          <DriverWaterfall />
        </div>
      )}
    </aside>
  );
}

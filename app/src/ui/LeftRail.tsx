import { useDrishti } from '../store/useDrishti';
import { ScenePreview } from './ScenePreview';
import { RegionSummary } from './RegionSummary';
import { DriverWaterfall } from './widgets/DriverWaterfall';

export function LeftRail() {
  const tab = useDrishti((s) => s.tab);
  const bootStage = useDrishti((s) => s.bootStage);

  const revealed = bootStage >= 3;

  return (
    <aside
      className="dashboard-rail dashboard-left flex flex-col"
      style={{
        pointerEvents: 'none',
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateX(0)' : 'translateX(-12px)',
        transition: 'opacity 500ms var(--ease-entrance), transform 500ms var(--ease-entrance)',
      }}
    >
      <div className="dashboard-left-content">
        <ScenePreview />
        <RegionSummary />
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

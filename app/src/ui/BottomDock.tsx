import { useDrishti } from '../store/useDrishti';
import { RiskAlerts } from './widgets/RiskAlerts';
import { MinesTable } from './widgets/MinesTable';
import { ProductionForecast } from './widgets/ProductionForecast';
import { AcquisitionPlan } from './widgets/AcquisitionPlan';
import { SensorStrip } from './SensorStrip';
import { TopDrillTargets } from './widgets/TopDrillTargets';
import { DataInputs } from './widgets/DataInputs';
import { RecommendedActions } from './widgets/RecommendedActions';

export function BottomDock() {
  const tab = useDrishti((s) => s.tab);
  const bootStage = useDrishti((s) => s.bootStage);
  const revealed = bootStage >= 4;

  return (
    <div
      className="absolute left-4 right-4 bottom-4"
      style={{
        height: 260,
        pointerEvents: 'none',
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 500ms var(--ease-entrance), transform 500ms var(--ease-entrance)',
      }}
    >
      {tab === 'ACQUISITIONS' ? (
        <div className="glass" style={{ padding: 12, height: '100%', pointerEvents: 'auto', overflow: 'hidden' }}>
          <div className="label mb-2">UPCOMING PASSES</div>
          <SensorStrip />
          <div style={{ marginTop: 8, maxHeight: 170, overflowY: 'auto' }}>
            <AcquisitionPlan />
          </div>
        </div>
      ) : tab === 'EXPLORATION' ? (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12, height: '100%', pointerEvents: 'auto' }}>
          <TopDrillTargets />
          <DataInputs />
          <RecommendedActions />
        </div>
      ) : (
        <div
          className="grid"
          // Same total (3.5fr, was 1.3+1+1.2) and MINES keeps the exact same 1fr it already
          // had, so its pixel width is unchanged — only PREDICTED SHORTFALLS shrinks (it was
          // sized for a full row of alert cards but usually holds 0-2) and PRODUCTION FORECAST
          // absorbs everything that frees up.
          style={{ gridTemplateColumns: '0.65fr 1fr 1.85fr', gap: 12, height: '100%', pointerEvents: 'auto' }}
        >
          <RiskAlerts />
          <MinesTable />
          <div className="glass" style={{ height: '100%', overflow: 'hidden' }}>
            <ProductionForecast />
          </div>
        </div>
      )}
    </div>
  );
}

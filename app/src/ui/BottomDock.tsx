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
      className="dashboard-dock"
      style={{
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
        <div className="dashboard-dock-grid dashboard-exploration">
          <TopDrillTargets />
          <DataInputs />
          <RecommendedActions />
        </div>
      ) : (
        <div className="dashboard-dock-grid dashboard-operations">
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

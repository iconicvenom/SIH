import { useDrishti } from '../store/useDrishti';
import { useSiteData } from '../scene/Canvas3D';
import { SensorCard } from './SensorCard';
import { ModelOverview } from './widgets/ModelOverview';
import { Waterfall } from './widgets/Waterfall';
import { FEATURE_LABEL } from '../data/features';
import { SatelliteInspector } from './SatelliteInspector';

export function RightRail() {
  const view = useDrishti((s) => s.view);
  const bootStage = useDrishti((s) => s.bootStage);
  const site = useSiteData();
  const selectedCell = useDrishti((s) => s.selectedCell);
  if (view === 'GLOBE' && bootStage < 3) return null;

  const shapItems =
    site && selectedCell
      ? site.shapAt(selectedCell.gx, selectedCell.gz).map((c) => ({
          label: FEATURE_LABEL[c.feature] ?? c.feature,
          value: c.value,
        }))
      : [];

  return (
    <div className="dashboard-rail dashboard-right">
      {/*
        Target Inspector and Depth Profile share a callout attached to the selected map point.
      */}
      <div
        className="dashboard-rail-scroll flex flex-col gap-3"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
      >
        {view === 'GLOBE' ? <SatelliteInspector /> : <><div className="glass dashboard-model">
          <ModelOverview />
          {shapItems.length > 0 && (
            <details className="dashboard-drivers">
              <summary>Model drivers</summary>
              <Waterfall items={shapItems} title="SHAP DRIVERS" />
            </details>
          )}
        </div>
        <SensorCard /></>}
      </div>
    </div>
  );
}

import { useDrishti } from '../store/useDrishti';
import { useSiteData } from '../scene/Canvas3D';
import { SensorCard } from './SensorCard';
import { ModelValidation } from './widgets/ModelValidation';
import { Waterfall } from './widgets/Waterfall';
import { FEATURE_LABEL } from '../data/features';

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
    <div className="absolute right-4" style={{ top: 84, bottom: 300, width: 260, pointerEvents: 'none' }}>
      {/*
        Target Inspector and Depth Profile used to live here too; they're now a popup at the
        clicked point itself (widgets/TargetInspector.tsx), not a second look-up in this rail.
      */}
      <div
        className="flex flex-col gap-3"
        style={{ position: 'absolute', inset: 0, overflowY: 'auto', pointerEvents: 'auto' }}
      >
        <div className="glass" style={{ width: 260, flexShrink: 0 }}>
          <ModelValidation />
          {shapItems.length > 0 && <Waterfall items={shapItems} title="SHAP DRIVERS" />}
        </div>
        <SensorCard />
      </div>
    </div>
  );
}

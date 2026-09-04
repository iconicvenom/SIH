import { useDrishti } from '../../store/useDrishti';
import { Waterfall } from './Waterfall';

/** Operations production drivers. The monsoon toggle must visibly reach this panel too. */
export function DriverWaterfall() {
  const monsoon = useDrishti((s) => s.scenarios.monsoon);
  const equipmentLoss = useDrishti((s) => s.scenarios.equipmentLoss);

  const items = [
    { label: 'Equipment downtime', value: equipmentLoss ? 0.78 : 0.62 },
    { label: 'Monsoon haul-road delay', value: monsoon ? 0.61 : 0.41 },
    { label: 'Blast schedule delay', value: -0.18 },
    { label: 'Ore availability', value: 0.22 },
    { label: 'Manpower shortfall', value: -0.09 },
  ];

  return <Waterfall items={items} title="PRODUCTION DRIVERS" />;
}

import { useMemo } from 'react';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { computeRiskRows, flaggedForMissTarget } from '../../lib/stats';
import { productionOutlook } from '../../lib/productionOutlook';
import { formatTonnes } from '../../lib/format';
import { MINES } from '../../data/mines';
import { TODAY_ISO } from '../../data/generate';
import './ProductionOutlook.css';

const monthName = (month: string) => new Date(`${month}-01T00:00:00Z`)
  .toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });

export function RiskAlerts() {
  const site = useSiteData();
  const selectedMine = useDrishti(s => s.selectedMine);
  const flagged = useMemo(() => site ? flaggedForMissTarget(computeRiskRows(site)) : [], [site]);
  const mineId = selectedMine ?? flagged[0]?.mineId ?? MINES[0].id;
  const mine = MINES.find(m => m.id === mineId);
  const outlook = useMemo(() => productionOutlook(site?.production.find(p => p.mineId === mineId)?.series ?? []), [site, mineId]);
  const scale = Math.max(1, ...outlook.months.flatMap(p => [p.plan, p.forecastP90 ?? p.forecastP50])) * 1.08;
  const position = (value: number) => value / scale * 100;
  const gap = outlook.balance < 0;

  return (
    <section className="glass production-outlook" aria-label="90-day production outlook">
      <header><h2>90-day outlook</h2><span className="outlook-demo">Demo data</span></header>
      <button className="outlook-mine" title={`View ${mine?.name}`} onClick={() => {
        const state = useDrishti.getState();
        state.selectMine(mineId);
        if (state.view === 'GLOBE' || state.view === 'FLAT') state.setView('RELIEF');
      }}><span>{mine?.name ?? 'Mine forecast'}</span><span aria-hidden="true">↗</span></button>
      {outlook.months.length ? <>
        <dl className="outlook-totals">
          <div><dt>Forecast total</dt><dd>{formatTonnes(outlook.forecast)}</dd></div>
          <div><dt>{outlook.balance > 0 ? 'Above target' : 'Gap to target'}</dt>
            <dd className={gap ? 'outlook-gap' : ''}>{formatTonnes(Math.abs(outlook.balance))}</dd></div>
        </dl>
        <div className="outlook-legend"><span><i />Forecast</span><span><b />Target</span><span><em />Range</span></div>
        <div className="outlook-months">
          {outlook.months.map(p => {
            const lower = p.forecastP10 ?? p.forecastP50, upper = p.forecastP90 ?? p.forecastP50;
            const label = `${monthName(p.month)} ${p.month.slice(0,4)}: forecast ${formatTonnes(p.forecastP50)}, target ${formatTonnes(p.plan)}, model range ${formatTonnes(lower)} to ${formatTonnes(upper)}`;
            return <div className="outlook-month" key={p.month}>
              <span>{monthName(p.month)}</span>
              <svg viewBox="0 0 100 16" preserveAspectRatio="none" role="img" aria-label={label}>
                <title>{label}</title>
                <rect x="0" y="4" width="100" height="8" rx="2" fill="var(--panel-hi)" />
                <rect x="0" y="4" width={position(p.forecastP50)} height="8" rx="2" fill="var(--ore-80)" />
                <path d={`M${position(lower)} 8H${position(upper)} M${position(lower)} 6v4 M${position(upper)} 6v4`} stroke="var(--ore-100)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <path d={`M${position(p.plan)} 1v14`} stroke="var(--text)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              </svg>
              <span className="outlook-month-value" title={formatTonnes(p.forecastP50)}>{(p.forecastP50 / 1000).toFixed(1)}k t</span>
            </div>;
          })}
        </div>
        <p className="outlook-signal">{outlook.belowTarget ? `${outlook.belowTarget}/${outlook.months.length} months below target · ${monthName(outlook.worstMonth!)} largest gap` : 'Forecast meets each monthly target'}</p>
        <footer title="Forecast uses the median estimate; range is the model’s 10th–90th percentiles. Production data is synthetic, not a validated operational forecast.">
          Issued {TODAY_ISO} · tonnes<br />Synthetic forecast · range is illustrative
        </footer>
      </> : <p className="outlook-empty">{site ? 'No forecast available for this mine.' : 'Loading forecast…'}</p>}
    </section>
  );
}

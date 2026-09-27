import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  ReferenceArea,
  ReferenceLine,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from 'recharts';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { MINES } from '../../data/mines';
import { computeRiskRows } from '../../lib/stats';
import { TODAY_ISO } from '../../data/generate';
import type { GeneratorOutput } from '../../data/generate';

interface Row {
  x: number;
  month: string;
  plan: number | null;
  actual: number | null;
  forecastP10: number | null;
  forecastP90: number | null;
  forecastP50: number | null;
  counterfactualP50: number | null;
  [otherMineP50: `p50_${string}`]: number | null | number;
}

const HISTORY_WINDOW_MONTHS = 18;
const FORECAST_WINDOW_MONTHS = 3; // ~90 days
// Chosen so the forecast band's x-SPAN is ~40% of the total x-span even though it is only 3 of
// the 21 plotted months — real "18 months back, 90 days forward" charts (this one included)
// don't get that proportion for free from a uniform monthly category axis; it has to come from
// deliberately spacing the forecast x-positions further apart than the history ones, which is
// what a numeric x-axis (rather than Recharts' default category axis) makes possible.
const FORECAST_STRETCH = ((HISTORY_WINDOW_MONTHS - 1) * (0.4 / 0.6)) / FORECAST_WINDOW_MONTHS;

function buildRows(site: GeneratorOutput, selectedMineId: string, lift: number, simActive: boolean) {
  const selected = site.production.find((p) => p.mineId === selectedMineId);
  if (!selected) return { rows: [] as Row[], seamX: 0 };

  // The seam is the last month with a real actual AND the first with a forecast — generate.ts
  // sets both there for line continuity, so it's found the same way regardless of how long the
  // history/forecast arrays are on either side of it.
  const seamIndex = selected.series.findIndex((p) => p.forecastP50 !== null);
  const historyStart = Math.max(0, seamIndex - (HISTORY_WINDOW_MONTHS - 1));
  const others = site.production.filter((p) => p.mineId !== selectedMineId);

  const rows: Row[] = [];
  for (let i = historyStart; i <= seamIndex; i++) {
    const s = selected.series[i];
    const x = i - seamIndex + (HISTORY_WINDOW_MONTHS - 1);
    const row: Row = {
      x,
      month: s.month,
      plan: s.plan,
      actual: s.actual,
      forecastP10: i === seamIndex ? s.forecastP10 : null,
      forecastP90: i === seamIndex ? s.forecastP90 : null,
      forecastP50: i === seamIndex ? s.forecastP50 : null,
      counterfactualP50: i === seamIndex && simActive && s.forecastP50 !== null ? s.forecastP50 * (1 + lift) : null,
    };
    for (const other of others) {
      const pt = other.series[i];
      row[`p50_${other.mineId}`] = pt.actual ?? pt.forecastP50 ?? null;
    }
    rows.push(row);
  }

  const seamX = HISTORY_WINDOW_MONTHS - 1;
  for (let h = 1; h <= FORECAST_WINDOW_MONTHS; h++) {
    const i = seamIndex + h;
    const s = selected.series[i];
    if (!s) break;
    const x = seamX + h * FORECAST_STRETCH;
    const row: Row = {
      x,
      month: s.month,
      plan: s.plan,
      actual: null,
      forecastP10: s.forecastP10,
      forecastP90: s.forecastP90,
      forecastP50: s.forecastP50,
      counterfactualP50: simActive && s.forecastP50 !== null ? s.forecastP50 * (1 + lift) : null,
    };
    for (const other of others) {
      const pt = other.series[i];
      row[`p50_${other.mineId}`] = pt.actual ?? pt.forecastP50 ?? null;
    }
    rows.push(row);
  }

  return { rows, seamX };
}

export function ProductionForecast() {
  const site = useSiteData();
  const simulationActive = useDrishti((s) => s.simulationActive);
  const simulationLift = useDrishti((s) => s.simulationLift);
  const scenarios = useDrishti((s) => s.scenarios);
  const selectedMine = useDrishti((s) => s.selectedMine);
  const [localMine, setLocalMine] = useState('balaghat');
  const mineId = selectedMine ?? localMine;

  const { rows, seamX } = useMemo(() => {
    if (!site) return { rows: [] as Row[], seamX: 0 };
    return buildRows(site, mineId, simulationLift, simulationActive);
  }, [site, mineId, simulationLift, simulationActive]);

  const tickMap = useMemo(() => new Map(rows.map((r) => [r.x, r.month])), [rows]);

  const shortfallRanges = useMemo(() => {
    const ranges: [number, number][] = [];
    let start: number | null = null;
    for (const r of rows) {
      // A scenario toggle must visibly change this chart (Part III §5.3): when a what-if
      // is active, a point also counts as "in shortfall" if the SIMULATED P50 alone drops
      // below plan, even where the baseline P90 didn't. That is what makes "Monsoon event"
      // read as the band dropping, rather than a barely-there extra dashed line.
      const baselineShortfall = r.forecastP90 !== null && r.forecastP90 < (r.plan ?? Infinity);
      const simulatedShortfall =
        simulationActive && r.counterfactualP50 !== null && r.counterfactualP50 < (r.plan ?? Infinity);
      const inShortfall = baselineShortfall || simulatedShortfall;
      if (inShortfall && start === null) start = r.x;
      if (!inShortfall && start !== null) {
        ranges.push([start, r.x]);
        start = null;
      }
    }
    if (start !== null) ranges.push([start, rows[rows.length - 1].x]);
    return ranges;
  }, [rows, simulationActive]);

  const anchors = useMemo(() => {
    if (!site) return [];
    const risk = computeRiskRows(site);
    const pick = (id: string) => risk.find((r) => r.mineId === id);
    const b = pick('balaghat');
    const k = pick('kandri');
    const d = pick('dongri');
    return [
      { name: 'BALAGHAT', status: b && b.risk !== 'LOW' ? 'PEAK RISK' : 'STABLE', date: b?.peakMonth ?? '—' },
      { name: 'KANDRI', status: k?.risk ?? 'STABLE', date: k?.peakMonth ?? '—' },
      { name: 'DONGRI BUZURG', status: d?.risk ?? 'STABLE', date: d?.peakMonth ?? '—' },
    ];
  }, [site]);

  if (!rows.length || !site) return null;

  const scenarioLabel = scenarios.monsoon
    ? 'WITH MONSOON EVENT'
    : scenarios.equipmentLoss
      ? 'WITH EQUIPMENT LOSS'
      : null;

  return (
    <div className="data" style={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="forecast-header">
        <div className="forecast-heading">
          <span className="label">PRODUCTION FORECAST</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
            18mo history · 90d forward
          </span>
          {scenarioLabel && (
            <span className="mono" style={{ fontSize: 10, color: 'var(--risk-low)' }}>
              · · · {scenarioLabel}
            </span>
          )}
        </div>
        <select
          value={mineId}
          disabled={selectedMine !== null}
          onChange={(e) => setLocalMine(e.target.value)}
          className="mono"
          style={{ background: 'var(--panel-hi)', color: 'var(--text)', border: '1px solid var(--line)', fontSize: 10, padding: '2px 4px' }}
        >
          {MINES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* A soft wash behind the chart interior only — the reference's moody backdrop,
            kept inside this one widget rather than touching the app's shared panel classes. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(120% 100% at 15% 0%, rgba(46,125,140,0.16), transparent 60%), radial-gradient(90% 90% at 100% 100%, rgba(226,98,42,0.09), transparent 55%)',
            pointerEvents: 'none',
          }}
        />
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="pf-band" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ore-40)" stopOpacity={0.38} />
                <stop offset="55%" stopColor="var(--ore-40)" stopOpacity={0.16} />
                <stop offset="100%" stopColor="var(--ore-20)" stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id="pf-shortfall" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--risk-high)" stopOpacity={0} />
                <stop offset="18%" stopColor="var(--risk-high)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--risk-high)" stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id="pf-actual-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--text-mute)" stopOpacity={0.14} />
                <stop offset="100%" stopColor="var(--text-mute)" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* The neon-console read — faint glowing gridlines behind the data, not just the
                lines glowing in isolation against plain black. */}
            <CartesianGrid stroke="var(--ore-40)" strokeOpacity={0.14} strokeDasharray="2 6" />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={rows.filter((_, i) => i % 3 === 0 || rows[i]?.x === seamX).map((r) => r.x)}
              tickFormatter={(x) => tickMap.get(x) ?? ''}
              tick={{ fontSize: 10, fill: 'var(--text-mute)' }}
            />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-mute)' }} width={44} />
            {shortfallRanges.map(([x1, x2], i) => (
              <ReferenceArea key={i} x1={x1} x2={x2} fill="url(#pf-shortfall)" stroke="none" />
            ))}
            {/* TODAY — the boundary between real history and the forecast. */}
            <ReferenceLine
              x={seamX}
              stroke="var(--text)"
              strokeDasharray="1 3"
              strokeOpacity={0.6}
              label={{ value: `TODAY ${TODAY_ISO}`, position: 'insideTopLeft', fontSize: 10, fill: 'var(--text-mute)' }}
            />
            {MINES.filter((m) => m.id !== mineId).map((m) => (
              <Line
                key={m.id}
                dataKey={`p50_${m.id}`}
                stroke="var(--text-mute)"
                strokeOpacity={0.22}
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
            ))}
            <Area
              dataKey={(d: Row) => (d.forecastP10 !== null && d.forecastP90 !== null ? [d.forecastP10, d.forecastP90] : null)}
              stroke="var(--ore-40)"
              strokeOpacity={0.35}
              strokeWidth={1}
              fill="url(#pf-band)"
              isAnimationActive={false}
            />
            <Area dataKey="actual" stroke="none" fill="url(#pf-actual-fill)" isAnimationActive={false} activeDot={false} />
            {/* History — grey, de-emphasised (the forecast below is what carries colour), but
                still glowing — the neon treatment shouldn't only exist on the forecast half. */}
            <Line
              dataKey="actual"
              stroke="var(--text-dim)"
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
              style={{ filter: 'drop-shadow(0 0 2px rgba(132,147,162,0.85)) drop-shadow(0 0 6px rgba(132,147,162,0.5))' }}
            />
            <Line
              dataKey="forecastP50"
              stroke="var(--ore-80)"
              strokeDasharray="4 3"
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
              style={{ filter: 'drop-shadow(0 0 2px rgba(226,98,42,0.9)) drop-shadow(0 0 8px rgba(226,98,42,0.6))' }}
            />
            {rows.length > 0 && (
              <ReferenceLine
                segment={[
                  { x: rows[0].x, y: rows[0].plan ?? 0 },
                  { x: rows[rows.length - 1].x, y: rows[rows.length - 1].plan ?? 0 },
                ]}
                stroke="var(--text-mute)"
                strokeDasharray="2 2"
              />
            )}
            {simulationActive && (
              <Line
                dataKey="counterfactualP50"
                stroke={simulationLift < 0 ? 'var(--risk-high)' : 'var(--risk-low)'}
                strokeDasharray="2 2"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
                style={{
                  filter:
                    simulationLift < 0
                      ? 'drop-shadow(0 0 2px rgba(196,72,46,0.9)) drop-shadow(0 0 9px rgba(196,72,46,0.65))'
                      : 'drop-shadow(0 0 2px rgba(62,142,107,0.9)) drop-shadow(0 0 9px rgba(62,142,107,0.65))',
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mono flex justify-between" style={{ fontSize: 10, marginTop: 6 }}>
        {anchors.map((a) => (
          <div key={a.name} style={{ position: 'relative', paddingTop: 8 }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 1,
                height: 6,
                background: 'var(--line-hi)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: -1.5,
                left: -1.5,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'var(--ore-60)',
                boxShadow: '0 0 4px var(--ore-60)',
              }}
            />
            <div style={{ color: 'var(--text)' }}>{a.name}</div>
            <div style={{ color: 'var(--text-dim)' }}>{a.status}</div>
            <div style={{ color: 'var(--text-mute)' }}>{a.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

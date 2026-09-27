import { useMemo, useState } from 'react';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { MINES, type Mine } from '../../data/mines';
import { computeRiskRows, type RiskLevel } from '../../lib/stats';
import { formatPercent } from '../../lib/format';

type SortKey = 'name' | 'district' | 'type' | 'risk';
const PAGE_SIZE = 5;

const RISK_COLOR: Record<RiskLevel, string> = {
  LOW: 'var(--risk-low)',
  WATCH: 'var(--risk-mid)',
  ACT: 'var(--risk-high)',
};

/** A forecast VERDICT, not a present-tense state — "active"/"watch" describes what a mine IS
 *  doing right now; this describes what the model expects over the next 90 days. */
const VERDICT: Record<RiskLevel, string> = {
  LOW: 'ON PLAN',
  WATCH: 'AT RISK',
  ACT: 'WILL MISS',
};

export function MinesTable() {
  const site = useSiteData();
  const selectMine = useDrishti((s) => s.selectMine);
  const setView = useDrishti((s) => s.setView);
  const view = useDrishti((s) => s.view);
  const [sortKey, setSortKey] = useState<SortKey>('risk');
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const risk = site ? computeRiskRows(site) : [];
    const riskById = new Map(risk.map((r) => [r.mineId, r]));
    const merged = MINES.map((m) => ({
      mine: m,
      risk: riskById.get(m.id)?.risk ?? 'LOW',
      shortfallProb: riskById.get(m.id)?.shortfallProb ?? 0,
    }));
    const rank: Record<RiskLevel, number> = { ACT: 0, WATCH: 1, LOW: 2 };
    merged.sort((a, b) => {
      if (sortKey === 'name') return a.mine.name.localeCompare(b.mine.name);
      if (sortKey === 'district') return a.mine.district.localeCompare(b.mine.district);
      if (sortKey === 'type') return a.mine.type.localeCompare(b.mine.type);
      // Tier first, then shortfall probability as a tiebreaker — without it, mines sharing a
      // tier (most of them, at LOW) fell back to MINES' original array order, so a mine with a
      // genuine non-zero risk could render below several strictly-zero ones.
      return rank[a.risk] - rank[b.risk] || b.shortfallProb - a.shortfallProb;
    });
    return merged;
  }, [site, sortKey]);

  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const header = (key: SortKey, label: string) => (
    <button
      onClick={() => setSortKey(key)}
      className="mono"
      style={{ fontSize: 10, color: sortKey === key ? 'var(--text)' : 'var(--text-mute)', textAlign: 'left' }}
    >
      {label} {sortKey === key && '▾'}
    </button>
  );

  return (
    <div className="glass" style={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="label mb-2">MINES · RANKED BY PREDICTED RISK</div>
      <div className="data" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="mono mines-table-grid" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
          <span className="label" style={{ fontSize: 10 }}>
            ID
          </span>
          {header('name', 'MINE')}
          {header('district', 'DISTRICT')}
          {header('type', 'TYPE')}
          <span className="label" style={{ fontSize: 10 }}>
            STATUS
          </span>
          {header('risk', 'RISK')}
        </div>
        {pageRows.map(({ mine, risk, shortfallProb }: { mine: Mine; risk: RiskLevel; shortfallProb: number }) => (
          <div
            key={mine.id}
            onClick={() => {
              selectMine(mine.id);
              if (view === 'GLOBE' || view === 'FLAT') setView('RELIEF');
            }}
            className="mono mines-table-grid mines-table-row"
          >
            <span style={{ color: 'var(--text-mute)' }}>{mine.id.slice(0, 3).toUpperCase()}</span>
            <span style={{ color: 'var(--text)' }}>{mine.name}</span>
            <span style={{ color: 'var(--text-dim)' }}>{mine.district}</span>
            <span style={{ color: 'var(--text-dim)' }}>{mine.type}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, flexShrink: 0, borderRadius: '50%', background: RISK_COLOR[risk] }} />
              <span style={{ color: 'var(--text-dim)' }}>{VERDICT[risk]}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 24, flexShrink: 0, height: 4, background: 'var(--line-hi)' }}>
                <div style={{ width: `${shortfallProb * 100}%`, height: 4, background: RISK_COLOR[risk] }} />
              </div>
              <span style={{ color: 'var(--text-dim)' }}>{formatPercent(shortfallProb)}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mono flex items-center justify-between" style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 8 }}>
        <span>
          {page * PAGE_SIZE + 1}-{Math.min(rows.length, page * PAGE_SIZE + PAGE_SIZE)} of {rows.length} items
        </span>
        <span className="flex items-center gap-2">
          Page {String(page + 1).padStart(2, '0')} of {pageCount}
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            ‹
          </button>
          <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>
            ›
          </button>
        </span>
      </div>
    </div>
  );
}

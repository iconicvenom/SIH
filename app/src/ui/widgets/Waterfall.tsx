import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer } from 'recharts';
import { rampColor } from '../../lib/ramp';

export interface WaterfallItem {
  label: string;
  value: number;
}

/**
 * Domain-agnostic on purpose — reused for both the SHAP driver panel and the operations
 * driver panel. Reusing one visual grammar across both halves of the product is what makes
 * it feel like one system rather than two demos stapled together (Part I §6.7).
 */
export function Waterfall({ items, title }: { items: WaterfallItem[]; title: string }) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const visible = showAll ? sorted : sorted.slice(0, 6);
  const maxAbs = Math.max(...sorted.map((i) => Math.abs(i.value)), 0.001);

  return (
    <div className="data" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
      <div className="label mb-2">{title}</div>
      <ResponsiveContainer width="100%" height={visible.length * 26}>
        <BarChart data={visible} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
          <XAxis type="number" hide domain={[-maxAbs, maxAbs]} />
          <YAxis
            type="category"
            dataKey="label"
            width={140}
            tick={{ fontSize: 12, fill: 'var(--text-dim)' }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="value" barSize={12}>
            {visible.map((item, i) => {
              const [r, g, b] = rampColor(Math.min(1, Math.abs(item.value) * 4));
              return (
                <Cell key={i} fill={item.value >= 0 ? `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})` : '#566472'} />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {sorted.length > 6 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mono"
          style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 4 }}
        >
          {showAll ? 'show top 6' : `show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { useDrishti } from '../store/useDrishti';
import { useSiteData } from '../scene/Canvas3D';
import { liveCamera } from '../scene/CameraRig';
import { globeRotationY } from '../globe/Globe';
import { MINES } from '../data/mines';
import { lonLatToWorld, lonLatToNormal, worldToGrid, GRID } from '../lib/geo';
import { terrainSurfaceY } from '../lib/terrainConstants';
import { computeRiskRows } from '../lib/stats';
import { formatPercent } from '../lib/format';

interface Anchor {
  id: string;
  name: string;
  label: string;
  x: number; // screen px
  y: number;
}

/**
 * Floating callouts anchored to mine pins, connected by leader lines. HARD CAP: two at
 * once, with simple collision avoidance — four overlapping callouts are unreadable
 * (Part III §7). Lives outside the R3F canvas so it can share DOM stacking with the glass
 * panels; it projects world positions through the camera CameraRig publishes.
 */
export function GlobeCallouts() {
  const view = useDrishti((s) => s.view);
  const selectedMine = useDrishti((s) => s.selectedMine);
  const site = useSiteData();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      setTick((t) => (t + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const topRiskId = useMemo(() => {
    if (!site) return null;
    const rows = computeRiskRows(site);
    return rows[0]?.mineId ?? null;
  }, [site]);

  const targets = useMemo(() => {
    const ids = new Set<string>();
    if (selectedMine) ids.add(selectedMine);
    if (topRiskId) ids.add(topRiskId);
    return Array.from(ids).slice(0, 2); // hard cap
  }, [selectedMine, topRiskId]);

  const anchors: Anchor[] = useMemo(() => {
    const camera = liveCamera.current;
    if (!camera || (view !== 'GLOBE' && view !== 'RELIEF' && view !== 'FLAT')) return [];
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rows = site ? computeRiskRows(site) : [];

    const out: Anchor[] = [];
    for (const id of targets) {
      const mine = MINES.find((m) => m.id === id);
      if (!mine) continue;
      const world = new Vector3();
      if (view === 'GLOBE') {
        const [nx, ny, nz] = lonLatToNormal(mine.lon, mine.lat);
        // The globe spins; rotate the mine's static lon/lat position by the same angle
        // the globe's rigid group has turned so far, or the callout drifts off the
        // textured surface (standard Y-axis rotation matrix, matching Globe.tsx).
        const theta = globeRotationY.current;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const rx = nx * cos + nz * sin;
        const rz = -nx * sin + nz * cos;
        world.set(rx * 1.06, ny * 1.06, rz * 1.06);
      } else {
        const [x, z] = lonLatToWorld(mine.lon, mine.lat);
        // FLAT genuinely flattens the terrain (V.E. 0), so Y=0 is correct there — but RELIEF
        // displaces it by real elevation, and a callout anchored at Y=0 there can end up
        // rendering into the dark ground behind/below the actual (raised) surface instead of
        // sitting on top of it. terrainSurfaceY() is this app's one formula for terrain height
        // in world units (lib/terrainConstants.ts) — nothing should re-derive it, this included.
        let y = 0;
        if (view === 'RELIEF' && site) {
          const [gx, gz] = worldToGrid(x, z);
          y = terrainSurfaceY(site.elevation[gz * GRID + gx]);
        }
        world.set(x, y, z);
      }
      world.project(camera);
      if (world.z > 1) continue; // behind camera / behind the globe
      const x = (world.x * 0.5 + 0.5) * w;
      const y = (-world.y * 0.5 + 0.5) * h;
      const row = rows.find((r) => r.mineId === id);
      const label = row ? `Shortfall ${formatPercent(row.shortfallProb)}` : 'Selected';
      out.push({ id, name: mine.name, label, x, y });
    }

    // Simple collision avoidance: nudge the second callout clear if it overlaps the first.
    if (out.length === 2) {
      const [a, b] = out;
      if (Math.abs(a.x - b.x) < 160 && Math.abs(a.y - b.y) < 60) {
        b.y += 70;
      }
    }
    return out;
  }, [targets, view, site, tick]);

  // The globe is the spacecraft overview. Keep production-risk callouts on the
  // local mine maps so they cannot cover the moving spacecraft.
  if (view === 'GLOBE' || anchors.length === 0) return null;

  return (
    <svg className="absolute inset-0" style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>
      {anchors.map((a) => (
        <g key={a.id}>
          <line x1={a.x} y1={a.y} x2={a.x + 46} y2={a.y - 30} stroke="var(--text-mute)" strokeWidth={0.8} />
          <circle cx={a.x} cy={a.y} r={2.5} fill="var(--rhodonite)" />
          <foreignObject x={a.x + 46} y={a.y - 54} width={160} height={40}>
            <div className="glass mono" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--text)' }}>
              <div>{a.name}</div>
              <div style={{ color: 'var(--text-mute)', fontSize: 10 }}>{a.label}</div>
            </div>
          </foreignObject>
        </g>
      ))}
    </svg>
  );
}

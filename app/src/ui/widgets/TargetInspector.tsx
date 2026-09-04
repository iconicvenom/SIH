import { useEffect, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { useSiteData } from '../../scene/Canvas3D';
import { useDrishti } from '../../store/useDrishti';
import { liveCamera } from '../../scene/CameraRig';
import { MINES } from '../../data/mines';
import { lonLatToWorld, haversineKm, GRID } from '../../lib/geo';
import { terrainSurfaceY } from '../../lib/terrainConstants';
import { formatCoord, formatProbability } from '../../lib/format';
import { DepthProfile } from './DepthProfile';
import type { GeneratorOutput } from '../../data/generate';

function estimateHorizonDepth(site: GeneratorOutput, x: number, z: number): number {
  let bestDepth = 0;
  let bestP = -1;
  for (let d = 0; d <= 240; d += 5) {
    const p = site.probabilityAt(x, z, d);
    if (p > bestP) {
      bestP = p;
      bestDepth = d;
    }
  }
  return bestDepth;
}

function nearestMine(lon: number, lat: number): { name: string; km: number } {
  let best = { name: MINES[0].name, km: Infinity };
  for (const m of MINES) {
    const km = haversineKm(lon, lat, m.lon, m.lat);
    if (km < best.km) best = { name: m.name, km };
  }
  return best;
}

/**
 * A floating callout at the clicked point itself — same leader-line-and-dot device
 * GlobeCallouts.tsx uses for mine markers, anchored at the real terrain surface height via
 * terrainSurfaceY() (lib/terrainConstants.ts) in RELIEF, Y=0 in FLAT where the terrain is
 * intentionally flattened. Lives outside the R3F canvas, projected
 * through the camera CameraRig publishes, redrawn every frame so it tracks camera drag/zoom —
 * this used to be a static RightRail panel with a "click a cell to inspect" placeholder; now it
 * only exists at all once there is something to inspect, right where you clicked it. Depth
 * Profile rides along inside the same card — one click, everything about that point in one
 * place, rather than a second look-up in a rail panel elsewhere on screen.
 *
 * Probability and ranking only. Never a tonnage estimate — that would be a reserve claim.
 */
export function TargetInspector() {
  const site = useSiteData();
  const view = useDrishti((s) => s.view);
  const selectedCell = useDrishti((s) => s.selectedCell);
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

  const info = useMemo(() => {
    if (!site || !selectedCell) return null;
    const [x, z] = lonLatToWorld(selectedCell.lon, selectedCell.lat);
    const idx = selectedCell.gz * GRID + selectedCell.gx;
    const p = site.prospectivity[idx];
    const confidence = site.confidence[idx];
    const ciWidth = (1 - confidence) * 0.2;
    const depth = estimateHorizonDepth(site, x, z);
    const nearest = nearestMine(selectedCell.lon, selectedCell.lat);
    return { x, z, elev: site.elevation[idx], p, ciWidth, depth, nearest };
  }, [site, selectedCell]);

  const anchor = useMemo(() => {
    const camera = liveCamera.current;
    if (!camera || !info || (view !== 'RELIEF' && view !== 'FLAT')) return null;
    // selectedCell.y, when present, is the exact terrain-click raycast hit — sub-cell accurate,
    // unlike terrainSurfaceY(info.elev) which snaps to the nearest of 256×256 grid samples and
    // visibly drifts from the true click point on a slope. Only a target picked from a list
    // (no live raycast behind it) falls back to the quantised cell elevation.
    const y = view === 'RELIEF' ? (selectedCell?.y ?? terrainSurfaceY(info.elev)) : 0;
    const world = new Vector3(info.x, y, info.z);
    world.project(camera);
    if (world.z > 1) return null; // behind camera
    return {
      x: (world.x * 0.5 + 0.5) * window.innerWidth,
      y: (-world.y * 0.5 + 0.5) * window.innerHeight,
    };
  }, [info, view, tick]);

  if (!selectedCell || !info || !anchor) return null;

  const CARD_W = 240;
  // Depth Profile is 25 bench rows — the card is much taller now than a coordinates-and-a-
  // button popup, so it can no longer assume it fits above the click point. Centre it on the
  // click vertically and clamp within the viewport instead; overflowY on the card itself is
  // the last-resort fallback for a short window rather than the normal case.
  const CARD_H = Math.min(620, window.innerHeight - 20);
  const flip = anchor.x + CARD_W + 46 > window.innerWidth;
  const dx = flip ? -CARD_W - 46 : 46;
  const cardTop = Math.max(10, Math.min(anchor.y - CARD_H / 2, window.innerHeight - CARD_H - 10));
  const leaderY = Math.max(cardTop + 20, Math.min(anchor.y, cardTop + CARD_H - 20));

  return (
    <svg className="absolute inset-0" style={{ pointerEvents: 'none', width: '100%', height: '100%', zIndex: 20 }}>
      <line
        x1={anchor.x}
        y1={anchor.y}
        x2={flip ? anchor.x + dx + CARD_W : anchor.x + dx}
        y2={leaderY}
        stroke="var(--text-mute)"
        strokeWidth={0.8}
      />
      <circle cx={anchor.x} cy={anchor.y} r={3} fill="var(--rhodonite)" />
      <foreignObject x={anchor.x + dx} y={cardTop} width={CARD_W} height={CARD_H}>
        <div className="glass mono" style={{ padding: 0, pointerEvents: 'auto', maxHeight: CARD_H, overflowY: 'auto' }}>
          <div style={{ padding: 12 }}>
            <div className="label mb-2">TARGET INSPECTOR</div>
            <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text)' }}>
              <div>
                {formatCoord(selectedCell.lon)} E &nbsp; {formatCoord(selectedCell.lat)} N
              </div>
              <div>
                p {formatProbability(info.p)} ± {info.ciWidth.toFixed(3)}
              </div>
              <div>est. horizon depth {info.depth} m</div>
              <div>
                nearest known mine: {info.nearest.name} ({info.nearest.km.toFixed(1)} km)
              </div>
            </div>
          </div>
          <DepthProfile />
        </div>
      </foreignObject>
    </svg>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
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
import './TargetInspector.css';

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

function projectTarget(point: Vector3) {
  const camera = liveCamera.current;
  if (!camera) return null;
  const projected = point.clone().project(camera);
  if (!Number.isFinite(projected.x + projected.y + projected.z) || Math.abs(projected.z) > 1) return null;
  return {
    x: (projected.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** A readable 2D callout attached to the selected scene point as the camera moves. */
export function TargetInspector() {
  const site = useSiteData();
  const view = useDrishti((s) => s.view);
  const selectedCell = useDrishti((s) => s.selectedCell);
  const [, setTick] = useState(0);
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    if (selectedCell && view !== 'GLOBE') dialog.current?.focus({ preventScroll: true });
  }, [selectedCell, view]);

  useEffect(() => {
    if (!selectedCell || view === 'GLOBE') return;
    let raf: number;
    const loop = () => {
      setTick((t) => (t + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [selectedCell, view]);

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

  const target = useMemo(() => {
    if (!info || view === 'GLOBE') return null;
    // selectedCell.y, when present, is the exact terrain-click raycast hit — sub-cell accurate,
    // unlike terrainSurfaceY(info.elev) which snaps to the nearest of 256×256 grid samples and
    // visibly drifts from the true click point on a slope. Only a target picked from a list
    // (no live raycast behind it) falls back to the quantised cell elevation.
    const y = view === 'RELIEF' ? (selectedCell?.y ?? terrainSurfaceY(info.elev))
      : view === 'FLAT' ? 0 : -info.depth;
    return new Vector3(info.x, y, info.z);
  }, [info, selectedCell, view]);
  // Capture the starting position once per target/view, so orbiting cannot flip
  // the callout to the opposite side of the point halfway through a gesture.
  const initialAnchor = useMemo(() => target ? projectTarget(target) : null, [target]);
  const anchor = target ? projectTarget(target) : null;

  // The selected spot owns the dialog. Losing its on-screen anchor must not hide it.
  if (!selectedCell || !info || view === 'GLOBE') return null;

  // Keep the inspector inside the map's free space, including when the responsive
  // toolbar wraps. The depth log fits the available height without scrolling.
  const leftRail = document.querySelector('.dashboard-left')?.getBoundingClientRect();
  const rightRail = document.querySelector('.dashboard-right')?.getBoundingClientRect();
  const toolbar = document.querySelector('.scene-toolbar')?.getBoundingClientRect();
  const safeLeft = (leftRail?.right ?? 0) + 12;
  const safeRight = (rightRail?.left ?? window.innerWidth) - 12;
  const safeTop = leftRail?.top ?? 12;
  const safeBottom = (toolbar?.top ?? window.innerHeight) - 12;
  const CARD_W = Math.min(264, Math.max(160, safeRight - safeLeft));
  const CARD_H = Math.max(96, Math.min(450, safeBottom - safeTop));
  const origin = initialAnchor ?? { x: (safeLeft + safeRight) / 2, y: (safeTop + safeBottom) / 2 };
  const onLeft = origin.x > (safeLeft + safeRight) / 2;
  const initialLeft = clamp(origin.x + (onLeft ? -CARD_W - 28 : 28), safeLeft, safeRight - CARD_W);
  const initialTop = clamp(origin.y - CARD_H * 0.65, safeTop, safeBottom - CARD_H);
  const cardLeft = clamp(initialLeft + (anchor ? anchor.x - origin.x : 0), safeLeft, safeRight - CARD_W);
  const cardTop = clamp(initialTop + (anchor ? anchor.y - origin.y : 0), safeTop, safeBottom - CARD_H);
  const connectorX = onLeft ? cardLeft + CARD_W : cardLeft;
  const connectorY = clamp(anchor?.y ?? cardTop + 28, cardTop + 22, cardTop + CARD_H - 22);

  return (
    <>
    {anchor && <svg aria-hidden="true" className="absolute inset-0" style={{ pointerEvents: 'none', width: '100%', height: '100%', zIndex: 20 }}>
      <defs><clipPath id="target-callout-map-bounds"><rect x={safeLeft} y={safeTop} width={safeRight - safeLeft} height={safeBottom - safeTop} /></clipPath></defs>
      <g clipPath="url(#target-callout-map-bounds)">
        <path data-target-connector="" d={`M ${anchor.x} ${anchor.y} L ${connectorX + (onLeft ? 12 : -12)} ${connectorY} L ${connectorX} ${connectorY}`}
          fill="none" stroke="var(--text-dim)" strokeWidth={1} opacity={0.8} />
        <circle data-target-anchor="" cx={anchor.x} cy={anchor.y} r={3} fill="var(--ore-100)" stroke="var(--void)" strokeWidth={1} />
      </g>
    </svg>}
        <section ref={dialog} role="dialog" aria-label="Target inspector" aria-modal="false" tabIndex={-1}
          data-target-inspector="" className="glass target-inspector"
          onKeyDown={event => {
            if (event.key === 'Escape') { event.stopPropagation(); useDrishti.getState().selectCell(null); }
          }}
          style={{ position: 'absolute', left: cardLeft, top: cardTop, width: CARD_W,
            height: CARD_H, pointerEvents: 'auto', zIndex: 22 }}>
          <div className="target-inspector-summary">
            <header><h2>Target inspection</h2>
              <button aria-label="Close target inspector" onClick={() => useDrishti.getState().selectCell(null)}>×</button>
            </header>
            <p className="target-inspector-coordinates mono">{formatCoord(selectedCell.lon)}° E · {formatCoord(selectedCell.lat)}° N</p>
            <dl className="target-inspector-readings">
              <div><dt>Potential score · 0–1</dt><dd>{formatProbability(info.p)}</dd>
                <small title="Synthetic confidence proxy; not a measured confidence interval">± {info.ciWidth.toFixed(3)} spread proxy</small></div>
              <div><dt>Peak model depth</dt><dd>{info.depth}<span> m</span></dd><small>Below the surface</small></div>
            </dl>
            <p className="target-inspector-nearest"><span>Nearest mine</span>{info.nearest.name} · {info.nearest.km.toFixed(1)} km</p>
          </div>
          <DepthProfile />
        </section>
    </>
  );
}

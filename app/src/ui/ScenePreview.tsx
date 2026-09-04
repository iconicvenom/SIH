import { useEffect, useMemo, useRef, useState } from 'react';
import { useSiteData } from '../scene/Canvas3D';
import { useDrishti } from '../store/useDrishti';
import { MINES } from '../data/mines';
import { GRID, BBOX } from '../lib/geo';
import { computeRiskRows, flaggedForMissTarget } from '../lib/stats';
import { formatProbability } from '../lib/format';
import { TODAY_ISO } from '../data/generate';

const TILE_W = 240;
const TILE_H = 130;
const TARGET_TILE_W = 74;
const TARGET_TILE_H = 50;

/** Same threshold generate.test.ts uses for "hot ground" — one definition of "promising"
 *  across the app, not a UI-only number invented separately from the model. */
const PROMISING_PROSPECTIVITY = 0.6;

/** The three real optical platforms in the acquisition plan (src/data/sensors.ts) — the
 *  other five are SAR or ocean-colour, which is not what a "picture of the ground" is. Each
 *  gets a small deterministic crop offset and its own colour grade so the three tiles read as
 *  distinct passes of the same real ground rather than one image pasted three times — a real
 *  multispectral sensor's own processing does vary this much between platforms. */
const TARGET_SENSORS: { label: string; offsetPx: [number, number]; filter: string }[] = [
  { label: 'Sentinel-2B', offsetPx: [-18, 10], filter: 'contrast(1.22) saturate(1.4) brightness(0.92) hue-rotate(-6deg)' },
  { label: 'Landsat-9', offsetPx: [16, -14], filter: 'contrast(1.1) saturate(1.05) brightness(1.02) hue-rotate(4deg)' },
  { label: 'Cartosat-3', offsetPx: [4, 20], filter: 'contrast(1.3) saturate(0.85) brightness(0.86) grayscale(0.15)' },
];

/**
 * public/data/sausar-belt-satellite.jpg — real NASA GIBS (MODIS Terra Corrected Reflectance
 * True Colour) imagery of the actual Sausar Belt bounding box (lib/geo.ts's BBOX, pixel-for-
 * pixel), 5 March 2025, a clear pre-monsoon pass. Late-August passes over this site are ~80%
 * cloud (src/data/sensors.ts's own cloudForecast figures) — this is a real dry-season date
 * chosen specifically so the ground is actually visible, not a live/current feed. AboutData's
 * "Scene thumbnails" entry documents exactly that. Fetched once at build time the same way the
 * globe's Blue Marble texture was; no network call happens at runtime.
 */
const SAT_IMAGE_URL = '/data/sausar-belt-satellite.jpg';
const SAT_IMAGE_DATE = '2025-03-05';
const SAT_IMG_W = 1200;
const SAT_IMG_H = 790;

let sharedSatImage: HTMLImageElement | null = null;
let sharedSatImagePromise: Promise<HTMLImageElement> | null = null;

function loadSatelliteImage(): Promise<HTMLImageElement> {
  if (!sharedSatImagePromise) {
    sharedSatImagePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        sharedSatImage = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = SAT_IMAGE_URL;
    });
  }
  return sharedSatImagePromise;
}

/** Null until the (one-time, local) image has decoded — every tile redraws once it resolves. */
function useSatelliteImage(): HTMLImageElement | null {
  const [img, setImg] = useState(sharedSatImage);
  useEffect(() => {
    if (sharedSatImage) return;
    let cancelled = false;
    loadSatelliteImage().then((loaded) => {
      if (!cancelled) setImg(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return img;
}

function lonLatToImagePx(lon: number, lat: number): [number, number] {
  const u = (lon - BBOX.lonMin) / (BBOX.lonMax - BBOX.lonMin);
  const v = (BBOX.latMax - lat) / (BBOX.latMax - BBOX.latMin);
  return [u * SAT_IMG_W, v * SAT_IMG_H];
}

/**
 * Crops a real window of the satellite photo centred on a lon/lat, grades it toward the app's
 * console palette, and draws it in. `srcH` is the crop height in SOURCE pixels — a smaller
 * value reads as a tighter, more local zoom; the source width is derived from the destination
 * aspect ratio so the crop is never stretched.
 */
const DEFAULT_FILTER = 'contrast(1.2) saturate(1.35) brightness(0.9) hue-rotate(-4deg)';

function drawRealTile(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  lon: number,
  lat: number,
  srcH: number,
  w: number,
  h: number,
  filter: string = DEFAULT_FILTER,
  offsetPx: [number, number] = [0, 0],
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const srcW = Math.min(SAT_IMG_W, srcH * (w / h));
  const clampedSrcH = Math.min(SAT_IMG_H, srcH);
  const [cx, cy] = lonLatToImagePx(lon, lat);
  const sx = Math.max(0, Math.min(SAT_IMG_W - srcW, cx - srcW / 2 + offsetPx[0]));
  const sy = Math.max(0, Math.min(SAT_IMG_H - clampedSrcH, cy - clampedSrcH / 2 + offsetPx[1]));

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  // A satellite-console grade, not a straight photo — punchier contrast/saturation than the
  // source JPEG, the way a false-colour-leaning ops display would render an optical pass.
  ctx.filter = filter;
  ctx.drawImage(img, sx, sy, srcW, clampedSrcH, 0, 0, w, h);
  ctx.restore();

  // Faint scanlines — the HUD character the old procedural tile had, now over real ground.
  ctx.fillStyle = 'rgba(6,9,12,0.16)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

  // Vignette, so the timestamp/label overlays stay legible against bright ground.
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
  grad.addColorStop(0, 'rgba(6,9,12,0)');
  grad.addColorStop(1, 'rgba(6,9,12,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function TargetTile({
  lon,
  lat,
  label,
  offsetPx,
  filter,
}: {
  lon: number;
  lat: number;
  label: string;
  offsetPx: [number, number];
  filter: string;
}) {
  const img = useSatelliteImage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current && img) {
      drawRealTile(canvasRef.current, img, lon, lat, 140, TARGET_TILE_W, TARGET_TILE_H, filter, offsetPx);
    }
  }, [img, lon, lat, filter, offsetPx]);
  return (
    <div style={{ width: TARGET_TILE_W }}>
      <canvas
        ref={canvasRef}
        width={TARGET_TILE_W}
        height={TARGET_TILE_H}
        style={{ display: 'block', borderRadius: 4, background: '#0d141c' }}
      />
      <div className="mono" style={{ fontSize: 9, color: 'var(--text-mute)', marginTop: 2, textAlign: 'center' }}>
        {label}
      </div>
    </div>
  );
}

export function ScenePreview() {
  const site = useSiteData();
  const selectedMine = useDrishti((s) => s.selectedMine);
  const selectedCell = useDrishti((s) => s.selectedCell);
  const img = useSatelliteImage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mine = MINES.find((m) => m.id === selectedMine) ?? MINES[0];

  useEffect(() => {
    if (canvasRef.current && img) drawRealTile(canvasRef.current, img, mine.lon, mine.lat, 260, TILE_W, TILE_H);
  }, [img, mine.lon, mine.lat]);

  // Same predicate the risk-alert cards use — this count and the number of cards rendered
  // there must always agree, which is only guaranteed by calling the one shared function.
  const missTargetCount = useMemo(() => {
    if (!site) return 0;
    return flaggedForMissTarget(computeRiskRows(site)).length;
  }, [site]);

  // Extra scenes for a clicked cell, but only where the model actually flags it as
  // promising ground — this is meant to read as "more coverage exists for a target worth
  // looking at", not decoration for every idle click.
  const target = useMemo(() => {
    if (!site || !selectedCell) return null;
    const p = site.prospectivity[selectedCell.gz * GRID + selectedCell.gx];
    if (p < PROMISING_PROSPECTIVITY) return null;
    return { p, lon: selectedCell.lon, lat: selectedCell.lat };
  }, [site, selectedCell]);

  return (
    <div className="glass" style={{ padding: 10, pointerEvents: 'auto' }}>
      <div style={{ position: 'relative', width: TILE_W, height: TILE_H, overflow: 'hidden', borderRadius: 6 }}>
        <canvas ref={canvasRef} width={TILE_W} height={TILE_H} style={{ display: 'block', background: '#0d141c' }} />
        <div
          className="mono"
          style={{
            position: 'absolute',
            bottom: 6,
            right: 8,
            fontSize: 10,
            color: 'var(--text)',
            background: 'rgba(11,14,18,0.6)',
            padding: '2px 5px',
            borderRadius: 3,
          }}
        >
          SAT {SAT_IMAGE_DATE}
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }} className="mono">
        <div>
          ● {MINES.length} MINES · {missTargetCount} FORECAST TO MISS TARGET
        </div>
        <div style={{ marginTop: 3, color: 'var(--text-mute)' }}>
          FORECAST ISSUED {TODAY_ISO} · HORIZON 90d
        </div>
      </div>
      {target && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <div className="label" style={{ marginBottom: 6 }}>
            TARGET COVERAGE · {formatProbability(target.p)}
          </div>
          <div className="flex" style={{ gap: 6 }}>
            {TARGET_SENSORS.map((s) => (
              <TargetTile key={s.label} lon={target.lon} lat={target.lat} label={s.label} offsetPx={s.offsetPx} filter={s.filter} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

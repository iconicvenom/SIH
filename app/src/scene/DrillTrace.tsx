import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { Color } from 'three';
import { useSiteData } from './Canvas3D';
import { useDrishti } from '../store/useDrishti';
import { rampColor } from '../lib/ramp';
import { GRID, WORLD_SIZE } from '../lib/geo';

const DEPTHS = Array.from({ length: 25 }, (_, i) => i * 10); // 0..240 step 10

/**
 * The strip log — the single most recognisable artefact in exploration geology. Samples
 * the SAME probabilityAt(x,z,depth) the DepthProfile widget uses at the same 25 depths,
 * so the two can never visually disagree (an acceptance criterion).
 */
export function DrillTrace() {
  const site = useSiteData();
  const view = useDrishti((s) => s.view);
  const selectedCell = useDrishti((s) => s.selectedCell);
  const hoveredDepth = useDrishti((s) => s.hoveredDepth);
  const setHoveredDepth = useDrishti((s) => s.setHoveredDepth);

  const trace = useMemo(() => {
    if (!site || !selectedCell) return null;
    const x = (selectedCell.gx / GRID - 0.5) * WORLD_SIZE;
    const z = (0.5 - selectedCell.gz / GRID) * WORLD_SIZE;
    return DEPTHS.map((depth) => {
      const p = site.probabilityAt(x, z, depth);
      const [r, g, b] = rampColor(p);
      // Raw 0..1 tuple for drei's <Line vertexColors>, a proper Color instance for the
      // per-tick material — a plain array is not a valid THREE.Color.set() argument.
      return { point: [x, -depth, z] as [number, number, number], rgb: [r, g, b] as [number, number, number], color: new Color(r, g, b), p, depth };
    });
  }, [site, selectedCell]);

  if (!trace || (view !== 'BLOCK' && view !== 'SUBSURFACE')) return null;

  return (
    <group>
      <Line points={trace.map((t) => t.point)} vertexColors={trace.map((t) => t.rgb)} lineWidth={2} />
      {trace.map((t) => {
        const hovered = hoveredDepth === t.depth;
        return (
          <mesh
            key={t.depth}
            position={t.point}
            scale={hovered ? 1.6 : 1}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredDepth(t.depth);
            }}
            onPointerOut={() => setHoveredDepth(null)}
          >
            <boxGeometry args={[6, 1.5, 6]} />
            <meshBasicMaterial color={t.color} />
          </mesh>
        );
      })}
    </group>
  );
}

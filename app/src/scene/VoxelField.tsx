import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  ShaderMaterial,
  InstancedMesh,
  InstancedBufferAttribute,
  DynamicDrawUsage,
} from 'three';
import { useSiteData } from './Canvas3D';
import { useDrishti } from '../store/useDrishti';
import { buildVoxelInstances, BLOCK_W, BLOCK_H, type VoxelInstances } from './voxelBuild';
import { GRID, WORLD_SIZE } from '../lib/geo';
import oreRampGlsl from './shaders/oreRamp.glsl?raw';
import voxelVert from './shaders/voxel.vert.glsl?raw';
import voxelFragBody from './shaders/voxel.frag.glsl?raw';

const BLOOM_MS = 2600;

function uploadVoxelAttributes(mesh: InstancedMesh, instances: VoxelInstances) {
  const attrs: [string, Float32Array, number][] = [
    ['aProbability', instances.aProbability, 1],
    ['aConfidence', instances.aConfidence, 1],
    ['aDelay', instances.aDelay, 1],
    ['aTargetPos', instances.aTargetPos, 3],
    ['aSourcePos', instances.aSourcePos, 3],
    ['aDepthIndex', instances.aDepthIndex, 1],
  ];
  for (const [name, data, size] of attrs) {
    const attr = new InstancedBufferAttribute(data, size);
    attr.setUsage(DynamicDrawUsage);
    mesh.geometry.setAttribute(name, attr);
  }
  mesh.count = instances.count;
  mesh.instanceMatrix.needsUpdate = false; // identity for every instance; position lives in-shader
}

export function VoxelField() {
  const site = useSiteData();
  const view = useDrishti((s) => s.view);
  const cutoff = useDrishti((s) => s.cutoff);
  const depthRange = useDrishti((s) => s.depthRange);
  const selectedCell = useDrishti((s) => s.selectedCell);
  const reducedMotion = useDrishti((s) => s.reducedMotion);
  const meshRef = useRef<InstancedMesh>(null);
  const elapsed = useRef(0);
  const lastView = useRef(view);

  const clickWorld = useMemo<[number, number]>(() => {
    if (!selectedCell) return [0, 0];
    return [(selectedCell.gx / GRID - 0.5) * WORLD_SIZE, (0.5 - selectedCell.gz / GRID) * WORLD_SIZE];
  }, [selectedCell]);

  const instances = useMemo(() => {
    if (!site) return null;
    return buildVoxelInstances(site, clickWorld);
  }, [site, clickWorld]);

  const geometry = useMemo(() => new BoxGeometry(BLOCK_W, BLOCK_H, BLOCK_W), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uProgress: { value: 0 },
          uCutoff: { value: 0.28 },
          uDepthMin: { value: 0 },
          uDepthMax: { value: 240 },
          uBlockW: { value: BLOCK_W },
          uBlockH: { value: BLOCK_H },
          uLowProbFade: { value: 0 },
        },
        vertexShader: voxelVert,
        fragmentShader: oreRampGlsl + '\n' + voxelFragBody,
        transparent: true,
        depthWrite: true,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Instance buffers are built ONCE per site+click, never rebuilt on a slider tick —
  // cutoff/depth filtering happens in the shader via discard (Part I §8).
  //
  // Uploading them from a plain `useEffect(..., [instances])` misses a real case: the
  // <instancedMesh> below only exists in the tree while view is BLOCK/SUBSURFACE, so
  // meshRef.current is still null the first time `instances` becomes non-null (site loads
  // while still on GLOBE). That effect bails out and, because `instances` doesn't change
  // again, never re-fires once the mesh actually mounts — every cube's aTargetPos/
  // aSourcePos then default to zero and the whole field collapses to a sub-pixel point at
  // the origin. A callback ref fires exactly when the mesh mounts (with whatever
  // `instances` the closure holds at that render) AND re-fires whenever its own identity
  // changes, which `useCallback([instances])` ties to `instances` changing — covering both
  // "mesh mounts after data is ready" and "data changes while already mounted" in one path.
  const attachMesh = useCallback(
    (mesh: InstancedMesh | null) => {
      meshRef.current = mesh;
      if (mesh && instances) uploadVoxelAttributes(mesh, instances);
    },
    [instances],
  );

  useEffect(() => {
    material.uniforms.uCutoff.value = cutoff;
  }, [cutoff, material]);

  useEffect(() => {
    material.uniforms.uDepthMin.value = depthRange[0];
    material.uniforms.uDepthMax.value = depthRange[1];
  }, [depthRange, material]);

  useEffect(() => {
    material.uniforms.uLowProbFade.value = view === 'SUBSURFACE' ? 1 : 0;
  }, [view, material]);

  // A fresh bloom only when arriving from RELIEF, not when moving on to SUBSURFACE.
  if (lastView.current !== view) {
    if (view === 'BLOCK' && lastView.current !== 'SUBSURFACE') elapsed.current = 0;
    lastView.current = view;
  }

  useFrame((_, delta) => {
    if (view !== 'BLOCK' && view !== 'SUBSURFACE') return;
    if (reducedMotion) {
      material.uniforms.uProgress.value = 1;
      useDrishti.getState().setBlockBloomProgress(1);
      return;
    }
    elapsed.current += delta * 1000;
    const progress = Math.min(1, elapsed.current / BLOOM_MS);
    material.uniforms.uProgress.value = progress;
    useDrishti.getState().setBlockBloomProgress(progress);
  });

  if (!instances || (view !== 'BLOCK' && view !== 'SUBSURFACE')) return null;

  return <instancedMesh ref={attachMesh} args={[geometry, material, instances.count]} frustumCulled={false} />;
}

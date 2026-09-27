import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, Mesh, MeshStandardMaterial, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { useDrishti } from '../store/useDrishti';
import { useSatelliteSelection } from '../store/useSatelliteSelection';
import { SPACECRAFT, type SpacecraftSpec } from '../data/spacecraft';
import { regionalSatelliteAt, satelliteVisible } from '../lib/regionalSatelliteMotion';
import { SpacecraftModel } from './SpacecraftModel';

function MovingSpacecraft({ spec, elapsed }: { spec: SpacecraftSpec; elapsed: React.RefObject<number> }) {
  const group = useRef<Group>(null);
  const label = useRef<HTMLButtonElement>(null);
  const selected = useSatelliteSelection(s => s.selected === spec.id);
  useFrame(({ camera }) => {
    if (!group.current) return;
    const state = regionalSatelliteAt(spec.id, elapsed.current);
    group.current.position.copy(state.position);
    group.current.quaternion.copy(state.orientation);
    if (label.current) label.current.style.visibility = satelliteVisible(state.position, camera.position) ? 'visible' : 'hidden';
  }, -0.5);
  return <group ref={group}>
    <group scale={.02} onClick={e => {
      if (!group.current || !satelliteVisible(group.current.position, e.camera.position)) return;
      e.stopPropagation();
      useSatelliteSelection.getState().select(spec.id);
    }}>
      <SpacecraftModel id={spec.id} orbital />
    </group>
    <Html position={[0, -.045, 0]} center zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <button ref={label} className="satellite-label mono" aria-pressed={selected}
        style={{ color: spec.color, pointerEvents: 'auto' }}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); useSatelliteSelection.getState().select(spec.id); }}>
        <span className="satellite-label-dot" style={{ background: spec.color }} />{spec.name}
      </button>
    </Html>
  </group>;
}

export function Satellites() {
  const { gl } = useThree();
  const view = useDrishti(s => s.view);
  const reduced = useDrishti(s => s.reducedMotion);
  const elapsed = useRef(0);
  const group = useRef<Group>(null);
  useEffect(() => {
    if (view !== 'GLOBE' || !group.current) return;
    // One shared reflection map makes the metallic spacecraft readable on the globe
    // without changing Earth's existing material or scene lighting.
    const room = new RoomEnvironment();
    const generator = new PMREMGenerator(gl);
    const reflection = generator.fromScene(room, .06);
    group.current.traverse(object => {
      if (object instanceof Mesh && object.material instanceof MeshStandardMaterial) {
        object.material.envMap = reflection.texture;
        object.material.envMapIntensity = .65;
        object.material.needsUpdate = true;
      }
    });
    room.dispose();
    generator.dispose();
    return () => reflection.dispose();
  }, [gl, view]);
  useFrame((_, delta) => {
    if (view === 'GLOBE' && !reduced) elapsed.current = (elapsed.current + Math.min(delta, .1)) % 18;
  }, -1);
  if (view !== 'GLOBE') return null;
  return <group ref={group}>{SPACECRAFT.map(spec => <MovingSpacecraft key={spec.id} spec={spec} elapsed={elapsed} />)}</group>;
}

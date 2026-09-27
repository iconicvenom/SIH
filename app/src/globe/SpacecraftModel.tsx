import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PMREMGenerator, Quaternion, Vector3 } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildSpacecraft } from './spacecraftModels';
import type { SpacecraftId } from '../data/spacecraft';

// Fixed presentation Sun follows the globe's existing India-facing lighting.
const SUN_DIRECTION = new Vector3(.2, .6, -.93).normalize();

export function SpacecraftModel({id,orbital=false}:{id:SpacecraftId;orbital?:boolean}) {
  const model=useMemo(()=>buildSpacecraft(id),[id]);
  const q=useMemo(()=>new Quaternion(),[]);
  useEffect(()=>()=>model.dispose(),[model]);
  useFrame(()=>{
    if(orbital) {
      model.root.getWorldQuaternion(q);
      const localSun=SUN_DIRECTION.clone().applyQuaternion(q.invert());
      const angle=Math.atan2(localSun.z,localSun.y);
      for(const wing of model.wings)wing.rotation.x=angle;
    } else for(const wing of model.wings)wing.rotation.x=-.3;
  });
  return <primitive object={model.root}/>;
}

/** Locally generated studio reflections: no external HDR dependency. Only the
 * inspector uses studio lighting; the globe retains the dashboard's lighting. */
export function SpacecraftStudio() {
  const {gl,scene}=useThree();
  useEffect(()=>{
    const room=new RoomEnvironment();
    const generator=new PMREMGenerator(gl);
    const target=generator.fromScene(room,.04);
    const previous=scene.environment;
    scene.environment=target.texture;
    return ()=>{scene.environment=previous;target.dispose();room.dispose();generator.dispose();};
  },[gl,scene]);
  return <>
    <ambientLight intensity={.6}/>
    <directionalLight position={[-3,7,5]} intensity={3}/>
    <directionalLight position={[5,-2,-5]} color="#e8b978" intensity={1.5}/>
  </>;
}

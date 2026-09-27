import { memo, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Canvas } from '@react-three/fiber';
import { Center, OrbitControls } from '@react-three/drei';
import { SPACECRAFT, type SpacecraftId, type SpacecraftSpec } from '../data/spacecraft';
import { useSatelliteSelection } from '../store/useSatelliteSelection';
import { SpacecraftModel, SpacecraftStudio } from '../globe/SpacecraftModel';
import { ErrorBoundary } from '../ErrorBoundary';
import './satellites.css';

// Keep unrelated UI updates from resetting the independent inspection camera.
const ModelViewer = memo(function ModelViewer({id,expanded=false}:{id:SpacecraftId;expanded?:boolean}) {
  return <div className={expanded?'spacecraft-viewer expanded':'spacecraft-viewer'} role="img" aria-label={`${id} detailed 3D reconstruction. Drag to rotate.`}>
    <ErrorBoundary fallback={<p>3D preview unavailable. Mission details remain available below.</p>}>
      <Canvas dpr={[1,2]} camera={{position:[7,5,8],fov:expanded?36:40,near:.1,far:100}} gl={{antialias:true}}>
        <SpacecraftStudio/>
        <Suspense fallback={null}>
          <Center key={id}><SpacecraftModel id={id}/></Center>
        </Suspense>
        <OrbitControls key={id} makeDefault enablePan={false} minDistance={7} maxDistance={22} enableZoom={expanded}/>
      </Canvas>
    </ErrorBoundary>
    <span className="spacecraft-drag mono">Drag to rotate{expanded?' · Scroll to zoom':''}</span>
  </div>;
});

function SpacecraftDialog({spec,onClose}:{spec:SpacecraftSpec;onClose:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return createPortal(<dialog ref={ref} className="spacecraft-dialog" onClose={onClose}
    onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-label={`${spec.name} spacecraft inspection`}>
    <header><div><span className="label">SPACECRAFT INSPECTION</span><h2>{spec.name}</h2></div>
      <button onClick={onClose} aria-label="Close spacecraft inspection">Close ×</button></header>
    <ModelViewer id={spec.id} expanded/>
    <footer><div><strong>{spec.instrument}</strong><p>{spec.detail}</p></div>
      <a href={spec.source} target="_blank" rel="noreferrer">Official reference ↗</a>
      <p className="spacecraft-note">Visual reconstruction from published imagery; small fittings and dimensions are approximate. Inspection orientation is independent of orbital attitude.</p>
    </footer>
  </dialog>,document.body);
}

export function SatelliteInspector() {
  const selected=useSatelliteSelection(s=>s.selected);
  const spec=SPACECRAFT.find(s=>s.id===selected)!;
  const [expanded,setExpanded]=useState(false);
  return <section className="glass satellite-inspector" aria-label="Earth observation satellites">
    <header><span className="label">EARTH OBSERVATION</span><span className="mono">03</span></header>
    <div className="spacecraft-picker" aria-label="Choose spacecraft">
      {SPACECRAFT.map(s=><button key={s.id} aria-pressed={s.id===selected}
        onClick={()=>useSatelliteSelection.getState().select(s.id)}>
        <span className="spacecraft-dot" style={{background:s.color}}/>
        <span>{s.name}<small>{s.agency}</small></span><span aria-hidden="true">↗</span>
      </button>)}
    </div>
    <ModelViewer id={selected}/>
    <div className="spacecraft-info">
      <div className="spacecraft-instrument">{spec.instrument}</div>
      <dl className="spacecraft-stats">
        <div><dt>Nominal altitude</dt><dd>{spec.altitudeKm} <small>km</small></dd></div>
        <div><dt>Orbit period</dt><dd>{spec.periodMinutes} <small>min</small></dd></div>
      </dl>
      <div className="spacecraft-actions">
        <button onClick={()=>setExpanded(true)}>Inspect model ↗</button>
      </div>
      <p className="spacecraft-note">Regional animation · paths and speed illustrative<br/>Spacecraft enlarged for visibility</p>
    </div>
    {expanded&&<SpacecraftDialog spec={spec} onClose={()=>setExpanded(false)}/>}
  </section>;
}

import { Suspense, lazy } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { SiteDataProvider } from './scene/Canvas3D';
import { TopBar } from './ui/TopBar';
import { LeftRail } from './ui/LeftRail';
import { RightRail } from './ui/RightRail';
import { BottomDock } from './ui/BottomDock';
import { GlobeCallouts } from './ui/GlobeCallouts';
import { TargetInspector } from './ui/widgets/TargetInspector';
import { OpeningSequence } from './ui/OpeningSequence';
import { SceneToolbar } from './ui/SceneToolbar';
import { Fallback } from './ui/Fallback';

/** Lazy so a WebGL2-less machine never pays for the 3D chunk. */
const Canvas3D = lazy(() => import('./scene/Canvas3D').then((m) => ({ default: m.Canvas3D })));

function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

const WEBGL2_AVAILABLE = hasWebGL2();

export default function App() {
  return (
    <SiteDataProvider>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--void)' }}>
        {/* Full-bleed scene. Part III §4: the globe sits BEHIND the rails, not beside them —
            panels float over it with blur. This is the layout decision that makes the whole
            thing read as an instrument rather than a web page. */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <ErrorBoundary fallback={<Fallback reason="The 3D scene failed while rendering." />}>
            {WEBGL2_AVAILABLE ? (
              <Suspense fallback={null}>
                <Canvas3D />
              </Suspense>
            ) : (
              <Fallback reason="WebGL2 is not available in this browser." />
            )}
          </ErrorBoundary>
        </div>

        {/* Chrome layer. The container ignores pointer events so the globe stays draggable
            between panels; each panel re-enables them for itself. */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
          <TopBar />
          <LeftRail />
          <RightRail />
          <BottomDock />
          <SceneToolbar />
          <GlobeCallouts />
          <TargetInspector />
        </div>

        <OpeningSequence />
      </div>
    </SiteDataProvider>
  );
}

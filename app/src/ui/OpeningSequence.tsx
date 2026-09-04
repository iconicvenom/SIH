import { useEffect, useState } from 'react';
import { useDrishti } from '../store/useDrishti';

/**
 * Part III §6. Runs once, 3200ms total. Drives store.bootStage 0..7 on a fixed schedule;
 * other components (RightRail, LeftRail, BottomDock, GroundTracks) gate their own
 * reveal/stagger on that value. After settling the only motion anywhere in the app is the
 * globe's own rotation — this component's job ends at stage 7 and never runs again.
 */
const SCHEDULE: [number, number][] = [
  [300, 1],
  [900, 2],
  [1200, 3],
  [1800, 4],
  [2400, 5],
  [2900, 6],
  [3200, 7],
];

export function OpeningSequence() {
  const reducedMotion = useDrishti((s) => s.reducedMotion);
  const bootStage = useDrishti((s) => s.bootStage);
  const setBootStage = useDrishti((s) => s.setBootStage);
  const [overlayOpacity, setOverlayOpacity] = useState(reducedMotion ? 0 : 1);

  // No "already ran" ref guard here on purpose: React 19 StrictMode double-invokes this
  // effect in dev (mount -> cleanup -> mount), and a mutable-ref guard combined with a
  // cleanup that cancels timers is a real trap — the first invocation's cleanup cancels
  // its own timers as intended, but a guard flag set by that first invocation makes the
  // SECOND (the one that actually persists) bail out and schedule nothing at all, so the
  // whole sequence freezes at stage 0 forever. Letting the effect re-run naturally is
  // correct: each invocation's timers are cleaned up by its own cleanup, and only the
  // final, persisting invocation's timers survive to fire.
  useEffect(() => {
    if (reducedMotion) return;
    const timers = SCHEDULE.map(([ms, stage]) => window.setTimeout(() => setBootStage(stage), ms));
    // Overlay itself: mark visible at 0, fading from ~300ms through ~1300ms as the globe rises.
    const fadeStart = window.setTimeout(() => setOverlayOpacity(0), 300);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(fadeStart);
    };
  }, [reducedMotion, setBootStage]);

  if (bootStage >= 7 && overlayOpacity === 0) return null;

  return (
    <div
      className="absolute inset-0"
      style={{
        zIndex: 200,
        pointerEvents: overlayOpacity > 0 ? 'auto' : 'none',
        background: 'var(--void)',
        opacity: overlayOpacity,
        transition: 'opacity 1000ms var(--ease-entrance)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: '2px solid var(--rhodonite)',
          borderRadius: 6,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div style={{ width: 8, height: 8, background: 'var(--rhodonite)', borderRadius: '50%' }} />
      </div>
    </div>
  );
}

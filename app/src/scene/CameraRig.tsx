import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Spherical, type PerspectiveCamera } from 'three';
import { useDrishti, type ViewState } from '../store/useDrishti';
import { lonLatToWorld, lonLatToNormal } from '../lib/geo';
import { MINES } from '../data/mines';
import { easeOutExpo } from '../lib/easing';

/**
 * The live camera, published for the DOM overlay layer (GlobeCallouts) to project 3D
 * anchor points into screen space with. Nothing else should read this — it exists only
 * because leader-line callouts live outside the R3F tree by necessity (they sit in the
 * same DOM stacking context as the glass panels they must not be occluded by).
 */
export const liveCamera: { current: PerspectiveCamera | null } = { current: null };

/** Imperative reset for the free-orbit offset, so RESET VIEW clears drag/zoom/pan even
 *  when selectedMine/selectedCell were already null (and so wouldn't otherwise retrigger
 *  the reset that a view/mine change causes). */
export const resetCameraOffset: { current: () => void } = { current: () => {} };

/** India, centred a little south of Balaghat so the peninsula reads in frame and the equator
 *  sits near the bottom edge rather than the true 90°-away limb — "just India, up to the
 *  equator" per the brief, not the whole sphere from a default angle. */
const INDIA_LOOK_LON = 78;
const INDIA_LOOK_LAT = 18;
const [indiaNx, indiaNy, indiaNz] = lonLatToNormal(INDIA_LOOK_LON, INDIA_LOOK_LAT);
// The old whole-globe distance was 3.2. At the app's 45° FOV, the sphere (radius 1) only
// stays within frame once distance clears roughly 1/sin(halfFov) ≈ 2.6 — 1.7 was inside that,
// which put the camera pressed up against the surface instead of framing a hemisphere.
const GLOBE_DISTANCE = 2.75;

export const CAMERA_PRESETS: Record<ViewState, { position: [number, number, number]; target: [number, number, number] }> = {
  GLOBE: {
    position: [indiaNx * GLOBE_DISTANCE, indiaNy * GLOBE_DISTANCE, indiaNz * GLOBE_DISTANCE],
    target: [0, 0, 0],
  },
  FLAT: { position: [0, 760, 0.01], target: [0, 0, 0] },
  RELIEF: { position: [0, 480, 620], target: [0, 0, 0] },
  BLOCK: { position: [0, 380, 520], target: [0, -80, 0] },
  SUBSURFACE: { position: [0, -60, 340], target: [0, -150, 0] },
};

/** Free-orbit zoom clamp, as a multiplier on each preset's own distance. */
const MIN_RADIUS_SCALE = 0.35;
const MAX_RADIUS_SCALE = 3.0;
const POLE_GUARD = 0.08; // radians kept clear of the poles so the view never flips axis

const TRANSITION_MS = 1600;
const ORBIT_SENSITIVITY = 0.008;
const PAN_SENSITIVITY = 0.0016;
const WHEEL_SENSITIVITY = 0.0011;

// Hoisted — useFrame must not allocate.
const _pos = new Vector3();
const _target = new Vector3();
const _startPos = new Vector3();
const _startTarget = new Vector3();
const _basePos = new Vector3();
const _baseTarget = new Vector3();
const _offset = new Vector3();
const _spherical = new Spherical();
const _finalTarget = new Vector3();
const _right = new Vector3();
const _up = new Vector3();
const _panDelta = new Vector3();

function minePreset(
  mineId: string,
  baseHeight: number,
): { position: [number, number, number]; target: [number, number, number] } {
  const mine = MINES.find((m) => m.id === mineId);
  if (!mine) return CAMERA_PRESETS.RELIEF;
  const [x, z] = lonLatToWorld(mine.lon, mine.lat);
  return { position: [x, baseHeight, z + 220], target: [x, 0, z] };
}

/**
 * The sole owner of the camera. No other component may call camera.position.set() —
 * including drei's <OrbitControls>, deliberately not used here: it would fight this
 * component for the same object every frame during a scripted transition. Instead, user
 * input (drag to orbit, wheel to zoom, right-drag to pan) accumulates into a spherical
 * offset applied ON TOP of the current preset, so there is exactly one writer of
 * camera.position at all times, in every state.
 */
export function CameraRig() {
  const { camera, gl } = useThree();
  liveCamera.current = camera as PerspectiveCamera;
  const view = useDrishti((s) => s.view);
  const transitioning = useDrishti((s) => s.transitioning);
  const selectedMine = useDrishti((s) => s.selectedMine);

  const elapsed = useRef(0);
  const lastView = useRef<ViewState>(view);
  const lastMine = useRef(selectedMine);
  const currentTarget = useRef(new Vector3(0, 0, 0));

  // User-driven free-orbit offset, reset whenever the state machine moves to a new
  // preset so every state is reachable from a consistent, rehearsable starting angle.
  const userAzimuth = useRef(0);
  const userPolar = useRef(0);
  const userRadiusScale = useRef(1);
  const userPan = useRef(new Vector3());

  resetCameraOffset.current = () => {
    userAzimuth.current = 0;
    userPolar.current = 0;
    userRadiusScale.current = 1;
    userPan.current.set(0, 0, 0);
  };

  if (lastView.current !== view || lastMine.current !== selectedMine) {
    _startPos.copy(camera.position);
    _startTarget.copy(currentTarget.current);
    elapsed.current = 0;
    lastView.current = view;
    lastMine.current = selectedMine;
    resetCameraOffset.current();
    if (!transitioning) useDrishti.setState({ transitioning: true });
  }

  // Pointer/wheel handlers — accumulate into refs only, never touch camera.position
  // directly. The single useFrame below is the only place that writes it.
  useEffect(() => {
    const el = gl.domElement;
    let rotating = false;
    let panning = false;
    let lastX = 0;
    let lastY = 0;
    // Below this many total pixels of movement since pointerdown, treat the gesture as a
    // click-in-progress, not a drag — a real mouse/trackpad click almost never lands with
    // zero movement, and applying orbit/pan on that jitter was shifting the terrain out from
    // under the cursor before pointerup, so a right-click-to-inspect (Terrain.tsx's
    // onContextMenu) on a spot often selected the wrong (or no) cell. Gates both buttons: a
    // near-still right click still selects correctly, an actual right-drag still pans.
    const DRAG_THRESHOLD = 5;
    let downX = 0;
    let downY = 0;
    let dragStarted = false;

    const onPointerDown = (e: PointerEvent) => {
      if (useDrishti.getState().transitioning) return;
      if (e.button === 0) rotating = true;
      else if (e.button === 2) panning = true;
      else return;
      lastX = e.clientX;
      lastY = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
      dragStarted = false;
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!rotating && !panning) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (!dragStarted) {
        if (Math.hypot(e.clientX - downX, e.clientY - downY) < DRAG_THRESHOLD) return;
        dragStarted = true;
      }

      if (rotating) {
        userAzimuth.current -= dx * ORBIT_SENSITIVITY;
        userPolar.current = Math.max(
          POLE_GUARD - Math.PI / 2,
          Math.min(Math.PI / 2 - POLE_GUARD, userPolar.current - dy * ORBIT_SENSITIVITY),
        );
      } else if (panning) {
        // Pan speed scales with current distance so it feels consistent at any zoom level.
        const dist = camera.position.distanceTo(currentTarget.current) || 1;
        camera.getWorldDirection(_offset); // reuse as scratch: forward vector
        _up.set(0, 1, 0);
        _right.crossVectors(_offset, _up).normalize();
        _up.crossVectors(_right, _offset).normalize();
        _panDelta
          .copy(_right)
          .multiplyScalar(-dx * PAN_SENSITIVITY * dist)
          .addScaledVector(_up, dy * PAN_SENSITIVITY * dist);
        userPan.current.add(_panDelta);
      }
    };

    const onPointerUp = () => {
      rotating = false;
      panning = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (useDrishti.getState().transitioning) return;
      e.preventDefault();
      const next = userRadiusScale.current * (1 + e.deltaY * WHEEL_SENSITIVITY);
      userRadiusScale.current = Math.max(MIN_RADIUS_SCALE, Math.min(MAX_RADIUS_SCALE, next));
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerleave', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerleave', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl, camera]);

  useFrame((_, delta) => {
    const preset = selectedMine ? minePreset(selectedMine, CAMERA_PRESETS[view].position[1]) : CAMERA_PRESETS[view];
    _basePos.set(...preset.position);
    _baseTarget.set(...preset.target);

    if (useDrishti.getState().transitioning) {
      elapsed.current += delta * 1000;
      const t = Math.min(1, elapsed.current / TRANSITION_MS);
      const eased = easeOutExpo(t);
      _pos.lerpVectors(_startPos, _basePos, eased);
      _target.lerpVectors(_startTarget, _baseTarget, eased);
      camera.position.copy(_pos);
      currentTarget.current.copy(_target);
      camera.lookAt(currentTarget.current);
      if (t >= 1) useDrishti.setState({ transitioning: false });
      return;
    }

    // Settled: apply the user's free-orbit offset on top of the preset. Spherical around
    // the (pan-shifted) target, radius scaled by wheel zoom, angles nudged by drag.
    _finalTarget.copy(_baseTarget).add(userPan.current);
    _offset.copy(_basePos).sub(_baseTarget);
    _spherical.setFromVector3(_offset);
    _spherical.theta += userAzimuth.current;
    _spherical.phi = Math.max(POLE_GUARD, Math.min(Math.PI - POLE_GUARD, _spherical.phi + userPolar.current));
    _spherical.radius *= userRadiusScale.current;
    _offset.setFromSpherical(_spherical);

    camera.position.copy(_finalTarget).add(_offset);
    currentTarget.current.copy(_finalTarget);
    camera.lookAt(_finalTarget);
  });

  return null;
}

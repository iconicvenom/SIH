/**
 * SINGLE SOURCE OF TRUTH for terrain displacement.
 *
 * terrainSurfaceY() below and the displacement line in src/scene/shaders/terrain.vert.glsl
 * are the same formula written twice — once for the CPU, once for the GPU. They must not
 * drift. The voxel bloom depends on it: at t=0 every cube is spawned on the terrain surface
 * using terrainSurfaceY(), and the mesh it appears to peel off is displaced by the shader.
 * If the two disagree by even a few units the cubes visibly detach and the effect dies.
 *
 * Anything that needs a terrain height in world units calls terrainSurfaceY(). Nothing
 * re-derives it.
 */

/** Sausar Belt floor, metres AMSL. */
export const ELEV_MIN = 250;

/** Sausar Belt ceiling, metres AMSL. */
export const ELEV_MAX = 600;

/**
 * Vertical exaggeration for RELIEF. The belt has ~350 m of relief across ~150 km; at true
 * scale it reads as a flat sheet, so the terrain is stretched to make structure legible.
 */
export const VE_RELIEF = 2.4;

/** Metres AMSL -> world Y (three.js units). Zero at ELEV_MIN. */
export function terrainSurfaceY(elevMeters: number): number {
  return (elevMeters - ELEV_MIN) * VE_RELIEF * 0.15;
}

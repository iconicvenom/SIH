/**
 * The 18 predictors the prospectivity model consumes.
 *
 * The ids are the contract: SHAP contributions (`generate.ts`) and sensor provenance
 * (`sensors.ts`) both reference these strings, which is what lets a card say "this satellite
 * feeds these three predictors" instead of just looking like a logo.
 *
 * Note what is NOT here: any feature derived from the locations of the 11 known mines other
 * than `distance_to_known_mine`, which is carried for auditability and is held out of the
 * validation run. See MINE_BOOST in `generate.ts`.
 */
export interface Feature {
  id: string;
  label: string;
}

export const FEATURES: Feature[] = [
  { id: 'distance_to_mansar_contact', label: 'Distance to Mansar contact' },
  { id: 'fold_axial_proximity', label: 'Fold axial proximity' },
  { id: 'aeromagnetic_residual', label: 'Aeromagnetic residual' },
  { id: 'stream_sediment_mn', label: 'Stream sediment Mn' },
  { id: 'ndvi_stress_anomaly', label: 'NDVI stress anomaly' },
  { id: 'lst_residual', label: 'Land surface temp residual' },
  { id: 'slope', label: 'Slope' },
  { id: 'curvature', label: 'Curvature' },
  { id: 'distance_to_lineament', label: 'Distance to lineament' },
  { id: 'gravity_residual', label: 'Bouguer gravity residual' },
  { id: 'radiometric_k', label: 'Radiometric K' },
  { id: 'radiometric_th', label: 'Radiometric Th' },
  { id: 'radiometric_u', label: 'Radiometric U' },
  { id: 'drainage_density', label: 'Drainage density' },
  { id: 'soil_mn_anomaly', label: 'Soil Mn anomaly' },
  { id: 'distance_to_known_mine', label: 'Distance to known mine' },
  { id: 'lithology_favourability', label: 'Lithology favourability' },
  { id: 'regolith_thickness', label: 'Regolith thickness' },
];

export const FEATURE_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
  FEATURES.map((f) => [f.id, f.label]),
);

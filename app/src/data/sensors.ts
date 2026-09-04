import { FEATURES } from './features';

/**
 * Part III §5.5 — the acquisition plan.
 *
 * These are real Earth-observation platforms and DRISHTI is a CONSUMER of their public data
 * products. Nothing here commands, owns, schedules or tracks a spacecraft; `nextPassUtc` is a
 * published overpass prediction for the Sausar Belt, not a manoeuvre.
 *
 * `feedsFeatures` is the load-bearing field. A sensor card that only shows a logo and a revisit
 * number is decoration; a card that names which of the 18 model predictors the platform actually
 * produces is an argument about why the acquisition is worth making.
 *
 * `cloudForecast` is the forecast cloud fraction over the site at the listed pass — a physical
 * property of the sky, not of the instrument. The SAR platforms (Sentinel-1C, EOS-04, NISAR)
 * are unaffected by it; the UI should render their value muted. Late-August values are high
 * because the site is in the tail of the south-west monsoon, which is exactly why the SAR
 * platforms carry the structural predictors here and the optical ones do not.
 *
 * Seven of the 18 predictors are fed by NO satellite in this plan —
 * distance_to_mansar_contact, aeromagnetic_residual, stream_sediment_mn, gravity_residual,
 * radiometric_k, radiometric_th, radiometric_u. Those come from GSI airborne geophysics,
 * field geochemistry and published 1:50k geological mapping. Pretending a satellite supplied
 * them would be the easiest lie in this file and the fastest way to lose a technical judge.
 */
export interface Sensor {
  id: string;
  name: string;
  agency: string;
  bands: string[];
  resolution: string;
  revisit: string;
  /** Published overpass prediction over the Sausar Belt, ISO-8601 UTC. */
  nextPassUtc: string;
  /** Forecast cloud fraction over the site at that pass, 0..1. */
  cloudForecast: number;
  /** Typical product availability lag after acquisition, in days. */
  latencyDays: number;
  /** Ids from FEATURES that this platform's products actually generate. */
  feedsFeatures: string[];
}

export const SENSORS: Sensor[] = [
  {
    id: 'sentinel-1c',
    name: 'Sentinel-1C',
    agency: 'ESA / Copernicus',
    bands: ['C-band SAR 5.405 GHz', 'VV', 'VH'],
    resolution: '5 × 20 m (IW), 250 km swath',
    revisit: '12 d',
    nextPassUtc: '2026-08-28T00:41:00Z',
    cloudForecast: 0.78,
    latencyDays: 1,
    feedsFeatures: [
      'distance_to_lineament',
      'fold_axial_proximity',
      'regolith_thickness',
      'slope',
    ],
  },
  {
    id: 'sentinel-2b',
    name: 'Sentinel-2B',
    agency: 'ESA / Copernicus',
    bands: ['B2', 'B3', 'B4', 'B8', 'B11', 'B12'],
    resolution: '10 m VNIR / 20 m SWIR',
    revisit: '5 d (constellation)',
    nextPassUtc: '2026-08-29T05:12:00Z',
    cloudForecast: 0.84,
    latencyDays: 1,
    feedsFeatures: [
      'ndvi_stress_anomaly',
      'soil_mn_anomaly',
      'lithology_favourability',
      'drainage_density',
    ],
  },
  {
    id: 'landsat-9',
    name: 'Landsat-9',
    agency: 'USGS / NASA',
    bands: ['OLI-2 B2–B7', 'PAN B8', 'TIRS-2 B10', 'TIRS-2 B11'],
    resolution: '30 m multispectral / 100 m thermal',
    revisit: '16 d',
    nextPassUtc: '2026-09-04T04:58:00Z',
    cloudForecast: 0.71,
    latencyDays: 2,
    feedsFeatures: ['lst_residual', 'ndvi_stress_anomaly', 'lithology_favourability'],
  },
  {
    id: 'resourcesat-2a',
    name: 'Resourcesat-2A',
    agency: 'ISRO',
    bands: ['LISS-IV B2 B3 B4', 'LISS-III B2 B3 B4 B5'],
    resolution: '5.8 m (LISS-IV) / 23.5 m (LISS-III)',
    revisit: '5 d (steerable LISS-IV)',
    nextPassUtc: '2026-08-30T05:04:00Z',
    cloudForecast: 0.86,
    latencyDays: 3,
    feedsFeatures: ['drainage_density', 'distance_to_lineament', 'lithology_favourability'],
  },
  {
    id: 'eos-04',
    name: 'EOS-04',
    agency: 'ISRO',
    bands: ['C-band SAR 5.35 GHz', 'HH', 'HV'],
    resolution: '6–50 m (mode dependent)',
    revisit: '12 d',
    nextPassUtc: '2026-09-02T12:47:00Z',
    cloudForecast: 0.74,
    latencyDays: 2,
    feedsFeatures: ['regolith_thickness', 'distance_to_lineament', 'drainage_density'],
  },
  {
    id: 'eos-06',
    name: 'EOS-06 / Oceansat-3',
    agency: 'ISRO',
    bands: ['OCM-3 400–1010 nm (13 bands)'],
    resolution: '360 m',
    revisit: '2 d',
    nextPassUtc: '2026-08-28T04:47:00Z',
    cloudForecast: 0.8,
    latencyDays: 1,
    // 360 m is far too coarse to map a prospect. Its only job here is cadence: the NDVI stress
    // residual is an anomaly, and an anomaly needs a background. Nothing else in this plan can
    // rebuild the vegetation baseline every two days through the monsoon.
    feedsFeatures: ['ndvi_stress_anomaly'],
  },
  {
    id: 'cartosat-3',
    name: 'Cartosat-3',
    agency: 'ISRO',
    bands: ['PAN 0.50–0.85 µm', 'MX B2 B3 B4 B5'],
    resolution: '0.25 m PAN / 1.13 m MX',
    revisit: 'On-demand tasking',
    nextPassUtc: '2026-09-01T05:21:00Z',
    cloudForecast: 0.66,
    latencyDays: 4,
    feedsFeatures: ['distance_to_known_mine', 'slope', 'curvature'],
  },
  {
    id: 'nisar',
    name: 'NISAR',
    agency: 'NASA / ISRO',
    bands: ['L-band 1.257 GHz HH/HV', 'S-band 3.2 GHz HH/HV'],
    resolution: '3–10 m',
    revisit: '12 d',
    nextPassUtc: '2026-08-31T12:36:00Z',
    cloudForecast: 0.79,
    latencyDays: 2,
    // L-band penetrates the teak canopy that covers most of the Sausar Belt. This is the only
    // platform in the plan that resolves structural grain under closed forest, which is where
    // the model's fold-axis predictors are weakest from optical data alone.
    feedsFeatures: [
      'distance_to_lineament',
      'fold_axial_proximity',
      'slope',
      'curvature',
      'regolith_thickness',
    ],
  },
];

/** Fails loudly at module load if a sensor ever cites a predictor the model does not have. */
const KNOWN_FEATURE_IDS = new Set(FEATURES.map((f) => f.id));
for (const sensor of SENSORS) {
  for (const featureId of sensor.feedsFeatures) {
    if (!KNOWN_FEATURE_IDS.has(featureId)) {
      throw new Error(`Sensor ${sensor.id} cites unknown feature "${featureId}"`);
    }
  }
}

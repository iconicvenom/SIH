export type SpacecraftId = 'sentinel-2b' | 'landsat-9' | 'cartosat-3';

export interface SpacecraftSpec {
  id: SpacecraftId;
  name: string;
  agency: string;
  catalog: number;
  color: string;
  altitudeKm: number;
  inclinationDeg: number;
  periodMinutes: number;
  instrument: string;
  detail: string;
  source: string;
  tle: [string, string];
}

/** CelesTrak GP snapshots retrieved 2026-09-25. Replay remains near their epochs;
 * never silently extrapolate this snapshot to the user's current date. */
export const SPACECRAFT: SpacecraftSpec[] = [
  {
    id: 'sentinel-2b', name: 'Sentinel-2B', agency: 'ESA · Copernicus', catalog: 42063,
    color: '#e8b978', altitudeKm: 786, inclinationDeg: 98.57, periodMinutes: 100.6, instrument: 'MSI · 13 spectral bands',
    detail: 'Gold thermal blankets, a three-panel solar wing and the Earth-facing multispectral imager.',
    source: 'https://www.esa.int/Enabling_Support/Operations/Sentinel-2_operations',
    tle: [
      '1 42063U 17013A   26268.27743478 -.00000234  00000+0 -72746-4 0  9993',
      '2 42063  98.5712 341.6122 0001149  88.4840 271.6475 14.30815025498951',
    ],
  },
  {
    id: 'landsat-9', name: 'Landsat-9', agency: 'NASA · USGS', catalog: 49260,
    color: '#c9d3dd', altitudeKm: 705, inclinationDeg: 98.2, periodMinutes: 99, instrument: 'OLI-2 + TIRS-2 · optical / thermal',
    detail: 'Silver insulation, a long four-section solar wing, and separate optical and thermal instrument housings.',
    source: 'https://science.nasa.gov/mission/landsat-9/',
    tle: [
      '1 49260U 21088A   26267.76781344  .00000238  00000+0  62841-4 0  9990',
      '2 49260  98.2190 336.6909 0001461  92.9215 267.2151 14.57102385265506',
    ],
  },
  {
    id: 'cartosat-3', name: 'Cartosat-3', agency: 'ISRO', catalog: 44804,
    color: '#d96a8e', altitudeKm: 509, inclinationDeg: 97.5, periodMinutes: 94.7, instrument: 'High-resolution optical telescope',
    detail: 'A prominent cylindrical telescope, paired two-panel solar wings, radiators and antenna assemblies.',
    source: 'https://www.isro.gov.in/Cartosat_3.html',
    tle: [
      '1 44804U 19081A   26268.27010078  .00001389  00000+0  69017-4 0  9995',
      '2 44804  97.4203 328.4641 0012158 158.6752 201.4992 15.19257465378668',
    ],
  },
];

export const REPLAY_START = Date.parse('2026-09-25T00:00:00Z');
export const REPLAY_END = REPLAY_START + 24 * 60 * 60 * 1000;

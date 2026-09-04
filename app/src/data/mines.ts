/**
 * The 11 producing MOIL manganese mines of the Sausar Belt.
 *
 * This list is CLOSED. Every table, ranking and validation figure in DRISHTI resolves to these
 * eleven rows; padding it with plausible-looking extras would silently turn the one honest
 * number in the product (11/11 recovered in the top 5%) into a lie.
 *
 * `sizeIndex` is a relative production-scale weight used only to shape the synthetic monthly
 * series in `generate.ts`. It is NOT a reserve figure and must never be surfaced as tonnage.
 */
export type MineType = 'underground' | 'opencast';

export interface Mine {
  id: string;
  name: string;
  lon: number;
  lat: number;
  type: MineType;
  district: string;
  state: string;
  sizeIndex: number;
}

export const MINES: Mine[] = [
  {
    id: 'kandri',
    name: 'Kandri',
    lon: 79.18,
    lat: 21.28,
    type: 'underground',
    district: 'Nagpur',
    state: 'Maharashtra',
    sizeIndex: 1.0,
  },
  {
    id: 'munsar',
    name: 'Munsar',
    lon: 79.22,
    lat: 21.31,
    type: 'underground',
    district: 'Nagpur',
    state: 'Maharashtra',
    sizeIndex: 1.1,
  },
  {
    id: 'beldongri',
    name: 'Beldongri',
    lon: 79.15,
    lat: 21.25,
    type: 'underground',
    district: 'Nagpur',
    state: 'Maharashtra',
    sizeIndex: 1.0,
  },
  {
    id: 'gumgaon',
    name: 'Gumgaon',
    lon: 79.12,
    lat: 21.22,
    type: 'underground',
    district: 'Nagpur',
    state: 'Maharashtra',
    sizeIndex: 0.9,
  },
  {
    id: 'chikla',
    name: 'Chikla',
    lon: 79.72,
    lat: 21.48,
    type: 'underground',
    district: 'Bhandara',
    state: 'Maharashtra',
    sizeIndex: 1.3,
  },
  {
    id: 'dongri',
    name: 'Dongri Buzurg',
    lon: 79.78,
    lat: 21.52,
    type: 'opencast',
    district: 'Bhandara',
    state: 'Maharashtra',
    sizeIndex: 1.4,
  },
  {
    id: 'sitapatore',
    name: 'Sitapatore',
    lon: 79.85,
    lat: 21.44,
    type: 'opencast',
    district: 'Bhandara',
    state: 'Maharashtra',
    sizeIndex: 1.2,
  },
  {
    id: 'parsoda',
    name: 'Parsoda',
    lon: 79.3,
    lat: 21.34,
    type: 'underground',
    district: 'Nagpur',
    state: 'Maharashtra',
    sizeIndex: 1.0,
  },
  {
    id: 'tirodi',
    name: 'Tirodi',
    lon: 79.72,
    lat: 21.68,
    type: 'opencast',
    district: 'Balaghat',
    state: 'Madhya Pradesh',
    sizeIndex: 1.5,
  },
  {
    id: 'balaghat',
    name: 'Balaghat (Bharveli)',
    lon: 80.18,
    lat: 21.82,
    type: 'underground',
    district: 'Balaghat',
    state: 'Madhya Pradesh',
    sizeIndex: 2.5,
  },
  {
    id: 'ukwa',
    name: 'Ukwa',
    lon: 80.42,
    lat: 21.95,
    type: 'underground',
    district: 'Balaghat',
    state: 'Madhya Pradesh',
    sizeIndex: 1.2,
  },
];

export const MINE_BY_ID: Readonly<Record<string, Mine>> = Object.fromEntries(
  MINES.map((m) => [m.id, m]),
);

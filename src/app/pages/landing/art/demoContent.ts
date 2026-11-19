import type { RangeState } from '@/core/glucose/thresholds';

/**
 * Illustrative content of the landing: fictitious patients and readings that dress the product
 * pieces shown on the page. It never feeds clinical logic; the app reads every clinical value
 * from the API.
 */

export interface TirSegment {
  readonly state: RangeState;
  /** Share of the 14-day window, in percent. */
  readonly percent: number;
}

export const HERO_READING = { valueMgDl: 186, state: 'HIGH' as RangeState };

export const HERO_TIR: readonly TirSegment[] = [
  { state: 'VERY_LOW', percent: 1 },
  { state: 'LOW', percent: 3 },
  { state: 'IN_RANGE', percent: 68 },
  { state: 'HIGH', percent: 21 },
  { state: 'VERY_HIGH', percent: 7 },
];

export interface TriageRowDemo {
  readonly name: string;
  readonly reason: string;
  readonly tir: readonly TirSegment[];
  readonly lastMgDl: number;
  readonly lastState: RangeState;
  readonly lastAgo: string;
}

export const TRIAGE_ROWS: readonly TriageRowDemo[] = [
  {
    name: 'Lucía Montoya R.',
    reason: 'Dos hipoglucemias nocturnas',
    tir: [
      { state: 'VERY_LOW', percent: 4 },
      { state: 'LOW', percent: 9 },
      { state: 'IN_RANGE', percent: 61 },
      { state: 'HIGH', percent: 20 },
      { state: 'VERY_HIGH', percent: 6 },
    ],
    lastMgDl: 62,
    lastState: 'LOW',
    lastAgo: '25 min',
  },
  {
    name: 'Andrés Caicedo P.',
    reason: 'El tiempo en rango bajó 12 puntos',
    tir: [
      { state: 'VERY_LOW', percent: 0 },
      { state: 'LOW', percent: 2 },
      { state: 'IN_RANGE', percent: 49 },
      { state: 'HIGH', percent: 31 },
      { state: 'VERY_HIGH', percent: 18 },
    ],
    lastMgDl: 263,
    lastState: 'VERY_HIGH',
    lastAgo: '1 h',
  },
  {
    name: 'Marta Ríos Gaviria',
    reason: 'Picos después de la cena',
    tir: [
      { state: 'VERY_LOW', percent: 0 },
      { state: 'LOW', percent: 1 },
      { state: 'IN_RANGE', percent: 72 },
      { state: 'HIGH', percent: 22 },
      { state: 'VERY_HIGH', percent: 5 },
    ],
    lastMgDl: 186,
    lastState: 'HIGH',
    lastAgo: '2 h',
  },
];

export const PATIENT_READING = { valueMgDl: 132, state: 'IN_RANGE' as RangeState };

export const IMPORT_DEMO = { validRows: 48, errorRows: 1 };

/** Fixture UUID-like ids: a two-letter family prefix and a counter, readable in test failures. */
export const uuid = (prefix: string, n: number): string =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Patient `n` of the fixture world. Patient 3 is the signed-in patient account. */
export const patientId = (n: number): string =>
  `a1${String(n).padStart(6, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;

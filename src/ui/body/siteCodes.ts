/**
 * Injection site catalog (BRIEF-injection.md, "Catalogo"). The codes are the canonical API values;
 * labels live in `src/i18n/es.body.ts`.
 */
export const SITE_CODES = [
  'ABDOMEN_RIGHT',
  'ABDOMEN_LEFT',
  'THIGH_RIGHT',
  'THIGH_LEFT',
  'ARM_RIGHT',
  'ARM_LEFT',
  'BUTTOCK_RIGHT',
  'BUTTOCK_LEFT',
] as const;

export type SiteCode = (typeof SITE_CODES)[number];

/** Per-site state from the API. `RECENT` means used within the last 24 h (rapid) or 72 h (basal). */
export const INJECTION_STATES = ['SUGGESTED', 'ALLOWED', 'RECENT', 'AVOID'] as const;

export type InjectionState = (typeof INJECTION_STATES)[number];

/** Each site has four spots, rotated 1 to 4 before a spot is reused (BRIEF-injection.md). */
export const SPOT_COUNT = 4;

export type SpotNumber = 1 | 2 | 3 | 4;

export const SPOT_NUMBERS: readonly SpotNumber[] = Array.from(
  { length: SPOT_COUNT },
  (_, index) => (index + 1) as SpotNumber,
);

/** Which side of the figure the camera shows. Front: the abdomen and thighs. Back: arms and buttocks. */
export const BODY_VIEWS = ['front', 'back'] as const;

export type BodyView = (typeof BODY_VIEWS)[number];

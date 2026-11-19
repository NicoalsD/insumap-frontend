import { describe, expect, it } from 'vitest';
import { describeAllowedSites, type PlanSiteTexts } from './planSites';

const texts: PlanSiteTexts = {
  noRestriction: 'Sin restricción',
  noneAllowed: 'Ningún sitio permitido',
  region: { ABDOMEN: 'abdomen', THIGH: 'muslo', ARM: 'brazo', BUTTOCK: 'glúteo' },
};

describe('describeAllowedSites', () => {
  it('reads no restriction as the plain phrase', () => {
    expect(describeAllowedSites(null, texts)).toBe('Sin restricción');
  });

  it('names a region once when both sides are allowed, and joins regions with "y"', () => {
    expect(describeAllowedSites(['ABDOMEN_LEFT', 'ABDOMEN_RIGHT', 'THIGH_LEFT', 'THIGH_RIGHT'], texts)).toBe(
      'Abdomen y muslo',
    );
  });

  it('uses the short side name when only one side of a region is allowed', () => {
    expect(describeAllowedSites(['ABDOMEN_LEFT', 'THIGH_LEFT', 'THIGH_RIGHT'], texts)).toBe(
      'Abdomen izq. y muslo',
    );
  });

  it('reads an empty list as no allowed site, never as no restriction', () => {
    expect(describeAllowedSites([], texts)).toBe('Ningún sitio permitido');
  });
});

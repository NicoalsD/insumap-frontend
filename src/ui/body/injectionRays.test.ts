import { describe, expect, it } from 'vitest';
import { bodySdf, surfacePoint } from '@/app/pages/landing/art/bodySdf';
import { defaultSpotFor, isSelectable, nextSpot, orderEntries } from './injectionModel';
import { injectionRay, siteView, spotNumbers } from './injectionRays';
import {
  SITE_CODES,
  SPOT_NUMBERS,
  type BodyView,
  type SiteCode,
  type SpotNumber,
} from './siteCodes';

/** Figure height is 4 body units, about 170 cm: one unit is about 42.5 cm, so 2.5 cm is about 0.059 units. */
const MIN_SPOT_SEPARATION_UNITS = 2.5 / 42.5;

function hitFor(site: SiteCode, spot: SpotNumber) {
  const view = siteView(site);
  const ray = injectionRay(site, view, spot);
  if (!ray) throw new Error(`no ray for ${site} ${view}`);
  return surfacePoint(ray.origin, ray.direction);
}

describe('injection rays', () => {
  it('maps every site to exactly one view', () => {
    const views: Record<BodyView, SiteCode[]> = { front: [], back: [] };
    for (const site of SITE_CODES) views[siteView(site)].push(site);
    expect(views.front.sort()).toEqual([
      'ABDOMEN_LEFT',
      'ABDOMEN_RIGHT',
      'THIGH_LEFT',
      'THIGH_RIGHT',
    ]);
    expect(views.back.sort()).toEqual(['ARM_LEFT', 'ARM_RIGHT', 'BUTTOCK_LEFT', 'BUTTOCK_RIGHT']);
  });

  it('returns a ray only on the side that shows the site', () => {
    expect(injectionRay('ABDOMEN_RIGHT', 'front', 1)).not.toBeNull();
    expect(injectionRay('ABDOMEN_RIGHT', 'back', 1)).toBeNull();
    expect(injectionRay('ARM_LEFT', 'front', 1)).toBeNull();
    expect(injectionRay('ARM_LEFT', 'back', 1)).not.toBeNull();
    expect(injectionRay('BUTTOCK_RIGHT', 'front', 4)).toBeNull();
  });

  it('starts every ray outside the body, pointing outward', () => {
    for (const site of SITE_CODES) {
      const view = siteView(site);
      for (const spot of SPOT_NUMBERS) {
        const ray = injectionRay(site, view, spot);
        expect(ray).not.toBeNull();
        if (!ray) continue;
        const [ox, oy, oz] = ray.origin;
        expect(bodySdf(ox, oy, oz)).toBeGreaterThan(0);
        const [dx, dy, dz] = ray.direction;
        expect(Math.hypot(dx, dy, dz)).toBeCloseTo(1, 6);
      }
    }
  });

  it('lands on the skin of the named side, on the named face', () => {
    for (const site of SITE_CODES) {
      for (const spot of spotNumbers()) {
        const ray = injectionRay(site, siteView(site), spot);
        if (!ray) throw new Error('no ray');
        const hit = surfacePoint(ray.origin, ray.direction);
        const [x, y, z] = hit.position;
        expect(Math.abs(bodySdf(x, y, z))).toBeLessThan(1e-3);
        // Patient's right is negative x (the viewer's left when facing the figure); the left is positive.
        if (site.endsWith('_RIGHT')) expect(x).toBeLessThan(0);
        else expect(x).toBeGreaterThan(0);
        // The skin normal at the hit faces the camera side the ray came from.
        const [nx, ny, nz] = hit.normal;
        const [dx, dy, dz] = ray.direction;
        expect(nx * dx + ny * dy + nz * dz).toBeGreaterThan(0.5);
      }
    }
  });

  it('puts each site on its region: abdomen and thigh in front, arm and buttock behind', () => {
    for (const spot of spotNumbers()) {
      for (const side of ['RIGHT', 'LEFT'] as const) {
        const abdomen = hitFor(`ABDOMEN_${side}`, spot).position;
        expect(abdomen[2]).toBeGreaterThan(0);
        expect(abdomen[1]).toBeGreaterThan(0);
        expect(abdomen[1]).toBeLessThan(0.4);

        const thigh = hitFor(`THIGH_${side}`, spot).position;
        expect(thigh[2]).toBeGreaterThan(0);
        expect(thigh[1]).toBeGreaterThan(-0.9);
        expect(thigh[1]).toBeLessThan(-0.1);

        // The arm's spots lie on the back and the outer side: never on the front of the limb.
        const arm = hitFor(`ARM_${side}`, spot).position;
        expect(arm[2]).toBeLessThan(0.05);
        expect(arm[1]).toBeGreaterThan(0.6);
        expect(arm[1]).toBeLessThan(1.1);

        const buttock = hitFor(`BUTTOCK_${side}`, spot).position;
        expect(buttock[2]).toBeLessThan(0);
        expect(buttock[1]).toBeGreaterThan(-0.1);
        expect(buttock[1]).toBeLessThan(0.4);
      }
    }
  });

  it('keeps the four spots of a site apart by at least 2.5 cm', () => {
    for (const site of SITE_CODES) {
      const points = spotNumbers().map((spot) => hitFor(site, spot).position);
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          if (!a || !b) throw new Error('missing spot');
          const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
          expect(distance).toBeGreaterThan(MIN_SPOT_SEPARATION_UNITS);
        }
      }
    }
  });
});

describe('spot rotation and entry helpers', () => {
  it('advances spot 1 to 2 to 3 to 4 and back to 1', () => {
    expect(nextSpot(null)).toBe(1);
    expect(nextSpot(undefined)).toBe(1);
    expect(nextSpot(1)).toBe(2);
    expect(nextSpot(2)).toBe(3);
    expect(nextSpot(3)).toBe(4);
    expect(nextSpot(4)).toBe(1);
  });

  it('falls back to spot 1 for values outside the rotation', () => {
    expect(nextSpot(0)).toBe(1);
    expect(nextSpot(9)).toBe(1);
    expect(nextSpot(2.5)).toBe(1);
  });

  it('defaults a choice to the next spot after the last one used', () => {
    expect(defaultSpotFor({ site: 'THIGH_RIGHT', state: 'ALLOWED', lastSpot: 2 })).toBe(3);
    expect(defaultSpotFor({ site: 'THIGH_RIGHT', state: 'SUGGESTED' })).toBe(1);
  });

  it('keeps AVOID sites out of the choice', () => {
    expect(isSelectable('AVOID')).toBe(false);
    expect(isSelectable('RECENT')).toBe(true);
    expect(isSelectable('SUGGESTED')).toBe(true);
  });

  it('orders the entries by the catalog, whatever order the API used', () => {
    const ordered = orderEntries([
      { site: 'BUTTOCK_LEFT', state: 'ALLOWED' },
      { site: 'ABDOMEN_RIGHT', state: 'SUGGESTED' },
      { site: 'ARM_LEFT', state: 'AVOID' },
    ]).map((entry) => entry.site);
    expect(ordered).toEqual(['ABDOMEN_RIGHT', 'ARM_LEFT', 'BUTTOCK_LEFT']);
  });
});

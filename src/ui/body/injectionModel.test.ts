import { describe, expect, it } from 'vitest';
import { asSpot, mapLabels, type InjectionSiteEntry } from './injectionModel';

const entries: InjectionSiteEntry[] = [
  { site: 'ABDOMEN_LEFT', state: 'SUGGESTED', lastSpot: 1 },
  { site: 'ABDOMEN_RIGHT', state: 'ALLOWED' },
  { site: 'THIGH_LEFT', state: 'RECENT', lastUsedLabel: 'hace 5 h', lastSpot: 3 },
  { site: 'ARM_LEFT', state: 'AVOID' },
];

const none = { hoverSite: null, focusSite: null } as const;

describe('mapLabels', () => {
  it('labels only the suggested site when nothing is selected', () => {
    expect(mapLabels({ entries, selectedSite: null, selectedSpot: null, ...none })).toEqual([
      { site: 'ABDOMEN_LEFT', spot: 2, kind: 'suggested' },
    ]);
  });

  it('adds the selected site with its chosen spot', () => {
    expect(mapLabels({ entries, selectedSite: 'ABDOMEN_RIGHT', selectedSpot: 4, ...none })).toEqual(
      [
        { site: 'ABDOMEN_LEFT', spot: 2, kind: 'suggested' },
        { site: 'ABDOMEN_RIGHT', spot: 4, kind: 'selected' },
      ],
    );
  });

  it('shows the chosen spot on the suggested site when it is the one selected', () => {
    expect(mapLabels({ entries, selectedSite: 'ABDOMEN_LEFT', selectedSpot: 3, ...none })).toEqual([
      { site: 'ABDOMEN_LEFT', spot: 3, kind: 'suggested' },
    ]);
  });

  it('adds the site under the pointer or with focus, once per site', () => {
    const labels = mapLabels({
      entries,
      selectedSite: null,
      selectedSpot: null,
      hoverSite: 'THIGH_LEFT',
      focusSite: 'ABDOMEN_LEFT',
    });
    expect(labels).toEqual([
      { site: 'ABDOMEN_LEFT', spot: 2, kind: 'suggested' },
      { site: 'THIGH_LEFT', spot: 4, kind: 'point' },
    ]);
  });

  it('ignores hover and focus on sites that are not listed', () => {
    expect(
      mapLabels({
        entries,
        selectedSite: null,
        selectedSpot: null,
        hoverSite: 'BUTTOCK_LEFT',
        focusSite: null,
      }),
    ).toHaveLength(1);
  });
});

describe('asSpot', () => {
  it('accepts 1 to 4 only', () => {
    expect(asSpot(1)).toBe(1);
    expect(asSpot(4)).toBe(4);
    expect(asSpot(0)).toBeNull();
    expect(asSpot(5)).toBeNull();
    expect(asSpot(2.5)).toBeNull();
    expect(asSpot(null)).toBeNull();
  });
});

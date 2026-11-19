import {
  SITE_CODES,
  SPOT_COUNT,
  type InjectionState,
  type SiteCode,
  type SpotNumber,
} from './siteCodes';

/** One site as the API reports it (`GET .../injection-sites`). */
export interface InjectionSiteEntry {
  readonly site: SiteCode;
  readonly state: InjectionState;
  /** Human text of the last use, e.g. "hace 2 h". Supplied by the caller, already in Spanish. */
  readonly lastUsedLabel?: string | undefined;
  readonly lastSpot?: number | null | undefined;
}

/** Catalog order (the order of the brief), so the list and the markers always read the same way. */
export function orderEntries(entries: readonly InjectionSiteEntry[]): InjectionSiteEntry[] {
  return [...entries].sort((a, b) => SITE_CODES.indexOf(a.site) - SITE_CODES.indexOf(b.site));
}

/** AVOID sites are shown but cannot be chosen. Other states can be chosen; RECENT is flagged in the text. */
export function isSelectable(state: InjectionState): boolean {
  return state !== 'AVOID';
}

/** Rotation rule (BRIEF-injection.md, rule 4): spot 1 to 2 to 3 to 4 and back to 1. */
export function nextSpot(lastSpot: number | null | undefined): SpotNumber {
  if (
    lastSpot === null ||
    lastSpot === undefined ||
    !Number.isInteger(lastSpot) ||
    lastSpot < 1 ||
    lastSpot > SPOT_COUNT
  ) {
    return 1;
  }
  return ((lastSpot % SPOT_COUNT) + 1) as SpotNumber;
}

/** The spot that a choice of this site uses by default, and the one the scene marks as suggested. */
export function defaultSpotFor(entry: InjectionSiteEntry): SpotNumber {
  return nextSpot(entry.lastSpot);
}

/** What a floating label says: the suggested spot, the chosen spot, or a site the pointer or focus is on. */
export type LabelKind = 'suggested' | 'selected' | 'point';

export interface MapLabel {
  readonly site: SiteCode;
  readonly spot: SpotNumber;
  readonly kind: LabelKind;
}

export interface MapLabelInput {
  readonly entries: readonly InjectionSiteEntry[];
  readonly selectedSite: SiteCode | null;
  readonly selectedSpot: number | null;
  /** Site under the pointer on the canvas, if any. */
  readonly hoverSite: SiteCode | null;
  /** Site whose radio has keyboard focus, if any. */
  readonly focusSite: SiteCode | null;
}

/** A spot number when the value is one of 1 to 4, otherwise `null`. */
export function asSpot(value: number | null | undefined): SpotNumber | null {
  if (
    value === null ||
    value === undefined ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > SPOT_COUNT
  )
    return null;
  return value as SpotNumber;
}

/**
 * The floating labels on the canvas, one per site. Only the suggested site and the selected site
 * get a label by default; a site under the pointer or with keyboard focus gets one too, so its name
 * is reachable without the list being a mouse target. Each site appears once.
 */
export function mapLabels(input: MapLabelInput): MapLabel[] {
  const { entries, selectedSite, selectedSpot, hoverSite, focusSite } = input;
  const chosen = asSpot(selectedSpot);
  const result: MapLabel[] = [];
  const seen = new Set<SiteCode>();
  const add = (site: SiteCode, kind: LabelKind, spot: SpotNumber) => {
    if (seen.has(site)) return;
    seen.add(site);
    result.push({ site, spot, kind });
  };
  for (const entry of entries) {
    if (entry.state !== 'SUGGESTED') continue;
    const spot = entry.site === selectedSite && chosen !== null ? chosen : defaultSpotFor(entry);
    add(entry.site, 'suggested', spot);
  }
  const selectedEntry = entries.find((entry) => entry.site === selectedSite);
  if (selectedEntry) add(selectedEntry.site, 'selected', chosen ?? defaultSpotFor(selectedEntry));
  for (const site of [hoverSite, focusSite]) {
    const entry = entries.find((item) => item.site === site);
    if (entry) add(entry.site, 'point', defaultSpotFor(entry));
  }
  return result;
}

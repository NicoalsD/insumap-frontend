import { SITE_CODES, type SiteCode } from '@/services/dto/injection';
import { bodyStrings } from '@/i18n/es.body';
import { LOCALE } from '@/i18n/format';

/** Region of a site code: the part before the side ("ABDOMEN" in "ABDOMEN_LEFT"). */
export type SiteRegion = 'ABDOMEN' | 'THIGH' | 'ARM' | 'BUTTOCK';

export interface PlanSiteTexts {
  /** Shown when the plan puts no restriction on the site of an item (null). */
  readonly noRestriction: string;
  /** Shown when the plan lists no site at all for an item (empty list): nothing is allowed. */
  readonly noneAllowed: string;
  /** Region names in lowercase, for a list: "abdomen y muslo". */
  readonly region: Readonly<Record<SiteRegion, string>>;
}

const listFormat = new Intl.ListFormat(LOCALE, { style: 'long', type: 'conjunction' });

const regionOf = (site: SiteCode): SiteRegion => site.split('_')[0] as SiteRegion;

/**
 * Text of the sites a plan item allows, as the doctor reads it. Both sides of a region read as the
 * region ("Abdomen"); one side alone reads with its short name ("Abdomen izq."). `null` (no
 * restriction) reads as the plain phrase. The result starts with a capital letter.
 *
 * Pattern: none (plain function; tested in planSites.test.ts).
 */
export function describeAllowedSites(sites: readonly SiteCode[] | null, texts: PlanSiteTexts): string {
  if (sites === null) return texts.noRestriction;
  const allowed = new Set(sites);
  const parts: string[] = [];
  const regions = [...new Set(SITE_CODES.map(regionOf))];
  for (const region of regions) {
    const sidesInRegion = SITE_CODES.filter((site) => regionOf(site) === region);
    const allowedHere = sidesInRegion.filter((site) => allowed.has(site));
    if (allowedHere.length === 0) continue;
    if (allowedHere.length === sidesInRegion.length) parts.push(texts.region[region]);
    else parts.push(...allowedHere.map((site) => bodyStrings.siteShort[site]));
  }
  if (parts.length === 0) return texts.noneAllowed;
  const text = listFormat.format(parts);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

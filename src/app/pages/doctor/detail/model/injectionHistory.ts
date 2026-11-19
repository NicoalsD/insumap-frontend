import { DAY_MS, HOUR_MS } from '../constants';
import { SITE_CODES, type InsulinDoseDto, type SiteCode } from '@/services/dto/injection';

/** Days of dose history the doctor's view summarizes. */
export const HISTORY_DAYS = 14;
/** A site used within this many hours counts as RECENT, the same window the rotation rules use for basal. */
export const RECENT_HOURS = 72;
/**
 * Share of the doses with a site that one site may hold before the review aid appears. Product
 * choice for a review aid, not a clinical threshold: it only asks the doctor to look at rotation.
 */
export const CONCENTRATION_SHARE = 0.4;
/** Fewer doses than this and a single site can say nothing about rotation, so no aid is shown. */
export const MIN_DOSES_FOR_CONCENTRATION = 5;
/** Most recent doses listed in the panel. */
export const RECENT_DOSES_SHOWN = 8;

/** What the doctor sees of one site: how often it was used in the window and whether it is recent. */
export interface SiteUsage {
  readonly site: SiteCode;
  readonly count: number;
  readonly lastUsedAt: Date | null;
  readonly lastSpot: number | null;
  readonly recent: boolean;
}

export interface InjectionHistory {
  /** One entry per catalogue site, in catalogue order. */
  readonly sites: readonly SiteUsage[];
  /** Doses of the window that carry a site. */
  readonly withSite: number;
  /** The site that concentrates too many doses, or null. */
  readonly concentrated: SiteUsage | null;
  /** Most recent doses of the window, newest first. */
  readonly recentDoses: readonly InsulinDoseDto[];
}

/**
 * Summarizes the patient's recorded doses for the doctor: counts per site over the last
 * `HISTORY_DAYS`, RECENT sites within `RECENT_HOURS` of `periodEnd`, the most recent doses and the
 * repetition review aid. It reads recorded doses only and never computes units or suggests a dose.
 *
 * Pattern: none (plain function; tested in injectionHistory.test.ts).
 */
export function analyzeInjectionHistory(doses: readonly InsulinDoseDto[], periodEnd: Date): InjectionHistory {
  const endMs = periodEnd.getTime();
  const startMs = endMs - HISTORY_DAYS * DAY_MS;
  const recentMs = endMs - RECENT_HOURS * HOUR_MS;
  const windowed = doses
    .filter((dose) => {
      const at = Date.parse(dose.administered_at);
      return at >= startMs && at <= endMs;
    })
    .sort((a, b) => Date.parse(b.administered_at) - Date.parse(a.administered_at));

  const sites: SiteUsage[] = SITE_CODES.map((site) => {
    const used = windowed.filter((dose) => dose.injection_site === site);
    const last = used[0];
    const lastUsedAt = last ? new Date(last.administered_at) : null;
    return {
      site,
      count: used.length,
      lastUsedAt,
      lastSpot: last?.injection_spot ?? null,
      recent: lastUsedAt !== null && lastUsedAt.getTime() >= recentMs,
    };
  });

  const withSite = sites.reduce((total, usage) => total + usage.count, 0);
  const top = sites.reduce<SiteUsage | null>((best, usage) => (best === null || usage.count > best.count ? usage : best), null);
  const concentrated =
    top !== null && withSite >= MIN_DOSES_FOR_CONCENTRATION && top.count / withSite >= CONCENTRATION_SHARE ? top : null;

  return {
    sites,
    withSite,
    concentrated,
    recentDoses: windowed.slice(0, RECENT_DOSES_SHOWN),
  };
}

import {
  SITE_CODES,
  type InjectionReasonCode,
  type InjectionSiteState,
  type InjectionSitesDto,
  type InjectionSiteStatusDto,
  type InjectionSuggestionDto,
  type InsulinKind,
  type PatientSex,
  type PregnancyStatus,
  type SiteCode,
} from '@/services/dto/injection';

/**
 * Injection-site rules of BRIEF-injection, mirrored from the backend so the MSW handlers answer like
 * the API. Pure: no React, no clock, no network. The caller passes `now`.
 *
 * Pattern: none (plain functions; the pattern lives in the facade and the adapters).
 */

/** Version the mock answers with; the backend returns its own `rules_version` once it exists. */
export const INJECTION_RULES_VERSION = 'injection-rules-1';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** Rapid insulin: a site used in the last 24 h is recent. Basal: 72 h (BRIEF-injection). */
const RAPID_RECENT_MS = 24 * HOUR_MS;
const BASAL_RECENT_MS = 72 * HOUR_MS;
/** A lipohypertrophy symptom blocks its site for 90 days after it was reported. */
const LIPOHYPERTROPHY_LOOKBACK_MS = 90 * DAY_MS;
/** Lean: BMI under 20, or a man under 22. */
const LEAN_BMI = 20;
const LEAN_BMI_MALE = 22;
const MINOR_AGE_YEARS = 18;

/** A spot cycle is never empty, so the first element is always there to fall back on. */
type SpotCycle = readonly [number, ...number[]];
const ALL_SPOTS: SpotCycle = [1, 2, 3, 4];
/** Pregnancy: the central part of the abdomen is left out, so only the lateral spots (3 and 4) are used. */
const PREGNANCY_ABDOMEN_SPOTS: SpotCycle = [3, 4];

type SiteGroup = 'ABDOMEN' | 'THIGH' | 'ARM' | 'BUTTOCK';

const GROUP_OF: Record<SiteCode, SiteGroup> = {
  ABDOMEN_RIGHT: 'ABDOMEN',
  ABDOMEN_LEFT: 'ABDOMEN',
  THIGH_RIGHT: 'THIGH',
  THIGH_LEFT: 'THIGH',
  ARM_RIGHT: 'ARM',
  ARM_LEFT: 'ARM',
  BUTTOCK_RIGHT: 'BUTTOCK',
  BUTTOCK_LEFT: 'BUTTOCK',
};

const LIMB_GROUPS: ReadonlySet<SiteGroup> = new Set<SiteGroup>(['ARM', 'THIGH']);

/** Lower rank is preferred. Bolus and correction: abdomen first (fastest absorption). */
const BOLUS_ORDER: Record<SiteGroup, number> = { ABDOMEN: 0, THIGH: 1, BUTTOCK: 2, ARM: 3 };
/** Basal: thigh, then buttock (steady absorption). Women and other or unknown sex use this order. */
const BASAL_ORDER: Record<SiteGroup, number> = { THIGH: 0, BUTTOCK: 1, ABDOMEN: 2, ARM: 3 };
/** Basal in men: abdomen and buttock first. */
const BASAL_ORDER_MALE: Record<SiteGroup, number> = { ABDOMEN: 0, BUTTOCK: 1, THIGH: 2, ARM: 3 };

/** A dose already recorded with its site. Doses without a site do not take part in rotation. */
export interface InjectionHistoryEntry {
  readonly site: SiteCode;
  readonly spot: number;
  readonly kind: InsulinKind;
  readonly administeredAt: string;
}

/** What the rules need to know about the patient. */
export interface InjectionPatientProfile {
  readonly sex: PatientSex;
  /** `YYYY-MM-DD`, or null when the record has no birth date. */
  readonly birthDate: string | null;
  readonly bmi: number | null;
  readonly pregnancy: PregnancyStatus;
  readonly lipohypertrophy: readonly { readonly site: SiteCode; readonly reportedAt: string }[];
}

export interface InjectionRuleInput {
  readonly kind: InsulinKind;
  readonly now: Date;
  readonly profile: InjectionPatientProfile;
  /** Sites the plan allows for this kind, or null when the plan does not restrict them. */
  readonly plan: readonly SiteCode[] | null;
  readonly history: readonly InjectionHistoryEntry[];
}

/** Whole years between the birth date and `now`, in UTC. */
export function ageInYears(birthDate: string, now: Date): number {
  const birth = new Date(birthDate);
  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayThisYear = Date.UTC(now.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate());
  if (now.getTime() < birthdayThisYear) years -= 1;
  return years;
}

/** Lean for the rules: BMI under 20, or a man with BMI under 22. An unknown BMI is never lean. */
export function isLean(sex: PatientSex, bmi: number | null): boolean {
  if (bmi === null) return false;
  return bmi < LEAN_BMI || (sex === 'MALE' && bmi < LEAN_BMI_MALE);
}

/**
 * Sites the plan allows for one kind of insulin. Items of that kind with a restriction must all
 * allow the site (intersection); items without one do not restrict. Null when nothing restricts.
 */
export function planSitesFor(
  schedule: readonly {
    readonly insulin_kind: InsulinKind | null;
    readonly injection_sites: readonly SiteCode[] | null;
  }[],
  kind: InsulinKind,
): SiteCode[] | null {
  const restrictions = schedule
    .filter((item) => item.insulin_kind === kind)
    .map((item) => item.injection_sites)
    .filter((sites): sites is readonly SiteCode[] => sites !== null);
  if (restrictions.length === 0) return null;
  return SITE_CODES.filter((site) => restrictions.every((allowed) => allowed.includes(site)));
}

const isBolus = (kind: InsulinKind): boolean => kind === 'BOLUS' || kind === 'CORRECTION';
const recentWindowMs = (kind: InsulinKind): number =>
  kind === 'BASAL' ? BASAL_RECENT_MS : RAPID_RECENT_MS;
const isLeft = (site: SiteCode): boolean => site.endsWith('_LEFT');
const orderFor = (kind: InsulinKind, sex: PatientSex): Record<SiteGroup, number> => {
  if (kind !== 'BASAL') return BOLUS_ORDER;
  return sex === 'MALE' ? BASAL_ORDER_MALE : BASAL_ORDER;
};

function compare(a: number, b: number): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Next spot of the site: 1 to 2 to 3 to 4 and back to 1; under pregnancy the abdomen cycles 3 and 4. */
function nextSpot(cycle: SpotCycle, lastSpot: number): number {
  return cycle.find((spot) => spot > lastSpot) ?? cycle[0];
}

type Classification = {
  readonly state: InjectionSiteState;
  readonly reason: InjectionReasonCode | null;
};

/**
 * Suggested site of one injection and the state of every site (BRIEF-injection, rules 1 to 5).
 *
 * 1. Candidates are the sites the plan allows (null = all).
 * 2. Out: lipohypertrophy in 90 days; plan restriction; for a bolus in a lean patient, arms and
 *    thighs unless the plan asks for them. Pregnancy keeps the abdomen but only spots 3 and 4.
 * 3. Preference: bolus and correction to the abdomen; basal to thigh, then buttock (men: abdomen,
 *    buttock first); mixed to the abdomen.
 * 4. Rotation: never the last site used of the same insulin family (rapid or basal) while another one
 *    is eligible; within the zone prefer a site
 *    outside its window (RECENT is 24 h for rapid, 72 h for basal, by the kind of the dose), then
 *    alternate left and right, then the oldest use. Within the site, advance the spot.
 *    RECENT is a state, not an exclusion: a bolus still goes to the abdomen when it was used lately.
 * 5. One SUGGESTED. `suggestion` is null only when no site is eligible at all (every site is AVOID).
 */
export function suggestInjectionSite(input: InjectionRuleInput): InjectionSitesDto {
  const { kind, now, profile, plan, history } = input;
  const nowMs = now.getTime();
  const bolus = isBolus(kind);
  const pregnant = profile.pregnancy === 'PREGNANT';
  const minor = profile.birthDate !== null && ageInYears(profile.birthDate, now) < MINOR_AGE_YEARS;
  const lean = isLean(profile.sex, profile.bmi);

  const lastBySite = new Map<SiteCode, InjectionHistoryEntry>();
  for (const dose of history) {
    const current = lastBySite.get(dose.site);
    if (
      current === undefined ||
      Date.parse(dose.administeredAt) > Date.parse(current.administeredAt)
    ) {
      lastBySite.set(dose.site, dose);
    }
  }
  // Rotation runs per insulin family: rapid (bolus, correction, mixed) or basal. A basal dose on the
  // thigh does not count as the last bolus site, and the reverse.
  const familyOf = (kind: InsulinKind): 'BASAL' | 'RAPID' => (kind === 'BASAL' ? 'BASAL' : 'RAPID');
  const lastOfFamily = history
    .filter((dose) => familyOf(dose.kind) === familyOf(kind))
    .reduce<InjectionHistoryEntry | undefined>(
      (latest, dose) =>
        latest === undefined || Date.parse(dose.administeredAt) > Date.parse(latest.administeredAt)
          ? dose
          : latest,
      undefined,
    );
  const lastSite = lastOfFamily?.site;

  const classify = (site: SiteCode): Classification => {
    if (plan !== null && !plan.includes(site)) return { state: 'AVOID', reason: 'PLAN_RESTRICTED' };
    const lipohypertrophy = profile.lipohypertrophy.some(
      (entry) =>
        entry.site === site && nowMs - Date.parse(entry.reportedAt) <= LIPOHYPERTROPHY_LOOKBACK_MS,
    );
    if (lipohypertrophy) return { state: 'AVOID', reason: 'LIPOHYPERTROPHY_REPORTED' };
    // "Unless the plan asks for them": a restricted plan that lists a limb keeps it (plan !== null).
    if (plan === null && bolus && lean && LIMB_GROUPS.has(GROUP_OF[site])) {
      return { state: 'AVOID', reason: 'LEAN_AVOID_LIMBS' };
    }
    const last = lastBySite.get(site);
    if (last !== undefined && nowMs - Date.parse(last.administeredAt) < recentWindowMs(last.kind)) {
      return { state: 'RECENT', reason: 'RECENTLY_USED' };
    }
    if (pregnant && GROUP_OF[site] === 'ABDOMEN') {
      return { state: 'ALLOWED', reason: 'PREGNANCY_AVOID_ABDOMEN_CENTER' };
    }
    return { state: 'ALLOWED', reason: null };
  };

  const classified = SITE_CODES.map((site) => ({
    site,
    ...classify(site),
    last: lastBySite.get(site),
  }));
  const eligible = classified.filter((entry) => entry.state !== 'AVOID');
  // Rotation (rule 4): the last site used is skipped unless it is the only eligible one.
  const pool = eligible.filter((entry) => entry.site !== lastSite);
  const candidates = pool.length > 0 ? pool : eligible;

  const order = orderFor(kind, profile.sex);
  const lastIsLeft = lastSite === undefined ? null : isLeft(lastSite);
  const recentFlag = (entry: (typeof classified)[number]): number =>
    Number(entry.state === 'RECENT');
  const lastUsedMs = (entry: (typeof classified)[number]): number =>
    entry.last === undefined ? Number.NEGATIVE_INFINITY : Date.parse(entry.last.administeredAt);
  const sameSideAsLast = (entry: (typeof classified)[number]): number =>
    lastIsLeft === null ? 0 : Number(isLeft(entry.site) === lastIsLeft);
  const ranked = [...candidates].sort(
    (a, b) =>
      compare(order[GROUP_OF[a.site]], order[GROUP_OF[b.site]]) ||
      compare(recentFlag(a), recentFlag(b)) ||
      compare(sameSideAsLast(a), sameSideAsLast(b)) ||
      compare(lastUsedMs(a), lastUsedMs(b)) ||
      compare(SITE_CODES.indexOf(a.site), SITE_CODES.indexOf(b.site)),
  );
  const chosen = ranked[0];

  if (chosen === undefined) {
    return {
      kind,
      suggestion: null,
      sites: classified.map(toStatus(null, [])),
      rules_version: INJECTION_RULES_VERSION,
    };
  }

  const chosenGroup = GROUP_OF[chosen.site];
  const spotCycle = pregnant && chosenGroup === 'ABDOMEN' ? PREGNANCY_ABDOMEN_SPOTS : ALL_SPOTS;
  const spot = nextSpot(spotCycle, chosen.last?.spot ?? 0);

  const reasons: InjectionReasonCode[] = [];
  if (bolus && chosenGroup === 'ABDOMEN') reasons.push('FASTEST_ABSORPTION');
  if (kind === 'BASAL' && (chosenGroup === 'THIGH' || chosenGroup === 'BUTTOCK'))
    reasons.push('STEADY_ABSORPTION');
  if (pregnant && chosenGroup === 'ABDOMEN') reasons.push('PREGNANCY_AVOID_ABDOMEN_CENTER');
  if (chosen.last !== undefined) reasons.push('ROTATE_NEXT');

  // Pinch up for minors and for the lean. The "arm or thigh at low BMI" case is already lean.
  const pinchUp = minor || lean;
  const suggestion: InjectionSuggestionDto = {
    site: chosen.site,
    spot,
    reason_codes: reasons,
    needle_note: pinchUp ? 'NEEDLE_4MM_PINCH_UP' : 'NEEDLE_4MM_PINCH_OPTIONAL',
    pinch_up: pinchUp,
  };
  return {
    kind,
    suggestion,
    sites: classified.map(toStatus(chosen.site, reasons)),
    rules_version: INJECTION_RULES_VERSION,
  };
}

/** Status row of one site; the chosen site is SUGGESTED and shows the first reason of the suggestion. */
function toStatus(
  suggested: SiteCode | null,
  reasons: readonly InjectionReasonCode[],
): (entry: {
  readonly site: SiteCode;
  readonly state: InjectionSiteState;
  readonly reason: InjectionReasonCode | null;
  readonly last: InjectionHistoryEntry | undefined;
}) => InjectionSiteStatusDto {
  return (entry) => {
    const isSuggested = entry.site === suggested;
    return {
      site: entry.site,
      state: isSuggested ? 'SUGGESTED' : entry.state,
      reason_code: isSuggested ? (reasons[0] ?? null) : entry.reason,
      last_used_at: entry.last?.administeredAt ?? null,
      last_spot: entry.last?.spot ?? null,
    };
  };
}

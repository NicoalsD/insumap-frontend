import { describe, expect, it } from 'vitest';
import {
  INJECTION_REASON_CODES,
  SITE_CODES,
  type InjectionSitesDto,
  type InjectionSiteStatusDto,
  type InsulinKind,
  type PatientSex,
  type PregnancyStatus,
  type SiteCode,
} from '@/services/dto/injection';
import {
  ageInYears,
  isLean,
  planSitesFor,
  suggestInjectionSite,
  type InjectionHistoryEntry,
  type InjectionPatientProfile,
  type InjectionRuleInput,
} from './injectionRules';

const NOW = new Date('2026-11-19T15:00:00.000Z');
const HOUR_MS = 3_600_000;
const NINETY_DAYS_MS = 90 * 24 * HOUR_MS;
const hoursAgo = (hours: number): string => new Date(NOW.getTime() - hours * HOUR_MS).toISOString();
const daysAgo = (days: number): string => hoursAgo(days * 24);

const WOMAN: InjectionPatientProfile = {
  sex: 'FEMALE',
  birthDate: '1992-03-18',
  bmi: 23.4,
  pregnancy: 'NONE',
  lipohypertrophy: [],
};
const MAN: InjectionPatientProfile = { ...WOMAN, sex: 'MALE', bmi: 26 };

function profile(overrides: Partial<InjectionPatientProfile> = {}): InjectionPatientProfile {
  return { ...WOMAN, ...overrides };
}

function dose(
  site: SiteCode,
  spot: number,
  hours: number,
  kind: InsulinKind = 'BOLUS',
): InjectionHistoryEntry {
  return { site, spot, kind, administeredAt: hoursAgo(hours) };
}

function run(overrides: Partial<InjectionRuleInput> = {}): InjectionSitesDto {
  return suggestInjectionSite({
    kind: 'BOLUS',
    now: NOW,
    profile: WOMAN,
    plan: null,
    history: [],
    ...overrides,
  });
}

function statusOf(result: InjectionSitesDto, site: SiteCode): InjectionSiteStatusDto {
  const found = result.sites.find((row) => row.site === site);
  if (!found) throw new Error(`missing site ${site}`);
  return found;
}

function suggestedSite(result: InjectionSitesDto): SiteCode {
  if (!result.suggestion) throw new Error('expected a suggestion');
  return result.suggestion.site;
}

const LIMBS: readonly SiteCode[] = ['ARM_LEFT', 'ARM_RIGHT', 'THIGH_LEFT', 'THIGH_RIGHT'];

describe('ageInYears', () => {
  it('counts whole years and flips on the birthday, in UTC', () => {
    expect(ageInYears('2008-11-19', NOW)).toBe(18);
    expect(ageInYears('2008-11-20', NOW)).toBe(17);
    expect(ageInYears('1992-03-18', NOW)).toBe(34);
  });
});

describe('isLean', () => {
  it('uses BMI under 20 for everyone and under 22 for men', () => {
    expect(isLean('FEMALE', 19.9)).toBe(true);
    expect(isLean('FEMALE', 20)).toBe(false);
    expect(isLean('MALE', 21.9)).toBe(true);
    expect(isLean('MALE', 22)).toBe(false);
    expect(isLean('UNKNOWN', 21)).toBe(false);
  });

  it('is never lean without a BMI', () => {
    const sexes: readonly PatientSex[] = ['FEMALE', 'MALE', 'OTHER', 'UNKNOWN'];
    for (const sex of sexes) expect(isLean(sex, null)).toBe(false);
  });
});

describe('planSitesFor', () => {
  const restrictedBasal: SiteCode[] = ['ABDOMEN_LEFT', 'THIGH_RIGHT'];
  const schedule = [
    { insulin_kind: null, injection_sites: null },
    { insulin_kind: 'BOLUS' as const, injection_sites: null },
    { insulin_kind: 'BASAL' as const, injection_sites: restrictedBasal },
  ];

  it('is null when no item of that kind restricts the sites', () => {
    expect(planSitesFor(schedule, 'BOLUS')).toBeNull();
    expect(planSitesFor(schedule, 'MIXED')).toBeNull();
    expect(planSitesFor([], 'BASAL')).toBeNull();
  });

  it('returns the restricted sites in canonical order', () => {
    expect(planSitesFor(schedule, 'BASAL')).toEqual(['ABDOMEN_LEFT', 'THIGH_RIGHT']);
  });

  it('intersects several restrictions of the same kind', () => {
    const first: SiteCode[] = ['ABDOMEN_LEFT', 'THIGH_RIGHT', 'ARM_LEFT'];
    const second: SiteCode[] = ['THIGH_RIGHT', 'ARM_LEFT'];
    const two = [
      { insulin_kind: 'BASAL' as const, injection_sites: first },
      { insulin_kind: 'BASAL' as const, injection_sites: second },
    ];
    expect(planSitesFor(two, 'BASAL')).toEqual(['THIGH_RIGHT', 'ARM_LEFT']);
  });
});

describe('bolus and correction: abdomen first (BRIEF rule 3)', () => {
  it('suggests the abdomen with spot 1 and FASTEST_ABSORPTION for a woman with no history', () => {
    const result = run();
    expect(result.suggestion).toEqual({
      site: 'ABDOMEN_RIGHT',
      spot: 1,
      reason_codes: ['FASTEST_ABSORPTION'],
      needle_note: 'NEEDLE_4MM_PINCH_OPTIONAL',
      pinch_up: false,
    });
    expect(result.kind).toBe('BOLUS');
    expect(result.rules_version).toBe('injection-rules-1');
  });

  it('treats a correction like a bolus', () => {
    const result = run({ kind: 'CORRECTION' });
    expect(suggestedSite(result)).toBe('ABDOMEN_RIGHT');
    expect(result.suggestion?.reason_codes).toContain('FASTEST_ABSORPTION');
  });

  it('keeps the mixed insulin on the abdomen without the bolus-only reason', () => {
    const result = run({ kind: 'MIXED' });
    expect(suggestedSite(result)).toBe('ABDOMEN_RIGHT');
    expect(result.suggestion?.reason_codes).not.toContain('FASTEST_ABSORPTION');
  });

  it('is the opposite of basal for the same profile and history', () => {
    const bolus = run({ kind: 'BOLUS' });
    const basal = run({ kind: 'BASAL' });
    expect(suggestedSite(bolus)).toMatch(/^ABDOMEN_/);
    expect(suggestedSite(basal)).toMatch(/^THIGH_/);
  });
});

describe('basal: thigh, then buttock (BRIEF rule 3)', () => {
  it('suggests the thigh for a woman, with STEADY_ABSORPTION', () => {
    const result = run({ kind: 'BASAL' });
    expect(suggestedSite(result)).toBe('THIGH_RIGHT');
    expect(result.suggestion?.reason_codes).toContain('STEADY_ABSORPTION');
    expect(result.suggestion?.reason_codes).not.toContain('FASTEST_ABSORPTION');
  });

  it('suggests the abdomen first for a man, then the buttock', () => {
    const result = run({ kind: 'BASAL', profile: MAN });
    expect(suggestedSite(result)).toBe('ABDOMEN_RIGHT');
    expect(result.suggestion?.reason_codes).not.toContain('STEADY_ABSORPTION');

    // The right abdomen is the last site used, so the left one (still inside its window) comes next.
    const withAbdomenUsed = run({
      kind: 'BASAL',
      profile: MAN,
      history: [dose('ABDOMEN_RIGHT', 1, 30, 'BASAL'), dose('ABDOMEN_LEFT', 1, 50, 'BASAL')],
    });
    expect(withAbdomenUsed.suggestion).toMatchObject({ site: 'ABDOMEN_LEFT', spot: 2 });
    expect(statusOf(withAbdomenUsed, 'ABDOMEN_LEFT').state).toBe('SUGGESTED');
  });

  it('moves a woman from a recent thigh to the other thigh', () => {
    const otherThigh = run({ kind: 'BASAL', history: [dose('THIGH_RIGHT', 1, 10, 'BASAL')] });
    expect(suggestedSite(otherThigh)).toBe('THIGH_LEFT');
  });

  it('keeps the thighs while they are eligible, and the buttock waits for them', () => {
    // The thigh left was used 30 h ago (recent, but eligible): it still comes before the buttock.
    const bothThighsRecent = run({
      kind: 'BASAL',
      history: [dose('THIGH_RIGHT', 1, 10, 'BASAL'), dose('THIGH_LEFT', 1, 30, 'BASAL')],
    });
    expect(bothThighsRecent.suggestion).toMatchObject({ site: 'THIGH_LEFT', spot: 2 });
    expect(bothThighsRecent.suggestion?.reason_codes).toContain('STEADY_ABSORPTION');
  });

  it('moves to the buttock only when both thighs are out', () => {
    const plan: SiteCode[] = ['THIGH_RIGHT', 'THIGH_LEFT', 'BUTTOCK_LEFT'];
    const result = run({
      kind: 'BASAL',
      plan,
      profile: profile({ lipohypertrophy: [{ site: 'THIGH_LEFT', reportedAt: daysAgo(5) }] }),
      history: [dose('THIGH_RIGHT', 1, 10, 'BASAL')],
    });
    expect(suggestedSite(result)).toBe('BUTTOCK_LEFT');
  });
});

describe('pregnancy (BRIEF rule 2): the abdomen keeps only spots 3 and 4', () => {
  const pregnant = profile({ pregnancy: 'PREGNANT' });

  it('suggests the abdomen with spot 3 and the pregnancy reason for a bolus', () => {
    const result = run({ profile: pregnant });
    expect(result.suggestion?.site).toBe('ABDOMEN_RIGHT');
    expect(result.suggestion?.spot).toBe(3);
    expect(result.suggestion?.reason_codes).toEqual(
      expect.arrayContaining(['FASTEST_ABSORPTION', 'PREGNANCY_AVOID_ABDOMEN_CENTER']),
    );
  });

  it('marks the other abdomen as allowed with the pregnancy reason, not avoided', () => {
    const result = run({ profile: pregnant });
    expect(statusOf(result, 'ABDOMEN_LEFT')).toEqual({
      site: 'ABDOMEN_LEFT',
      state: 'ALLOWED',
      reason_code: 'PREGNANCY_AVOID_ABDOMEN_CENTER',
      last_used_at: null,
      last_spot: null,
    });
  });

  it('advances the spot from 3 to 4 on the side that was not used last', () => {
    const result = run({
      profile: pregnant,
      history: [dose('ABDOMEN_LEFT', 3, 50), dose('ABDOMEN_RIGHT', 1, 30)],
    });
    expect(result.suggestion).toMatchObject({ site: 'ABDOMEN_LEFT', spot: 4 });
  });

  it('returns from spot 4 to 3 on the side that was not used last', () => {
    const result = run({
      profile: pregnant,
      history: [dose('ABDOMEN_LEFT', 4, 50), dose('ABDOMEN_RIGHT', 1, 30)],
    });
    expect(result.suggestion).toMatchObject({ site: 'ABDOMEN_LEFT', spot: 3 });
  });

  it('wraps from spot 4 to 3 on the other side when the last dose was on the left', () => {
    const result = run({
      profile: pregnant,
      history: [dose('ABDOMEN_LEFT', 3, 30), dose('ABDOMEN_RIGHT', 4, 50)],
    });
    expect(result.suggestion).toMatchObject({ site: 'ABDOMEN_RIGHT', spot: 3 });
  });

  it('starts at spot 3 when the last spot was 1 or 2 before the pregnancy', () => {
    const result = run({
      profile: pregnant,
      history: [dose('ABDOMEN_LEFT', 2, 30), dose('ABDOMEN_RIGHT', 1, 60)],
    });
    expect(result.suggestion).toMatchObject({ site: 'ABDOMEN_RIGHT', spot: 3 });
  });

  it('never suggests spots 1 or 2 on the abdomen while pregnant', () => {
    const scenarios: InjectionHistoryEntry[][] = [
      [],
      [dose('ABDOMEN_RIGHT', 1, 40)],
      [dose('ABDOMEN_LEFT', 2, 40), dose('ABDOMEN_RIGHT', 4, 60)],
    ];
    for (const history of scenarios) {
      const result = run({ profile: pregnant, history });
      if (result.suggestion?.site.startsWith('ABDOMEN_')) {
        expect([3, 4]).toContain(result.suggestion.spot);
      }
    }
  });

  it('suggests the thigh for basal and does not put the pregnancy reason on it', () => {
    const result = run({ kind: 'BASAL', profile: pregnant });
    expect(suggestedSite(result)).toBe('THIGH_RIGHT');
    expect(statusOf(result, 'THIGH_RIGHT').reason_code).toBe('STEADY_ABSORPTION');
  });
});

describe('lean patients (BRIEF rule 2): no arms or thighs for a bolus unless the plan asks for them', () => {
  const leanWoman = profile({ bmi: 19 });
  const leanMan = profile({ sex: 'MALE', bmi: 21 });

  it('removes arms and thighs from a bolus for a lean woman, with LEAN_AVOID_LIMBS', () => {
    const result = run({ profile: leanWoman });
    for (const site of LIMBS) {
      expect(statusOf(result, site)).toMatchObject({
        state: 'AVOID',
        reason_code: 'LEAN_AVOID_LIMBS',
      });
    }
    expect(statusOf(result, 'BUTTOCK_LEFT').state).not.toBe('AVOID');
  });

  it('removes arms and thighs from a bolus for a man with BMI under 22', () => {
    const result = run({ profile: leanMan });
    expect(suggestedSite(result)).toBe('ABDOMEN_RIGHT');
    for (const site of LIMBS) expect(statusOf(result, site).state).toBe('AVOID');
    expect(statusOf(result, 'BUTTOCK_RIGHT').state).toBe('ALLOWED');
  });

  it('does not remove the limbs for a man with BMI 22 (the line is strict)', () => {
    const result = run({ profile: profile({ sex: 'MALE', bmi: 22 }) });
    for (const site of LIMBS) expect(statusOf(result, site).state).toBe('ALLOWED');
  });

  it('keeps the limbs for a basal in a lean patient, with the pinch of the needle', () => {
    const result = run({ kind: 'BASAL', profile: leanWoman });
    expect(suggestedSite(result)).toBe('THIGH_RIGHT');
    expect(result.suggestion?.pinch_up).toBe(true);
    expect(result.suggestion?.needle_note).toBe('NEEDLE_4MM_PINCH_UP');
    expect(statusOf(result, 'THIGH_RIGHT').state).toBe('SUGGESTED');
  });

  it('keeps the limbs for a mixed insulin in a lean patient (decision: only bolus and correction)', () => {
    const result = run({ kind: 'MIXED', profile: leanMan });
    expect(statusOf(result, 'THIGH_LEFT').state).toBe('ALLOWED');
  });

  it('keeps an arm the plan asks for, even for a lean bolus', () => {
    const result = run({ profile: leanMan, plan: ['ARM_LEFT', 'ABDOMEN_RIGHT'] });
    expect(statusOf(result, 'ARM_LEFT').state).toBe('ALLOWED');
    expect(suggestedSite(result)).toBe('ABDOMEN_RIGHT');
  });

  it('does not treat an unknown BMI as lean', () => {
    const result = run({ profile: profile({ bmi: null }) });
    for (const site of LIMBS) expect(statusOf(result, site).state).toBe('ALLOWED');
  });
});

describe('plan restriction (BRIEF rule 1)', () => {
  it('only suggests sites the plan allows and marks the rest PLAN_RESTRICTED', () => {
    const plan: SiteCode[] = ['ABDOMEN_LEFT', 'THIGH_RIGHT'];
    const result = run({ kind: 'BASAL', plan });
    expect(suggestedSite(result)).toBe('THIGH_RIGHT');
    for (const row of result.sites) {
      if (!plan.includes(row.site))
        expect(row).toMatchObject({ state: 'AVOID', reason_code: 'PLAN_RESTRICTED' });
    }
  });

  it('applies a bolus restriction to the abdomen only', () => {
    const result = run({ plan: ['ABDOMEN_LEFT'] });
    expect(suggestedSite(result)).toBe('ABDOMEN_LEFT');
    expect(statusOf(result, 'ABDOMEN_RIGHT').reason_code).toBe('PLAN_RESTRICTED');
  });
});

describe('lipohypertrophy (BRIEF rule 2): 90 days', () => {
  it('avoids a site with a symptom 89 days old, and allows it once 91 days have passed', () => {
    const recent = run({
      profile: profile({ lipohypertrophy: [{ site: 'ABDOMEN_RIGHT', reportedAt: daysAgo(89) }] }),
    });
    expect(statusOf(recent, 'ABDOMEN_RIGHT')).toMatchObject({
      state: 'AVOID',
      reason_code: 'LIPOHYPERTROPHY_REPORTED',
    });
    expect(suggestedSite(recent)).toBe('ABDOMEN_LEFT');

    const old = run({
      profile: profile({ lipohypertrophy: [{ site: 'ABDOMEN_RIGHT', reportedAt: daysAgo(91) }] }),
    });
    expect(statusOf(old, 'ABDOMEN_RIGHT').state).not.toBe('AVOID');
    expect(suggestedSite(old)).toBe('ABDOMEN_RIGHT');
  });

  it('keeps the plan reason first when the plan and the lipohypertrophy both apply', () => {
    const result = run({
      plan: ['ABDOMEN_LEFT'],
      profile: profile({ lipohypertrophy: [{ site: 'ABDOMEN_RIGHT', reportedAt: daysAgo(10) }] }),
    });
    expect(statusOf(result, 'ABDOMEN_RIGHT').reason_code).toBe('PLAN_RESTRICTED');
  });
});

describe('rotation (BRIEF rule 4)', () => {
  it('alternates to the other side after a dose on one side', () => {
    const result = run({ history: [dose('ABDOMEN_RIGHT', 1, 30)] });
    expect(result.suggestion).toEqual({
      site: 'ABDOMEN_LEFT',
      spot: 1,
      reason_codes: ['FASTEST_ABSORPTION'],
      needle_note: 'NEEDLE_4MM_PINCH_OPTIONAL',
      pinch_up: false,
    });
  });

  it('avoids the last site used even when it is outside its window', () => {
    // The right side was used 100 hours ago (outside 24 h), and it is still the last one.
    const result = run({
      history: [dose('ABDOMEN_LEFT', 1, 200), dose('ABDOMEN_RIGHT', 1, 100)],
    });
    expect(suggestedSite(result)).toBe('ABDOMEN_LEFT');
    expect(statusOf(result, 'ABDOMEN_LEFT')).toMatchObject({ last_spot: 1, state: 'SUGGESTED' });
  });

  it('advances the spot of the chosen site from its last spot', () => {
    const result = run({
      history: [dose('ABDOMEN_LEFT', 1, 30), dose('ABDOMEN_RIGHT', 2, 50)],
    });
    expect(result.suggestion).toMatchObject({ site: 'ABDOMEN_RIGHT', spot: 3 });
    expect(result.suggestion?.reason_codes).toContain('ROTATE_NEXT');
  });

  it('wraps the spot from 4 back to 1', () => {
    const result = run({
      history: [dose('ABDOMEN_LEFT', 4, 60), dose('ABDOMEN_RIGHT', 2, 30)],
    });
    expect(result.suggestion).toMatchObject({ site: 'ABDOMEN_LEFT', spot: 1 });
  });

  it('reports the last use and spot of every site in the sites list', () => {
    const result = run({ history: [dose('ABDOMEN_RIGHT', 2, 30), dose('ABDOMEN_RIGHT', 1, 60)] });
    expect(statusOf(result, 'ABDOMEN_RIGHT')).toMatchObject({
      last_spot: 2,
      last_used_at: hoursAgo(30),
    });
    expect(statusOf(result, 'THIGH_LEFT')).toMatchObject({ last_spot: null, last_used_at: null });
  });

  it('takes the last spot from the most recent dose of a site, not from the first one listed', () => {
    const result = run({
      history: [
        dose('ABDOMEN_LEFT', 4, 100),
        dose('ABDOMEN_LEFT', 2, 30),
        dose('ABDOMEN_RIGHT', 1, 60),
      ],
    });
    expect(statusOf(result, 'ABDOMEN_LEFT')).toMatchObject({
      last_spot: 2,
      last_used_at: hoursAgo(30),
    });
  });
});

describe('rotation per insulin family: a dose of the other family does not set the last site', () => {
  it('keeps the bolus on the side opposite the last bolus, even after a basal on the thigh', () => {
    // The dinner bolus (12 h) was on the left; the basal (9.5 h) on the right thigh. The bolus goes right.
    const result = run({
      history: [dose('ABDOMEN_LEFT', 1, 12), dose('THIGH_RIGHT', 1, 9.5, 'BASAL')],
    });
    expect(result.suggestion).toMatchObject({ site: 'ABDOMEN_RIGHT', spot: 1 });
  });

  it('does not repeat the last bolus side when both abdomens are recent and a basal came last', () => {
    // Last bolus: left (3 h). Right abdomen (12 h). The basal on the right thigh (1 h) is the latest dose.
    const result = run({
      history: [
        dose('ABDOMEN_RIGHT', 1, 12),
        dose('ABDOMEN_LEFT', 1, 3),
        dose('THIGH_RIGHT', 1, 1, 'BASAL'),
      ],
    });
    expect(result.suggestion).toMatchObject({ site: 'ABDOMEN_RIGHT', spot: 2 });
  });

  it('mirror: the basal does not repeat the last basal thigh when a bolus came last', () => {
    // Last basal: left thigh (12 h). Right thigh (40 h). The bolus on the right abdomen (2 h) is the latest dose.
    const result = run({
      kind: 'BASAL',
      history: [
        dose('THIGH_RIGHT', 1, 40, 'BASAL'),
        dose('THIGH_LEFT', 1, 12, 'BASAL'),
        dose('ABDOMEN_RIGHT', 1, 2),
      ],
    });
    expect(result.suggestion).toMatchObject({ site: 'THIGH_RIGHT', spot: 2 });
  });
});

describe('recent sites are a state, not an exclusion (regression for three meals a day)', () => {
  it('keeps a bolus on the abdomen when the other abdomen side was used lately', () => {
    // Both abdomen sides are inside 24 h. The right side was last, so the left one is chosen, not a thigh.
    const result = run({
      history: [dose('ABDOMEN_LEFT', 1, 12), dose('ABDOMEN_RIGHT', 1, 3)],
    });
    expect(result.suggestion).toMatchObject({ site: 'ABDOMEN_LEFT', spot: 2 });
    expect(statusOf(result, 'ABDOMEN_LEFT').state).toBe('SUGGESTED');
    expect(statusOf(result, 'ABDOMEN_RIGHT').state).toBe('RECENT');
    expect(result.suggestion?.reason_codes).toEqual(
      expect.arrayContaining(['FASTEST_ABSORPTION', 'ROTATE_NEXT']),
    );
  });
});

describe('recent sites (BRIEF state RECENT: 24 h rapid, 72 h basal, by the dose kind)', () => {
  it('marks a site used 23 hours ago as RECENT for a bolus, and suggests another', () => {
    const result = run({ history: [dose('ABDOMEN_RIGHT', 1, 23)] });
    expect(statusOf(result, 'ABDOMEN_RIGHT')).toMatchObject({
      state: 'RECENT',
      reason_code: 'RECENTLY_USED',
    });
    expect(suggestedSite(result)).toBe('ABDOMEN_LEFT');
  });

  it('releases a rapid site after 25 hours', () => {
    const result = run({ history: [dose('ABDOMEN_RIGHT', 1, 25)] });
    expect(statusOf(result, 'ABDOMEN_RIGHT').state).toBe('ALLOWED');
  });

  it('keeps a basal site RECENT for 72 hours and releases it after 80', () => {
    const inside = run({ kind: 'BASAL', history: [dose('THIGH_RIGHT', 1, 50, 'BASAL')] });
    expect(statusOf(inside, 'THIGH_RIGHT').state).toBe('RECENT');
    const outside = run({ kind: 'BASAL', history: [dose('THIGH_RIGHT', 1, 80, 'BASAL')] });
    expect(statusOf(outside, 'THIGH_RIGHT').state).toBe('ALLOWED');
  });

  it('uses the window of the dose kind, so a recent bolus blocks a site for basal too', () => {
    const result = run({ kind: 'BASAL', history: [dose('THIGH_RIGHT', 1, 10, 'BOLUS')] });
    expect(statusOf(result, 'THIGH_RIGHT').state).toBe('RECENT');
  });

  it('still answers when the only eligible site is the one used last', () => {
    const result = run({
      plan: ['ABDOMEN_RIGHT'],
      history: [dose('ABDOMEN_RIGHT', 2, 2)],
    });
    expect(result.suggestion).toMatchObject({ site: 'ABDOMEN_RIGHT', spot: 3 });
    expect(statusOf(result, 'ABDOMEN_RIGHT').state).toBe('SUGGESTED');
  });
});

describe('no safe site', () => {
  it('returns no suggestion when every site is avoided, and keeps the reasons', () => {
    const result = run({
      plan: ['ARM_LEFT'],
      profile: profile({ lipohypertrophy: [{ site: 'ARM_LEFT', reportedAt: daysAgo(5) }] }),
    });
    expect(result.suggestion).toBeNull();
    expect(result.sites.filter((row) => row.state === 'SUGGESTED')).toHaveLength(0);
    expect(statusOf(result, 'ARM_LEFT')).toMatchObject({
      state: 'AVOID',
      reason_code: 'LIPOHYPERTROPHY_REPORTED',
    });
  });
});

describe('needle note (BRIEF): minors and the lean get the pinch', () => {
  it('uses the pinch for a patient under 18', () => {
    const result = run({ profile: profile({ birthDate: '2012-05-01' }) });
    expect(result.suggestion?.needle_note).toBe('NEEDLE_4MM_PINCH_UP');
    expect(result.suggestion?.pinch_up).toBe(true);
  });

  it('does not use the pinch for an adult in range', () => {
    const result = run({ profile: profile({ birthDate: '2008-11-19' }) });
    expect(result.suggestion?.needle_note).toBe('NEEDLE_4MM_PINCH_OPTIONAL');
    expect(result.suggestion?.pinch_up).toBe(false);
  });

  it('uses the pinch for the lean', () => {
    const result = run({ profile: profile({ bmi: 18.5 }) });
    expect(result.suggestion?.pinch_up).toBe(true);
  });
});

describe('determinism and shape', () => {
  it('gives the same answer for the same input', () => {
    const input: InjectionRuleInput = {
      kind: 'BOLUS',
      now: NOW,
      profile: WOMAN,
      plan: null,
      history: [dose('ABDOMEN_RIGHT', 1, 30)],
    };
    expect(suggestInjectionSite(input)).toEqual(suggestInjectionSite(input));
  });

  it('lists the eight sites once each, in canonical order, with known states and reasons', () => {
    const result = run({ history: [dose('ABDOMEN_RIGHT', 1, 5)] });
    expect(result.sites.map((row) => row.site)).toEqual([...SITE_CODES]);
    for (const row of result.sites) {
      if (row.reason_code !== null)
        expect(INJECTION_REASON_CODES as readonly string[]).toContain(row.reason_code);
    }
  });
});

describe('invariants over the whole grid of profiles, kinds, plans and histories', () => {
  const sexes: readonly PatientSex[] = ['FEMALE', 'MALE', 'OTHER', 'UNKNOWN'];
  const bmis: readonly (number | null)[] = [null, 18.5, 21.5, 22, 25];
  const pregnancies: readonly PregnancyStatus[] = ['NONE', 'PREGNANT', 'UNKNOWN'];
  const kinds: readonly InsulinKind[] = ['BASAL', 'BOLUS', 'CORRECTION', 'MIXED'];
  const plans: readonly (readonly SiteCode[] | null)[] = [
    null,
    ['ABDOMEN_LEFT'],
    ['THIGH_RIGHT', 'ARM_LEFT', 'ABDOMEN_RIGHT'],
    [],
  ];
  const histories: readonly (readonly InjectionHistoryEntry[])[] = [
    [],
    [dose('ABDOMEN_RIGHT', 1, 5)],
    [
      dose('ABDOMEN_RIGHT', 4, 40),
      dose('ABDOMEN_LEFT', 2, 70),
      dose('THIGH_RIGHT', 1, 20, 'BASAL'),
    ],
    [
      dose('THIGH_LEFT', 3, 30, 'BASAL'),
      dose('BUTTOCK_LEFT', 4, 200, 'BASAL'),
      dose('ABDOMEN_LEFT', 4, 90),
    ],
  ];
  const lipos: readonly (readonly { site: SiteCode; reportedAt: string }[])[] = [
    [],
    [{ site: 'ABDOMEN_LEFT', reportedAt: daysAgo(10) }],
    [
      { site: 'ARM_RIGHT', reportedAt: daysAgo(30) },
      { site: 'THIGH_LEFT', reportedAt: daysAgo(200) },
    ],
  ];

  it('always gives one SUGGESTED site, or none, and keeps every rule', () => {
    let checked = 0;
    for (const sex of sexes)
      for (const bmi of bmis)
        for (const pregnancy of pregnancies)
          for (const kind of kinds)
            for (const plan of plans)
              for (const history of histories)
                for (const lipohypertrophy of lipos) {
                  const input: InjectionRuleInput = {
                    kind,
                    now: NOW,
                    profile: profile({
                      sex,
                      bmi,
                      pregnancy,
                      lipohypertrophy,
                      birthDate: '1990-01-01',
                    }),
                    plan,
                    history,
                  };
                  const result = suggestInjectionSite(input);
                  checked += 1;
                  const suggested = result.sites.filter((row) => row.state === 'SUGGESTED');
                  expect(result.sites).toHaveLength(SITE_CODES.length);
                  if (result.suggestion === null) {
                    expect(suggested).toHaveLength(0);
                    continue;
                  }
                  const { site, spot } = result.suggestion;
                  expect(suggested.map((row) => row.site)).toEqual([site]);
                  expect(spot).toBeGreaterThanOrEqual(1);
                  expect(spot).toBeLessThanOrEqual(4);
                  if (plan !== null) expect(plan).toContain(site);
                  const activeLipo = lipohypertrophy.filter(
                    (entry) => NOW.getTime() - Date.parse(entry.reportedAt) <= NINETY_DAYS_MS,
                  );
                  if (activeLipo.some((entry) => entry.site === site)) {
                    throw new Error(`suggested a site with lipohypertrophy: ${site}`);
                  }
                  const bolus = kind === 'BOLUS' || kind === 'CORRECTION';
                  if (bolus && isLean(sex, bmi) && plan === null) {
                    expect(site.startsWith('ARM_') || site.startsWith('THIGH_')).toBe(false);
                  }
                  if (pregnancy === 'PREGNANT' && site.startsWith('ABDOMEN_'))
                    expect([3, 4]).toContain(spot);
                  expect(result.suggestion.pinch_up).toBe(isLean(sex, bmi));
                }
    expect(checked).toBe(
      sexes.length *
        bmis.length *
        pregnancies.length *
        kinds.length *
        plans.length *
        histories.length *
        lipos.length,
    );
  });
});

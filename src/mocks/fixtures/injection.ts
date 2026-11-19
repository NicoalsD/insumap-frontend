import {
  SPOTS_PER_SITE,
  type InsulinDoseDto,
  type PatientSex,
  type PregnancyStatus,
  type SiteCode,
} from '@/services/dto/injection';
import type { InjectionPatientProfile } from '../injectionRules';
import { uuid } from './ids';

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;
/** America/Bogota is UTC-5 all year: local clock times are converted by adding five hours. */
const CLINIC_UTC_OFFSET_HOURS = 5;
const HISTORY_DAYS = 14;
const BASAL_UNITS = 18;

/** Injection data of one fixture patient (sex, birth date, BMI, pregnancy), as the overview carries it. */
export interface PatientInjectionSeed {
  readonly sex: PatientSex;
  readonly birth_date: string;
  readonly bmi: number | null;
  readonly pregnancy_status: PregnancyStatus;
}

/**
 * Patients 1 to 24 of the fixture world. Women and men alternate, patients 5 and 22 are pregnant (their
 * target profile is the pregnancy one), patient 8 is
 * a man with a low BMI (lean), and the rest are in range. Patient 3 is the signed-in patient.
 */
export const PATIENT_INJECTION_SEED: Readonly<Record<number, PatientInjectionSeed>> = {
  1: { sex: 'FEMALE', birth_date: '1979-07-02', bmi: 26.1, pregnancy_status: 'NONE' },
  2: { sex: 'MALE', birth_date: '1968-11-14', bmi: 29.8, pregnancy_status: 'NONE' },
  3: { sex: 'FEMALE', birth_date: '1992-03-18', bmi: 23.4, pregnancy_status: 'NONE' },
  4: { sex: 'MALE', birth_date: '1957-05-09', bmi: 27.2, pregnancy_status: 'NONE' },
  5: { sex: 'FEMALE', birth_date: '1996-09-21', bmi: 22, pregnancy_status: 'PREGNANT' },
  6: { sex: 'MALE', birth_date: '1990-01-30', bmi: 24.6, pregnancy_status: 'NONE' },
  7: { sex: 'FEMALE', birth_date: '2001-04-12', bmi: 21.3, pregnancy_status: 'NONE' },
  8: { sex: 'MALE', birth_date: '1984-08-25', bmi: 19.1, pregnancy_status: 'NONE' },
  9: { sex: 'FEMALE', birth_date: '1998-12-03', bmi: 24.9, pregnancy_status: 'NONE' },
  10: { sex: 'MALE', birth_date: '1975-06-17', bmi: 28.4, pregnancy_status: 'NONE' },
  11: { sex: 'FEMALE', birth_date: '1951-02-26', bmi: 27.9, pregnancy_status: 'NONE' },
  12: { sex: 'MALE', birth_date: '1988-10-05', bmi: 25.3, pregnancy_status: 'NONE' },
  13: { sex: 'FEMALE', birth_date: '1983-03-09', bmi: 23, pregnancy_status: 'NONE' },
  14: { sex: 'MALE', birth_date: '1970-12-19', bmi: 31.2, pregnancy_status: 'NONE' },
  15: { sex: 'FEMALE', birth_date: '1962-07-30', bmi: 29.5, pregnancy_status: 'NONE' },
  16: { sex: 'MALE', birth_date: '1979-04-11', bmi: 26.6, pregnancy_status: 'NONE' },
  17: { sex: 'FEMALE', birth_date: '1989-05-16', bmi: 24.1, pregnancy_status: 'NONE' },
  18: { sex: 'MALE', birth_date: '1966-02-07', bmi: 30.4, pregnancy_status: 'NONE' },
  19: { sex: 'FEMALE', birth_date: '1994-11-28', bmi: 22.7, pregnancy_status: 'NONE' },
  20: { sex: 'MALE', birth_date: '1992-08-08', bmi: 25.9, pregnancy_status: 'NONE' },
  21: { sex: 'FEMALE', birth_date: '1955-10-22', bmi: 26.8, pregnancy_status: 'NONE' },
  22: { sex: 'FEMALE', birth_date: '1997-06-14', bmi: 23.5, pregnancy_status: 'PREGNANT' },
  23: { sex: 'FEMALE', birth_date: '1949-01-05', bmi: 28.2, pregnancy_status: 'NONE' },
  24: { sex: 'MALE', birth_date: '1986-09-13', bmi: 24.8, pregnancy_status: 'NONE' },
};

/** Lipohypertrophy reported by the patient's symptoms, in days before the fixture clock. */
const LIPOHYPERTROPHY_SEED: readonly {
  readonly n: number;
  readonly site: SiteCode;
  readonly daysAgo: number;
}[] = [
  // Reported 45 days ago: still inside the 90-day window, so the arm is out for injections.
  { n: 3, site: 'ARM_LEFT', daysAgo: 45 },
];

/** Rules profile of fixture patient `n` at the clock `now`. */
export function injectionProfileOf(n: number, now: Date): InjectionPatientProfile | null {
  const seed = PATIENT_INJECTION_SEED[n];
  if (!seed) return null;
  return {
    sex: seed.sex,
    birthDate: seed.birth_date,
    bmi: seed.bmi,
    pregnancy: seed.pregnancy_status,
    lipohypertrophy: LIPOHYPERTROPHY_SEED.filter((entry) => entry.n === n).map((entry) => ({
      site: entry.site,
      reportedAt: new Date(now.getTime() - entry.daysAgo * DAY_MS).toISOString(),
    })),
  };
}

/**
 * Fourteen days of doses ending at `now`: three meal boluses (07:30, 13:00, 19:00) and one basal
 * (21:30) per day. Boluses alternate abdomen left and right and advance the spot on each side;
 * basal alternates thigh left and right the same way. `phase` shifts the cycle per patient so two
 * histories do not match. Doses after `now` are not written. Oldest first.
 */
export function insulinDoseHistorySeed(now: Date, phase: number): InsulinDoseDto[] {
  const clinic = new Date(now.getTime() - CLINIC_UTC_OFFSET_HOURS * HOUR_MS);
  const year = clinic.getUTCFullYear();
  const month = clinic.getUTCMonth();
  const day = clinic.getUTCDate();
  const meals = [
    { hour: 7, minute: 30, units: 6 },
    { hour: 13, minute: 0, units: 8 },
    { hour: 19, minute: 0, units: 7 },
  ] as const;
  const doses: InsulinDoseDto[] = [];
  let bolusIndex = phase;
  let basalIndex = phase;
  const push = (
    dose: Omit<InsulinDoseDto, 'id' | 'insulin_product_id' | 'treatment_plan_id' | 'simulated'>,
  ) => {
    doses.push({
      id: uuid('i1', phase * 1000 + doses.length + 1),
      insulin_product_id: null,
      treatment_plan_id: null,
      simulated: false,
      ...dose,
    });
  };
  // Days back 13 to 0: fourteen calendar days, today included, with only the doses already given.
  for (let daysBack = HISTORY_DAYS - 1; daysBack >= 0; daysBack -= 1) {
    for (const meal of meals) {
      const at = Date.UTC(
        year,
        month,
        day - daysBack,
        meal.hour + CLINIC_UTC_OFFSET_HOURS,
        meal.minute,
      );
      if (at > now.getTime()) continue;
      const index = bolusIndex;
      bolusIndex += 1;
      push({
        kind: 'BOLUS',
        units: meal.units,
        administered_at: new Date(at).toISOString(),
        injection_site: index % 2 === 0 ? 'ABDOMEN_RIGHT' : 'ABDOMEN_LEFT',
        injection_spot: (Math.floor(index / 2) % SPOTS_PER_SITE) + 1,
      });
    }
    const basalAt = Date.UTC(year, month, day - daysBack, 21 + CLINIC_UTC_OFFSET_HOURS, 30);
    if (basalAt <= now.getTime()) {
      const index = basalIndex;
      basalIndex += 1;
      push({
        kind: 'BASAL',
        units: BASAL_UNITS,
        administered_at: new Date(basalAt).toISOString(),
        injection_site: index % 2 === 0 ? 'THIGH_RIGHT' : 'THIGH_LEFT',
        injection_spot: (Math.floor(index / 2) % SPOTS_PER_SITE) + 1,
      });
    }
  }
  return doses;
}

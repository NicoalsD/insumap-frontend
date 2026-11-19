import type {
  ClinicalNoteDto,
  MessageDto,
  ReminderDto,
  TreatmentPlanDto,
} from '@/services/dto/care';
import { uuid } from './ids';

const HOUR_MS = 60 * 60_000;

/** Permanent notice of the messaging thread (API.md 8.12, RF-85). */
export const EMERGENCY_NOTICE =
  'Este canal no es para emergencias ni para dosis urgentes. Si tienes síntomas graves, llama a urgencias.';

/** A reminder plus the plan's lock: a locked reminder cannot be switched off by the patient. */
export interface ReminderRecord extends ReminderDto {
  readonly locked: boolean;
}

/** Active plan of the signed-in patient. Doses come from the plan, never from the AI. */
export function treatmentPlanSeed(): TreatmentPlanDto {
  return {
    id: uuid('d3', 3),
    name: 'Plan basal-bolo',
    version: 4,
    summary:
      'Insulina basal nocturna y bolos con las comidas principales. Los ajustes los decide tu médico.',
    updated_at: '2026-11-01T14:00:00.000Z',
    schedule: [
      { time_of_day: '06:30', label: 'Medir glucosa en ayunas', dose_units: null, insulin_kind: null, injection_sites: null },
      {
        time_of_day: '07:30',
        label: 'Insulina rápida con el desayuno, según carbohidratos',
        dose_units: null,
        insulin_kind: 'BOLUS',
        injection_sites: null,
      },
      {
        time_of_day: '13:00',
        label: 'Insulina rápida con el almuerzo, según carbohidratos',
        dose_units: null,
        insulin_kind: 'BOLUS',
        injection_sites: null,
      },
      {
        time_of_day: '19:00',
        label: 'Insulina rápida con la cena, según carbohidratos',
        dose_units: null,
        insulin_kind: 'BOLUS',
        injection_sites: null,
      },
      {
        time_of_day: '21:30',
        label: 'Insulina basal',
        dose_units: 18,
        insulin_kind: 'BASAL',
        // The doctor restricts the basal to abdomen and thigh (both sides).
        injection_sites: ['ABDOMEN_RIGHT', 'ABDOMEN_LEFT', 'THIGH_RIGHT', 'THIGH_LEFT'],
      },
    ],
  };
}

export function reminderSeed(): ReminderRecord[] {
  return [
    {
      id: uuid('r1', 1),
      label: 'Medir glucosa en ayunas',
      time_of_day: '06:30',
      enabled: true,
      locked: false,
    },
    {
      id: uuid('r1', 2),
      label: 'Medir glucosa antes de la cena',
      time_of_day: '18:30',
      enabled: true,
      locked: false,
    },
    {
      id: uuid('r1', 3),
      label: 'Insulina basal',
      time_of_day: '21:30',
      enabled: true,
      locked: true,
    },
    {
      id: uuid('r1', 4),
      label: 'Medir glucosa de madrugada',
      time_of_day: '03:00',
      enabled: false,
      locked: false,
    },
  ];
}

/** Notes keyed by the fixture patient number they belong to. Author is the primary doctor. */
export function clinicalNoteSeed(
  now: Date,
  authorName: string,
): { patientN: number; note: ClinicalNoteDto }[] {
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR_MS).toISOString();
  return [
    {
      patientN: 1,
      note: {
        id: uuid('n1', 1),
        body: 'Dos hipoglucemias nocturnas esta semana. Se revisa la hora de la basal con la paciente antes de cambiar la dosis.',
        author_name: authorName,
        created_at: at(30),
      },
    },
    {
      patientN: 1,
      note: {
        id: uuid('n1', 2),
        body: 'La decisión sobre la basal la toma el médico tras revisar la AGP y el registro de cenas.',
        author_name: authorName,
        created_at: at(6),
      },
    },
    {
      patientN: 2,
      note: {
        id: uuid('n1', 3),
        body: 'Picos después de las comidas. Se refuerza el registro de carbohidratos en la app.',
        author_name: authorName,
        created_at: at(20),
      },
    },
  ];
}

/** Thread between the signed-in patient and her doctor, oldest first. */
export function messageSeed(now: Date): MessageDto[] {
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR_MS).toISOString();
  return [
    {
      id: uuid('m1', 1),
      sender_role: 'PATIENT',
      body: 'Doctor, anoche desperté con 62 mg/dL. ¿Debo cambiar algo de la basal?',
      sent_at: at(26),
      read_at: at(25.5),
    },
    {
      id: uuid('m1', 2),
      sender_role: 'DOCTOR',
      body: 'Gracias por avisar. Revisa la medición de las 3 a. m. y envíame la siguiente lectura de ayunas.',
      sent_at: at(25),
      read_at: at(24),
    },
    {
      id: uuid('m1', 3),
      sender_role: 'PATIENT',
      body: 'Listo, ya registré la medición de ayunas de hoy.',
      sent_at: at(3),
      read_at: null,
    },
  ];
}

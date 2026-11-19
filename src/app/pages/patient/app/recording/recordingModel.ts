import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { classifyGlucose, type GlucoseThresholds, type RangeState } from '@/core/glucose/thresholds';
import { readingCreateSchema, READING_CONTEXTS, type ReadingCreateDto } from '@/services/dto/clinical';
import type { FieldLimitsDto } from '@/services/dto/meta';

/** Keys of `GET /meta/field-limits` the recorder reads. A missing key adds no rule; the server decides. */
export const RECORDING_LIMIT_KEYS = {
  minValue: 'reading_min_mg_dl',
  maxValue: 'reading_max_mg_dl',
  maxAgeDays: 'reading_max_age_days',
} as const;

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;
const PAD_WIDTH = 2;

/** Contexts the patient can pick, in the order of the screen. Subset of `READING_CONTEXTS`. */
export const PATIENT_CONTEXTS = ['FASTING', 'BEFORE_MEAL', 'AFTER_MEAL', 'OTHER'] as const;
export type PatientContext = (typeof PATIENT_CONTEXTS)[number];

export type WhenMode = 'now' | 'pick';

export type ValueCheck =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly error: string };

/** Whole mg/dL typed on the keypad, checked against the limits the API published. */
export function checkValueText(text: string, limits: FieldLimitsDto): ValueCheck {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, error: es.patient.record.value.required };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: es.patient.record.value.integer };
  const value = Number(trimmed);
  const min = limits[RECORDING_LIMIT_KEYS.minValue];
  const max = limits[RECORDING_LIMIT_KEYS.maxValue];
  if (min !== undefined && value < min) return rangeError(min, max);
  if (max !== undefined && value > max) return rangeError(min, max);
  return { ok: true, value };
}

function rangeError(min: number | undefined, max: number | undefined): ValueCheck {
  return {
    ok: false,
    error: format(es.patient.record.value.range, { min: min ?? 0, max: max ?? 0 }),
  };
}

export type WhenCheck = { readonly ok: true; readonly measuredAt: string } | { readonly ok: false; readonly error: string };

/** The measurement instant: now, or the picked local date and time, never in the future or too old. */
export function checkWhen(
  mode: WhenMode,
  pickedLocal: string,
  now: Date,
  limits: FieldLimitsDto,
): WhenCheck {
  if (mode === 'now') return { ok: true, measuredAt: now.toISOString() };
  if (pickedLocal === '') return { ok: false, error: es.patient.record.when.required };
  const picked = new Date(pickedLocal);
  if (Number.isNaN(picked.getTime())) return { ok: false, error: es.patient.record.when.invalid };
  if (picked.getTime() > now.getTime()) return { ok: false, error: es.patient.record.when.future };
  const maxAgeDays = limits[RECORDING_LIMIT_KEYS.maxAgeDays];
  if (maxAgeDays !== undefined && now.getTime() - picked.getTime() > maxAgeDays * MS_PER_DAY) {
    return { ok: false, error: es.patient.record.when.tooOld };
  }
  return { ok: true, measuredAt: picked.toISOString() };
}

/** Builds the `POST /readings` body with `readingCreateSchema` so the form and the API agree. */
export function buildReadingBody(input: {
  readonly clientReadingId: string;
  readonly valueMgDl: number;
  readonly measuredAt: string;
  readonly context: PatientContext;
  readonly limits: FieldLimitsDto;
}): ReadingCreateDto | null {
  const parsed = readingCreateSchema(input.limits).safeParse({
    client_reading_id: input.clientReadingId,
    value_mg_dl: input.valueMgDl,
    measured_at: input.measuredAt,
    source: 'MANUAL',
    context: input.context,
  });
  return parsed.success ? parsed.data : null;
}

/** Range of a value against the patient's target profile. */
export function stateOf(valueMgDl: number, thresholds: GlucoseThresholds): RangeState {
  return classifyGlucose(valueMgDl, thresholds);
}

/** Whether the result needs the "talk to your doctor" notice. Only the very low and very high states. */
export function needsUrgentNotice(state: RangeState): boolean {
  return state === 'VERY_LOW' || state === 'VERY_HIGH';
}

/** Local value for an `<input type="datetime-local">` from a Date, in the device time zone. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(PAD_WIDTH, '0');
  const minutes = Math.floor(date.getTime() / MS_PER_MINUTE);
  const local = new Date(minutes * MS_PER_MINUTE - date.getTimezoneOffset() * MS_PER_MINUTE);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

export const CONTEXT_OPTIONS = READING_CONTEXTS;

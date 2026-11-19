import type { ImportBatchViewModel, ImportRowViewModel } from '@/services/adapters/ImportViewModelAdapters';
import { LOCALE } from '@/i18n/format';

const NOT_A_PATIENT = 'NOT_A_PATIENT_RESOURCE';

/** Batch statuses that mean the patients already exist (the API leaves the values open; both spellings seen). */
const IMPORTED_STATUSES: readonly string[] = ['COMPLETED', 'CONFIRMED'];

export function isImportedBatch(batch: ImportBatchViewModel): boolean {
  return IMPORTED_STATUSES.includes(batch.status);
}

/** Warning rows that are patients (a FHIR warning can also be a resource that is not a patient, e.g. Observation). */
export function warningPatientCount(warningRows: readonly ImportRowViewModel[]): number {
  return warningRows.filter((row) => !row.issueCodes.includes(NOT_A_PATIENT)).length;
}

/** Patients a confirmation creates: every valid row plus every warning row that is a patient. */
export function patientsToCreate(batch: ImportBatchViewModel, warningPatients: number): number {
  return batch.totals.valid + warningPatients;
}

/**
 * Why the main action is enabled or not. Any row with an error blocks the whole batch: the admin
 * fixes the file and analyzes it again, so the clinic never imports a half-fixed list.
 */
export type ConfirmGate = 'READY' | 'BLOCKED_BY_ERRORS' | 'NOTHING_TO_IMPORT' | 'ALREADY_IMPORTED';

export function confirmGate(batch: ImportBatchViewModel, createCount: number): ConfirmGate {
  if (isImportedBatch(batch)) return 'ALREADY_IMPORTED';
  if (batch.totals.error > 0) return 'BLOCKED_BY_ERRORS';
  if (createCount === 0) return 'NOTHING_TO_IMPORT';
  return 'READY';
}

export interface ErrorReportLabels {
  readonly columns: readonly string[];
  readonly rowStatus: (status: ImportRowViewModel['status']) => string;
  /** Spanish reason for one issue code, with the fallback for codes the UI does not know. */
  readonly issue: (code: string) => string;
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** RFC 4180 cell: quoted when needed, and a leading apostrophe on anything a spreadsheet would run as a formula. */
export function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * One line per row and issue code, so a row with two problems appears twice. It carries the row
 * number and the reason only: never the row content, which the API does not return either.
 */
export function buildErrorReportCsv(
  rows: readonly ImportRowViewModel[],
  labels: ErrorReportLabels,
): string {
  const lines: string[] = [labels.columns.map(csvCell).join(',')];
  for (const row of rows) {
    const status = labels.rowStatus(row.status);
    if (row.issueCodes.length === 0) {
      lines.push([String(row.rowNumber), status, '', ''].map(csvCell).join(','));
      continue;
    }
    for (const code of row.issueCodes) {
      lines.push([String(row.rowNumber), status, code, labels.issue(code)].map(csvCell).join(','));
    }
  }
  return `${lines.join('\r\n')}\r\n`;
}

/** Date and time of a batch in the clinic's time zone; falls back to the browser's zone if the API sends an unknown one. */
export function formatBatchDate(iso: string | undefined, timeZone: string | undefined): string | null {
  if (iso === undefined) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
  try {
    return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(LOCALE, options).format(date);
  }
}

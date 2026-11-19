/**
 * Client-side checks of the file a clinic admin picks. They give fast feedback; the API stays the
 * authority (AGENTS.md 3.3). Size limits come from `GET /meta/field-limits`, never from this file.
 */

export type ImportSource = 'FHIR' | 'CSV';

/** Field-limit keys the API publishes for each import body (backend `FieldLimits`, snake_case). */
export const IMPORT_LIMIT_KEYS: Readonly<Record<ImportSource, string>> = {
  FHIR: 'fhir_bundle_max_bytes',
  CSV: 'patient_csv_max_bytes',
};

/** Columns of the patient CSV (API.md 8.4): `mrn` and `birth_date` are required, `email` is optional. */
export const CSV_REQUIRED_COLUMNS: readonly string[] = ['mrn', 'birth_date'];
export const CSV_TEMPLATE_HEADER = 'mrn,birth_date,email';
export const CSV_TEMPLATE_FILE_NAME = 'plantilla-pacientes.csv';

const CSV_MIME_TYPES: readonly string[] = ['text/csv', 'application/vnd.ms-excel'];
const FHIR_MIME_TYPES: readonly string[] = ['application/fhir+json', 'application/json'];

const EXTENSION: Readonly<Record<ImportSource, string>> = { CSV: '.csv', FHIR: '.json' };
const MIME_TYPES: Readonly<Record<ImportSource, readonly string[]>> = {
  CSV: CSV_MIME_TYPES,
  FHIR: FHIR_MIME_TYPES,
};

/** Value of the `accept` attribute of the file input. */
export function acceptFor(source: ImportSource): string {
  return [EXTENSION[source], ...MIME_TYPES[source]].join(',');
}

export type FileIssue = 'EMPTY' | 'WRONG_TYPE' | 'TOO_LARGE';

export interface ImportFileInfo {
  readonly name: string;
  readonly size: number;
  /** Empty when the browser does not know the type, as it often happens with CSV. */
  readonly type: string;
}

/** Returns the first problem with the file, or `null` when it can be sent. `limits` is the API's field-limit map. */
export function validateImportFile(
  file: ImportFileInfo,
  source: ImportSource,
  limits: Readonly<Record<string, number>>,
): FileIssue | null {
  if (file.size === 0) return 'EMPTY';
  const typeOk = file.type === '' || MIME_TYPES[source].includes(file.type);
  if (!file.name.toLowerCase().endsWith(EXTENSION[source]) || !typeOk) return 'WRONG_TYPE';
  const max = limits[IMPORT_LIMIT_KEYS[source]];
  if (max !== undefined && file.size > max) return 'TOO_LARGE';
  return null;
}

/** Only the template text. Its header is the column contract above. */
export function buildCsvTemplate(): string {
  return `${CSV_TEMPLATE_HEADER}\n`;
}

const BYTES_PER_KIB = 1024;
const BYTES_PER_MIB = BYTES_PER_KIB * BYTES_PER_KIB;
const ONE_DECIMAL = 10;

export type SizeUnit = 'megabytes' | 'kilobytes' | 'bytes';

/** Size in the unit a clinic admin reads: the unit key of the `file` texts and its value. */
export function sizeParts(bytes: number): { readonly unit: SizeUnit; readonly value: number } {
  if (bytes >= BYTES_PER_MIB) {
    return { unit: 'megabytes', value: Math.round((bytes / BYTES_PER_MIB) * ONE_DECIMAL) / ONE_DECIMAL };
  }
  if (bytes >= BYTES_PER_KIB) return { unit: 'kilobytes', value: Math.round(bytes / BYTES_PER_KIB) };
  return { unit: 'bytes', value: bytes };
}

/** Saves text as a file through a temporary object URL. Only used for reports and the template. */
export function downloadTextFile(fileName: string, content: string, mimeType = 'text/csv;charset=utf-8'): void {
  const bom = '﻿';
  const blob = new Blob([bom, content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

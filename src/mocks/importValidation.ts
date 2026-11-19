import type { ImportRowDto } from '@/services/dto/admin';

const MRN_COLUMN = 'mrn';
const BIRTH_COLUMN = 'birth_date';
const EMAIL_COLUMN = 'email';
const BOM = new RegExp(`^${String.fromCharCode(0xfeff)}`);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ImportCandidate {
  readonly mrn: string;
  readonly birthDate: string;
  readonly email: string;
}

export type ParsedImport =
  | { readonly ok: true; readonly rows: readonly ImportRowDto[]; readonly candidates: readonly ImportCandidate[] }
  | { readonly ok: false; readonly missingColumns: readonly string[] };

function validateRow(
  rowNumber: number,
  candidate: Partial<ImportCandidate>,
  seen: Set<string>,
  existingMrns: ReadonlySet<string>,
  now: Date,
): ImportRowDto {
  const issues: string[] = [];
  const mrn = candidate.mrn ?? '';
  if (mrn === '') issues.push('MISSING_MRN');
  const birth = candidate.birthDate ?? '';
  const birthTime = Date.parse(birth);
  if (!DATE_PATTERN.test(birth) || Number.isNaN(birthTime)) issues.push('INVALID_BIRTH_DATE');
  else if (birthTime > now.getTime()) issues.push('BIRTH_DATE_IN_FUTURE');
  if (mrn !== '' && seen.has(mrn)) issues.push('DUPLICATE_MRN_IN_FILE');
  if (mrn !== '') seen.add(mrn);
  if (issues.length > 0) return { row_number: rowNumber, status: 'ERROR', issue_codes: issues, patient_id: null };
  if (existingMrns.has(mrn)) {
    return { row_number: rowNumber, status: 'SKIPPED_DUPLICATE', issue_codes: ['DUPLICATE_MRN'], patient_id: null };
  }
  const warnings = (candidate.email ?? '') === '' ? ['MISSING_EMAIL'] : [];
  return {
    row_number: rowNumber,
    status: warnings.length > 0 ? 'WARNING' : 'VALID',
    issue_codes: warnings,
    patient_id: null,
  };
}

/** Per-row validation of a CSV patient file (API.md 8.4): `mrn` and `birth_date` are required columns. */
export function parseCsvImport(text: string, existingMrns: ReadonlySet<string>, now: Date): ParsedImport {
  const lines = text.replace(BOM, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  const [headerLine = '', ...dataLines] = lines;
  const separator = headerLine.includes(';') ? ';' : ',';
  const header = headerLine.split(separator).map((cell) => cell.trim().toLowerCase());
  const missingColumns = [MRN_COLUMN, BIRTH_COLUMN].filter((column) => !header.includes(column));
  if (missingColumns.length > 0) return { ok: false, missingColumns };
  const seen = new Set<string>();
  const candidates: ImportCandidate[] = [];
  const rows = dataLines.map((line, index) => {
    const cells = line.split(separator).map((cell) => cell.trim());
    const at = (name: string) => cells[header.indexOf(name)] ?? '';
    const candidate = { mrn: at(MRN_COLUMN), birthDate: at(BIRTH_COLUMN), email: at(EMAIL_COLUMN) };
    const row = validateRow(index + 1, candidate, seen, existingMrns, now);
    if (row.status === 'VALID' || row.status === 'WARNING') candidates.push(candidate);
    return row;
  });
  return { ok: true, rows, candidates };
}

interface FhirEntry {
  readonly resource?: {
    readonly resourceType?: string;
    readonly identifier?: readonly { readonly value?: string }[];
    readonly birthDate?: string;
    readonly telecom?: readonly { readonly system?: string; readonly value?: string }[];
  };
}

/** Per-entry validation of a FHIR R4 Bundle: only `Patient` becomes a row candidate; other types are row issues. */
export function parseFhirImport(text: string, existingMrns: ReadonlySet<string>, now: Date): ParsedImport {
  let bundle: { resourceType?: string; entry?: readonly FhirEntry[] };
  try {
    bundle = JSON.parse(text) as typeof bundle;
  } catch {
    return { ok: false, missingColumns: ['Bundle'] };
  }
  if (bundle.resourceType !== 'Bundle' || !bundle.entry) {
    return { ok: false, missingColumns: ['Bundle.entry'] };
  }
  const seen = new Set<string>();
  const candidates: ImportCandidate[] = [];
  const supported = new Set(['Patient', 'Practitioner', 'Condition', 'Observation', 'MedicationRequest']);
  const rows = bundle.entry.map((entry, index): ImportRowDto => {
    const resource = entry.resource;
    const rowNumber = index + 1;
    if (resource?.resourceType !== 'Patient') {
      const known = resource?.resourceType !== undefined && supported.has(resource.resourceType);
      return {
        row_number: rowNumber,
        status: known ? 'WARNING' : 'ERROR',
        issue_codes: [known ? 'NOT_A_PATIENT_RESOURCE' : 'UNSUPPORTED_RESOURCE_TYPE'],
        patient_id: null,
      };
    }
    const candidate = {
      mrn: resource.identifier?.[0]?.value ?? '',
      birthDate: resource.birthDate ?? '',
      email: resource.telecom?.find((t: { readonly system?: string }) => t.system === 'email')?.value ?? '',
    };
    const row = validateRow(rowNumber, candidate, seen, existingMrns, now);
    if (row.status === 'VALID' || row.status === 'WARNING') candidates.push(candidate);
    return row;
  });
  return { ok: true, rows, candidates };
}

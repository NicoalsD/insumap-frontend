import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { ApiError, apiErrorMessage } from '@/services/api/ApiError';
import type { BadgeTone } from '@/ui/Badge';
import { sizeParts, type FileIssue, type ImportSource } from './importFile';

const t = es.adminImports;

const COLUMN_FIELD_PREFIX = 'column.';

/** Reads a value from a closed map, with a fallback for codes this UI does not know yet. */
function lookup(map: Readonly<Record<string, string>>, key: string, fallback: string): string {
  return Object.hasOwn(map, key) ? (map[key] ?? fallback) : fallback;
}

const ISSUE_TEXT: Readonly<Record<string, string>> = t.issues;
const BATCH_STATUS_TEXT: Readonly<Record<string, string>> = t.batchStatus;
const BATCH_STATUS_TONE: Readonly<Record<string, BadgeTone>> = {
  PREVIEWED: 'info',
  PREVIEW: 'info',
  COMPLETED: 'success',
  CONFIRMED: 'success',
  REJECTED: 'critical',
  FAILED: 'critical',
};

/** Spanish sentence for one row issue code (API.md 8.4). */
export function issueMessage(code: string): string {
  return lookup(ISSUE_TEXT, code, t.issueUnknown);
}

export function batchStatusLabel(status: string): string {
  return lookup(BATCH_STATUS_TEXT, status, t.batchStatus.unknown);
}

export function batchStatusTone(status: string): BadgeTone {
  return Object.hasOwn(BATCH_STATUS_TONE, status) ? (BATCH_STATUS_TONE[status] ?? 'neutral') : 'neutral';
}

/** A byte count in the unit the admin reads, e.g. "2 MB". */
export function sizeText(bytes: number): string {
  const { unit, value } = sizeParts(bytes);
  return format(t.file[unit], { value });
}

/** Message for a file rejected before upload. `maxBytes` is the API's limit when it published one. */
export function fileIssueMessage(
  issue: FileIssue,
  source: ImportSource,
  file: { readonly size: number },
  maxBytes: number | undefined,
): string {
  switch (issue) {
    case 'EMPTY':
      return t.file.empty;
    case 'WRONG_TYPE':
      return format(t.file.wrongType, {
        accepted: source === 'CSV' ? t.file.formatCsv : t.file.formatFhir,
      });
    case 'TOO_LARGE':
      return format(t.file.tooLarge, {
        size: sizeText(file.size),
        max: maxBytes === undefined ? '' : sizeText(maxBytes),
      });
  }
}

/** Names of the required columns that the API reported as missing (`column.<name>` fields). */
export function missingColumnNames(error: ApiError): readonly string[] {
  return Object.keys(error.fieldErrors)
    .filter((field) => field.startsWith(COLUMN_FIELD_PREFIX))
    .map((field) => field.slice(COLUMN_FIELD_PREFIX.length));
}

/** Maps an analysis failure to the message the admin needs: what to change in the file. */
export function analysisErrorMessage(error: unknown, source: ImportSource): string {
  if (error instanceof ApiError) {
    if (error.code === 'UNSUPPORTED_MEDIA_TYPE') return t.file.unsupportedType;
    if (error.code === 'PAYLOAD_TOO_LARGE') return t.file.tooLargeServer;
    if (error.code === 'VALIDATION_ERROR') {
      const columns = missingColumnNames(error);
      if (source === 'CSV' && columns.length > 0) {
        return format(t.file.missingColumns, { columns: columns.join(', ') });
      }
      return source === 'CSV' ? t.file.badFormatCsv : t.file.badFormat;
    }
  }
  return apiErrorMessage(error);
}

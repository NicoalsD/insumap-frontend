import type { TriageRowViewModel } from '@/services/adapters/TriageViewModelAdapter';

/** A triage row plus the clinic time zone the API reports (the adapter does not keep it). */
export interface TriageItem extends TriageRowViewModel {
  readonly timezone: string;
}

/** Queue segments. Each one is a count and a filter at once; several active segments narrow together. */
export const SEGMENT_IDS = ['critical', 'openAlerts', 'aiPending', 'unreviewed', 'insufficient'] as const;
export type SegmentId = (typeof SEGMENT_IDS)[number];

const SEGMENT_PREDICATES: Readonly<Record<SegmentId, (row: TriageItem) => boolean>> = {
  critical: (row) => row.riskTier === 'CRITICAL',
  openAlerts: (row) => row.openAlertsCount > 0,
  aiPending: (row) => row.pendingRecommendationsCount > 0,
  unreviewed: (row) => row.reviewedAt === null,
  insufficient: (row) => row.tirPct === null,
};

export function matchesSegment(row: TriageItem, segment: SegmentId): boolean {
  return SEGMENT_PREDICATES[segment](row);
}

/** Counts over the whole window list, so a segment's number does not move when another filter is on. */
export function countSegments(rows: readonly TriageItem[]): Readonly<Record<SegmentId, number>> {
  const counts = {} as Record<SegmentId, number>;
  for (const segment of SEGMENT_IDS) {
    counts[segment] = rows.reduce((total, row) => total + (matchesSegment(row, segment) ? 1 : 0), 0);
  }
  return counts;
}

/** Lowercase, without accents, trimmed: "Andrés" matches "andres". */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-CO').trim();
}

export function matchesSearch(row: TriageItem, search: string): boolean {
  const needle = normalizeText(search);
  return needle === '' || normalizeText(row.fullName).includes(needle);
}

/** Rows that pass the name search and every active segment (segments narrow together). */
export function filterRows(
  rows: readonly TriageItem[],
  search: string,
  segments: readonly SegmentId[],
): readonly TriageItem[] {
  return rows.filter(
    (row) => matchesSearch(row, search) && segments.every((segment) => matchesSegment(row, segment)),
  );
}

/** Badge tone of a risk tier; the badge text always names the tier, so color is never the only cue. */
export function riskBadgeTone(tier: TriageItem['riskTier']): 'critical' | 'warning' | 'info' | 'success' {
  switch (tier) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'warning';
    case 'MEDIUM':
      return 'info';
    case 'LOW':
      return 'success';
  }
}

export const RISK_RANK: Readonly<Record<TriageItem['riskTier'], number>> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

/** Priority codes the API sends in alerts. Unknown codes sort last. */
export const PRIORITY_RANK: Readonly<Record<string, number>> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const UNKNOWN_PRIORITY_RANK = Number.MAX_SAFE_INTEGER;

export function priorityRank(priority: string): number {
  return PRIORITY_RANK[priority] ?? UNKNOWN_PRIORITY_RANK;
}

export const TRIAGE_SORT_COLUMNS = ['patient', 'risk', 'tir', 'last', 'alerts', 'ai', 'review'] as const;
export type TriageSortColumn = (typeof TRIAGE_SORT_COLUMNS)[number];
export type SortDirection = 'ascending' | 'descending';

/** Default: highest risk first; ties by risk score, then by name. */
export const DEFAULT_TRIAGE_SORT: { readonly column: TriageSortColumn; readonly direction: SortDirection } = {
  column: 'risk',
  direction: 'descending',
};

/** Numeric key of a column; `null` sorts last in either direction (missing data never leads). */
function sortKey(row: TriageItem, column: TriageSortColumn): number | string | null {
  switch (column) {
    case 'patient':
      return normalizeText(row.fullName);
    case 'risk':
      return RISK_RANK[row.riskTier] * SCORE_WEIGHT + row.riskScore;
    case 'tir':
      return row.tirPct;
    case 'last':
      return row.lastReading?.measuredAt.getTime() ?? null;
    case 'alerts':
      return row.openAlertsCount;
    case 'ai':
      return row.pendingRecommendationsCount;
    case 'review':
      return row.reviewedAt?.getTime() ?? null;
  }
}

/** Keeps risk tiers ordered even when a score is large. */
const SCORE_WEIGHT = 1_000_000;

function compareKeys(a: number | string | null, b: number | string | null, factor: number): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'string' && typeof b === 'string') return factor * a.localeCompare(b, 'es-CO', { numeric: true });
  return factor * (Number(a) - Number(b));
}

export function sortRows(
  rows: readonly TriageItem[],
  column: TriageSortColumn,
  direction: SortDirection,
): readonly TriageItem[] {
  const factor = direction === 'ascending' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const primary = compareKeys(sortKey(a, column), sortKey(b, column), factor);
    if (primary !== 0) return primary;
    return a.fullName.localeCompare(b.fullName, 'es-CO');
  });
}

/** Alerts for the rail: priority first, then the longest open first. */
export function compareAlertsForRail(
  a: { readonly priority: string; readonly openedAt: Date },
  b: { readonly priority: string; readonly openedAt: Date },
): number {
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority !== 0) return byPriority;
  return a.openedAt.getTime() - b.openedAt.getTime();
}

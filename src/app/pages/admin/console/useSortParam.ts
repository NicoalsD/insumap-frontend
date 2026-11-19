import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import type { SortDirection } from '@/ui/DataTable';

export interface SortState {
  readonly columnId: string;
  readonly direction: SortDirection;
}

const SORT_KEY = 'sort';
const DIRECTION_KEY = 'dir';

/**
 * Sort of a list kept in the URL (`?sort=<column>&dir=asc|desc`), so a sorted view survives a
 * reload and can be shared inside the console. Unknown column names fall back to the default.
 */
export function useSortParam(
  allowedColumns: readonly string[],
  fallback: SortState,
): readonly [SortState, (next: SortState) => void] {
  const [params, setParams] = useSearchParams();
  const requested = params.get(SORT_KEY);
  const columnId = requested !== null && allowedColumns.includes(requested) ? requested : fallback.columnId;
  const direction: SortDirection =
    params.get(DIRECTION_KEY) === 'desc' ? 'descending' : params.get(DIRECTION_KEY) === 'asc' ? 'ascending' : fallback.direction;

  const setSort = useCallback(
    (next: SortState) => {
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          copy.set(SORT_KEY, next.columnId);
          copy.set(DIRECTION_KEY, next.direction === 'ascending' ? 'asc' : 'desc');
          return copy;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [{ columnId, direction }, setSort] as const;
}

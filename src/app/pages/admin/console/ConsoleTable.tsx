import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import '@/ui/DataTable.css';
import './console.css';
import type { SortState } from './useSortParam';

export interface ConsoleColumn<Row> {
  readonly id: string;
  readonly header: string;
  readonly cell: (row: Row) => ReactNode;
  /** Makes the header a sort button. Strings compare as Spanish text, numbers and `null` last. */
  readonly sortValue?: (row: Row) => string | number | null;
  readonly align?: 'start' | 'end';
  /** Monospace tabular figures, for counts, MRNs and times. */
  readonly measure?: boolean;
}

export interface RowSelection<Row> {
  readonly selectedIds: ReadonlySet<string>;
  /** Called with the ids of the visible rows when the header box is used, or with one id from a row box. */
  readonly onChange: (ids: readonly string[], selected: boolean) => void;
  /** Accessible name of each row checkbox, e.g. "Seleccionar a Camila Restrepo". */
  readonly rowLabel: (row: Row) => string;
}

export interface ConsoleTableProps<Row> {
  readonly caption: string;
  readonly columns: readonly ConsoleColumn<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
  readonly sort: SortState;
  readonly onSortChange: (next: SortState) => void;
  readonly selection?: RowSelection<Row>;
}

const collator = new Intl.Collator('es-CO', { numeric: true, sensitivity: 'base' });

function compareValues(a: string | number | null, b: string | number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'string' && typeof b === 'string') return collator.compare(a, b);
  return Number(a) - Number(b);
}

/**
 * Table with sortable headers and row checkboxes. The sort is controlled (it lives in the URL) and
 * the header checkbox selects every visible row, with the indeterminate state when only some are.
 * Built here because the shared DataTable cannot take controlled sort or checkbox columns.
 */
export function ConsoleTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  selection,
}: ConsoleTableProps<Row>) {
  const captionId = useId();
  const allRef = useRef<HTMLInputElement>(null);
  const [announcement, setAnnouncement] = useState('');

  const sorted = useMemo(() => {
    const column = columns.find((candidate) => candidate.id === sort.columnId);
    if (!column?.sortValue) return rows;
    const { sortValue } = column;
    const factor = sort.direction === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareValues(sortValue(a), sortValue(b)));
  }, [columns, rows, sort]);

  const visibleIds = useMemo(() => sorted.map(rowKey), [sorted, rowKey]);
  const selectedVisible = selection ? visibleIds.filter((id) => selection.selectedIds.has(id)).length : 0;
  const allSelected = visibleIds.length > 0 && selectedVisible === visibleIds.length;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = selectedVisible > 0 && !allSelected;
  }, [selectedVisible, allSelected]);

  const sortBy = (column: ConsoleColumn<Row>) => {
    const direction =
      sort.columnId === column.id && sort.direction === 'ascending' ? 'descending' : 'ascending';
    onSortChange({ columnId: column.id, direction });
    setAnnouncement(
      format(es.table.sortedBy, {
        column: column.header,
        direction: direction === 'ascending' ? es.table.ascending : es.table.descending,
      }),
    );
  };

  return (
    <div className="ui-table-scroll console-table-scroll" role="region" aria-labelledby={captionId} tabIndex={0}>
      <table className="ui-table">
        <caption id={captionId}>{caption}</caption>
        <thead>
          <tr>
            {selection ? (
              <th scope="col" className="console-check-cell">
                <label className="console-check">
                  <input
                    ref={allRef}
                    type="checkbox"
                    aria-label={es.admin.common.selectAllVisible}
                    checked={allSelected}
                    disabled={visibleIds.length === 0}
                    onChange={(event) => { selection.onChange(visibleIds, event.target.checked); }}
                  />
                </label>
              </th>
            ) : null}
            {columns.map((column) => {
              const active = sort.columnId === column.id ? sort.direction : undefined;
              const Icon = active === 'ascending' ? ArrowUp : active === 'descending' ? ArrowDown : ArrowUpDown;
              return (
                <th key={column.id} scope="col" aria-sort={active} data-align={column.align}>
                  {column.sortValue ? (
                    <button type="button" className="ui-table__sort" onClick={() => { sortBy(column); }}>
                      {column.header}
                      <Icon className="ui-table__sort-icon" size="1em" aria-hidden="true" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const id = rowKey(row);
            const checked = selection?.selectedIds.has(id) ?? false;
            return (
              <tr key={id} data-selected={checked || undefined}>
                {selection ? (
                  <td className="console-check-cell">
                    <label className="console-check">
                      <input
                        type="checkbox"
                        aria-label={selection.rowLabel(row)}
                        checked={checked}
                        onChange={(event) => { selection.onChange([id], event.target.checked); }}
                      />
                    </label>
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td key={column.id} data-align={column.align} data-measure={column.measure ? '' : undefined}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </div>
  );
}

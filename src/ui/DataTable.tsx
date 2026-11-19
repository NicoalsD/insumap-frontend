import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import './DataTable.css';

export type SortValue = string | number | Date | null;
export type SortDirection = 'ascending' | 'descending';

export interface DataTableColumn<Row> {
  readonly id: string;
  readonly header: string;
  readonly cell: (row: Row) => ReactNode;
  /** Makes the header a sort button. The value is compared as a number, a date or localized text. */
  readonly sortValue?: (row: Row) => SortValue;
  readonly align?: 'start' | 'end';
  /** Monospace tabular figures, for glucose values, percentages and times. */
  readonly measure?: boolean;
}

export interface DataTableProps<Row> {
  /** Accessible name of the table; also shown as its caption. */
  readonly caption: string;
  readonly columns: readonly DataTableColumn<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
  readonly defaultSort?: { readonly columnId: string; readonly direction: SortDirection };
}

const collator = new Intl.Collator('es-CO', { numeric: true, sensitivity: 'base' });

function compare(a: SortValue, b: SortValue): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'string' && typeof b === 'string') return collator.compare(a, b);
  return Number(a) - Number(b);
}

/**
 * Table with sortable headers: a real `<table>` with `<caption>`, `scope="col"`, a button inside
 * each sortable `<th>` and `aria-sort` on the sorted one only. Sorting keeps rows keyed so focus
 * stays on the header button, and announces the result in a polite status.
 */
export function DataTable<Row>({ caption, columns, rows, rowKey, defaultSort }: DataTableProps<Row>) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const [announcement, setAnnouncement] = useState('');
  const captionId = useId();

  const sorted = useMemo(() => {
    const column = columns.find((candidate) => candidate.id === sort?.columnId);
    if (!sort || !column?.sortValue) return rows;
    const { sortValue } = column;
    const factor = sort.direction === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => factor * compare(sortValue(a), sortValue(b)));
  }, [columns, rows, sort]);

  const sortBy = (column: DataTableColumn<Row>) => {
    const direction: SortDirection =
      sort?.columnId === column.id && sort.direction === 'ascending' ? 'descending' : 'ascending';
    setSort({ columnId: column.id, direction });
    setAnnouncement(
      format(es.table.sortedBy, {
        column: column.header,
        direction: direction === 'ascending' ? es.table.ascending : es.table.descending,
      }),
    );
  };

  return (
    <div
      className="ui-table-scroll"
      role="region"
      aria-labelledby={captionId}
      tabIndex={0}
    >
      <table className="ui-table">
        <caption id={captionId}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.columnId === column.id ? sort.direction : undefined;
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
          {sorted.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  key={column.id}
                  data-align={column.align}
                  data-measure={column.measure ? '' : undefined}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </div>
  );
}

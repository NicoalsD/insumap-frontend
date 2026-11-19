import { Search } from 'lucide-react';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { normalizeText } from '@/app/pages/doctor/triage/triageModel';
import { useTriageRows } from '@/app/pages/doctor/triage/queries';
import { es } from '@/i18n/es';

const MAX_RESULTS = 6;
const SEARCH_WINDOW = '14d';

/**
 * Search over the doctor's assigned patients (the triage list, already cached): typing filters by
 * name without accents, arrows move through the results, Enter opens the record. A combobox with a
 * listbox, so a screen reader hears the active option.
 */
export function PatientSearch() {
  const id = useId();
  const navigate = useNavigate();
  const rows = useTriageRows(SEARCH_WINDOW);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const needle = normalizeText(query);
    if (needle === '') return [];
    return (rows.data ?? []).filter((row) => normalizeText(row.fullName).includes(needle)).slice(0, MAX_RESULTS);
  }, [query, rows.data]);

  const go = (patientId: string) => {
    setQuery('');
    setOpen(false);
    void navigate(`/doctor/patients/${patientId}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      const chosen = results[active];
      if (chosen) go(chosen.patientId);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const listId = `${id}-list`;
  const showList = open && query.trim() !== '';
  return (
    <div className="patient-search">
      <label htmlFor={`${id}-input`} className="visually-hidden">
        {es.doctor.shell.search}
      </label>
      <Search className="patient-search__icon" size="1.125rem" aria-hidden="true" />
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${id}-option-${String(active)}` : undefined}
        autoComplete="off"
        placeholder={es.doctor.shell.searchPlaceholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
        }}
        onKeyDown={onKeyDown}
      />
      {showList ? (
        <ul id={listId} role="listbox" className="patient-search__list" aria-label={es.doctor.shell.search}>
          {results.length === 0 ? (
            <li className="patient-search__empty" role="option" aria-selected={false} aria-disabled="true">
              {es.doctor.shell.noResults}
            </li>
          ) : (
            results.map((row, index) => (
              <li
                key={row.patientId}
                id={`${id}-option-${String(index)}`}
                role="option"
                aria-selected={index === active}
                className="patient-search__option"
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(row.patientId);
                }}
              >
                <span>{row.fullName}</span>
                <span className="patient-search__risk">{es.risk[row.riskTier]}</span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

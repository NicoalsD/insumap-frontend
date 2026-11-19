import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router';
import { initialsOf } from '@/app/shells/doctor/DoctorShell';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge } from '@/ui/Badge';
import { rangeTone } from '@/ui/rangeTone';
import { riskBadgeTone, type TriageItem } from '../triage/triageModel';

const SCROLL_SHARE = 0.9;

/**
 * The patients that need the doctor first (the queue's top rows) as cards that slide sideways,
 * like the landing's carousels. A card selects the patient (map and preview follow); its link opens
 * the record. The arrows scroll by a page; the row also scrolls by touch and keyboard.
 */
export function PriorityCarousel({
  rows,
  selectedId,
  onSelect,
}: {
  readonly rows: readonly TriageItem[];
  readonly selectedId: string | null;
  readonly onSelect: (patientId: string) => void;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const scroll = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth * SCROLL_SHARE, behavior: 'smooth' });
  };
  return (
    <section className="panel priority" aria-labelledby="priority-title">
      <header className="panel__header">
        <h2 id="priority-title">{es.doctor.dashboard.priority.title}</h2>
        <div className="priority__arrows">
          <button type="button" className="priority__arrow" aria-label={es.doctor.dashboard.priority.previous} onClick={() => { scroll(-1); }}>
            <ChevronLeft size="1.25rem" aria-hidden="true" />
          </button>
          <button type="button" className="priority__arrow" aria-label={es.doctor.dashboard.priority.next} onClick={() => { scroll(1); }}>
            <ChevronRight size="1.25rem" aria-hidden="true" />
          </button>
        </div>
      </header>
      <ul ref={trackRef} className="priority__track">
        {rows.map((row) => (
          <li key={row.patientId} className="priority-card" data-selected={row.patientId === selectedId || undefined} data-tier={row.riskTier}>
            <button
              type="button"
              className="priority-card__select"
              aria-label={format(es.doctor.dashboard.priority.select, { name: row.fullName })}
              aria-pressed={row.patientId === selectedId}
              onClick={() => {
                onSelect(row.patientId);
              }}
            />
            <div className="priority-card__head">
              <span className="priority-card__avatar" aria-hidden="true">
                {initialsOf(row.fullName)}
              </span>
              <div>
                <p className="priority-card__name">{row.fullName}</p>
                <Badge tone={riskBadgeTone(row.riskTier)}>{es.risk[row.riskTier]}</Badge>
              </div>
            </div>
            <div className="priority-card__facts">
              {row.lastReading ? (
                <Badge tone={rangeTone(row.lastReading.state)}>
                  {format(es.glucose.value, { value: row.lastReading.valueMgDl })}
                </Badge>
              ) : (
                <span className="priority-card__muted">{es.doctor.dashboard.priority.noReading}</span>
              )}
              <span className="priority-card__muted measure">
                {row.tirPct === null
                  ? es.doctor.dashboard.priority.noTir
                  : format(es.doctor.dashboard.priority.tir, { value: Math.round(row.tirPct) })}
              </span>
            </div>
            {row.reasons[0] ? <p className="priority-card__reason">{row.reasons[0].text}</p> : null}
            <Link
              to={`/doctor/patients/${row.patientId}`}
              className="priority-card__link"
              aria-label={format(es.doctor.dashboard.priority.openFor, { name: row.fullName })}
            >
              {es.doctor.dashboard.priority.open}
              <ArrowRight size="1em" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

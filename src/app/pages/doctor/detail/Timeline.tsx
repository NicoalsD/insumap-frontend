import { useState } from 'react';
import { Button } from '@/ui/Button';
import type { AlertDto, RecommendationDto } from '@/services/dto/clinical';
import type { ClinicalNoteDto } from '@/services/dto/care';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { EmptyState } from '@/ui/States';
import { TIMELINE_PAGE_SIZE } from './constants';
import { formatDateTime } from './format';
import type { LocalReading } from './model/readings';
import './Timeline.css';

export interface TimelineProps {
  /** Readings inside the window. */
  readonly readings: readonly LocalReading[];
  readonly alerts: readonly AlertDto[];
  readonly recommendations: readonly RecommendationDto[];
  readonly notes: readonly ClinicalNoteDto[];
  readonly timeZone: string;
}

interface Entry {
  readonly id: string;
  readonly at: Date;
  readonly text: string;
}

/**
 * Readings and events of the patient, newest first: each glucose reading, alerts opened, AI
 * suggestions created and clinical notes. The list is capped so a long window stays readable; the
 * cap is said in the text, never silently applied.
 *
 * Pattern: none (plain merge and sort of the patient's records).
 */
export function Timeline({ readings, alerts, recommendations, notes, timeZone }: TimelineProps) {
  const entries: Entry[] = [
    ...readings.map((reading, index) => ({
      id: `reading-${String(index)}`,
      at: reading.measuredAt,
      text: format(es.detail.timeline.reading, {
        value: reading.valueMgDl,
        state: es.glucose.ranges[reading.state],
      }),
    })),
    ...alerts.map((alert) => ({
      id: `alert-${alert.id}`,
      at: new Date(alert.opened_at),
      text: format(es.detail.timeline.alert, { type: es.doctor.alertType[alert.type] }),
    })),
    ...recommendations.map((recommendation) => ({
      id: `recommendation-${recommendation.id}`,
      at: new Date(recommendation.created_at),
      text: es.detail.timeline.recommendation,
    })),
    ...notes.map((note) => ({
      id: `note-${note.id}`,
      at: new Date(note.created_at),
      text: format(es.detail.timeline.note, { author: note.author_name }),
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const [visible, setVisible] = useState(TIMELINE_PAGE_SIZE);
  const shown = entries.slice(0, visible);

  return (
    <section className="panel" aria-labelledby="timeline-title">
      <header className="panel__header">
        <h2 id="timeline-title">{es.detail.timeline.title}</h2>
      </header>
      <div className="panel__body">
        {entries.length === 0 ? <EmptyState title={es.detail.timeline.empty} /> : null}
        {shown.length > 0 ? (
          <ol className="timeline">
            {shown.map((entry) => (
              <li key={entry.id} className="timeline__item">
                <time className="timeline__time" dateTime={entry.at.toISOString()}>
                  {formatDateTime(entry.at, timeZone)}
                </time>
                <span className="timeline__text">{entry.text}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {entries.length > shown.length ? (
          <div className="timeline__more">
            <p className="timeline__truncated">
              {format(es.detail.timeline.showing, { shown: shown.length, total: entries.length })}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setVisible((value) => value + TIMELINE_PAGE_SIZE);
              }}
            >
              {es.detail.timeline.showMore}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

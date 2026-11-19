import { useMemo } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { TargetProfileViewModel } from '@/services/adapters/TargetProfileViewModelAdapter';
import type { GlucoseReadingDto } from '@/services/dto/clinical';
import type { ReminderDto } from '@/services/dto/care';
import { classifyGlucose, type RangeState } from '@/core/glucose/thresholds';
import { RangeRuler } from '@/ui';
import { clockTime, relativeTime } from '../patientFormat';
import { buildDayChart } from './dayChartModel';
import './HomeLayers.css';

const DAY_HOURS = 24;
const POINT_RADIUS = 4;
const PERCENT_MAX = 100;

/** Layer 1: the last reading, large, with its state in text over the target ruler. */
export function LatestLayer({
  reading,
  profile,
  timeZone,
  now,
}: {
  readonly reading: GlucoseReadingDto | null;
  readonly profile: TargetProfileViewModel;
  readonly timeZone: string;
  readonly now: Date;
}) {
  const heading = es.patient.latest.title;
  if (reading === null) {
    return (
      <section className="patient-layer" aria-labelledby="layer-latest">
        <h2 id="layer-latest" className="patient-layer__title">{heading}</h2>
        <p className="patient-layer__body">{es.patient.latest.none}</p>
      </section>
    );
  }
  const measured = new Date(reading.measured_at);
  const state = stateOfReading(reading.value_mg_dl, profile);
  return (
    <section className="patient-layer latest" aria-labelledby="layer-latest" data-state={state}>
      <h2 id="layer-latest" className="patient-layer__title">{heading}</h2>
      <p className="latest__value">
        <span className="latest__number">{reading.value_mg_dl}</span>
        <span className="latest__unit">{es.glucose.unit}</span>
      </p>
      <p className="latest__state">
        <span className="latest__label">{es.glucose.ranges[state]}</span>
        <span className="latest__time">
          {format(es.patient.latest.measuredAgo, { time: relativeTime(measured, now) })}
          {' · '}
          {clockTime(measured, timeZone)}
        </span>
      </p>
      <p className="latest__help">{es.patient.latest.stateHelp[state]}</p>
      <RangeRuler valueMgDl={reading.value_mg_dl} thresholds={profile.thresholds} />
      {reading.status === 'FLAGGED' ? <p className="latest__flag">{es.patient.latest.flagged}</p> : null}
    </section>
  );
}

function stateOfReading(value: number, profile: TargetProfileViewModel): RangeState {
  return classifyGlucose(value, profile.thresholds);
}

/** Layer 3: today's readings over the target band, with a text summary for screen readers. */
export function DayLayer({
  readings,
  profile,
  timeZone,
  now,
}: {
  readonly readings: readonly GlucoseReadingDto[];
  readonly profile: TargetProfileViewModel;
  readonly timeZone: string;
  readonly now: Date;
}) {
  const chart = useMemo(
    () => buildDayChart(readings, profile.thresholds, now, timeZone),
    [readings, profile.thresholds, now, timeZone],
  );
  const { thresholds } = profile;
  const toX = (fraction: number) => fraction * chart.width;
  const toY = (fraction: number) => fraction * chart.height;

  return (
    <section className="patient-layer" aria-labelledby="layer-day">
      <h2 id="layer-day" className="patient-layer__title">{es.patient.dayChart.title}</h2>
      {chart.empty ? (
        <p className="patient-layer__body">{es.patient.dayChart.empty}</p>
      ) : (
        <svg
          className="day-chart"
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="img"
          aria-label={chart.summary}
        >
          <rect
            className="day-chart__band"
            x={0}
            width={chart.width}
            y={toY(chart.band.top)}
            height={toY(chart.band.bottom) - toY(chart.band.top)}
          >
            <title>{format(es.patient.dayChart.targetBand, { low: thresholds.rangeLowMgDl, high: thresholds.rangeHighMgDl })}</title>
          </rect>
          {chart.hourTicks.map((hour) => (
            <text key={hour} className="day-chart__tick" x={toX(hour / DAY_HOURS)} y={chart.height} textAnchor="middle">
              {format(es.patient.dayChart.hourLabel, { hour })}
            </text>
          ))}
          {chart.points.map((point) => (
            <circle
              key={point.id}
              className="day-chart__point"
              data-state={point.state}
              cx={toX(point.x)}
              cy={toY(point.y)}
              r={POINT_RADIUS}
            >
              <title>{format(es.patient.dayChart.point, { value: point.valueMgDl, time: point.time, state: es.glucose.ranges[point.state] })}</title>
            </circle>
          ))}
        </svg>
      )}
      {chart.empty ? null : <p className="patient-layer__body day-chart__summary">{chart.summary}</p>}
    </section>
  );
}

/** Layer 4: share of today's glucose in range over the last 7 days, as one bar with text. */
export function WeekLayer({
  tirPct,
  isSufficient,
  goalPct,
}: {
  readonly tirPct: number;
  readonly isSufficient: boolean;
  readonly goalPct: number;
}) {
  return (
    <section className="patient-layer" aria-labelledby="layer-week">
      <h2 id="layer-week" className="patient-layer__title">{es.patient.week.title}</h2>
      {isSufficient ? (
        <>
          <p className="week__value">
            <span className="week__label">{es.patient.week.inRangeLabel}</span>
            <span className="week__percent">{format(es.patient.week.percent, { value: Math.round(tirPct) })}</span>
          </p>
          <div className="week__bar" role="img" aria-label={format(es.patient.week.bar, { value: Math.round(tirPct) })}>
            <span className="week__fill" style={{ inlineSize: `${Math.min(Math.max(tirPct, 0), PERCENT_MAX)}%` }} />
          </div>
          <p className="patient-layer__body">{format(es.patient.week.goal, { goal: Math.round(goalPct) })}</p>
        </>
      ) : (
        <p className="patient-layer__body">{es.patient.week.insufficient}</p>
      )}
    </section>
  );
}

/** Layer 5: today's reminders with a switch each. The plan can lock some of them. */
export function RemindersLayer({
  reminders,
  onToggle,
  pendingId,
  errorMessage,
}: {
  readonly reminders: readonly ReminderDto[];
  readonly onToggle: (reminder: ReminderDto) => void;
  readonly pendingId: string | null;
  readonly errorMessage: string | null;
}) {
  const sorted = [...reminders].sort((a, b) => a.time_of_day.localeCompare(b.time_of_day));
  return (
    <section className="patient-layer" aria-labelledby="layer-reminders">
      <h2 id="layer-reminders" className="patient-layer__title">{es.patient.reminders.title}</h2>
      {sorted.length === 0 ? (
        <p className="patient-layer__body">{es.patient.reminders.empty}</p>
      ) : (
        <ul className="reminders">
          {sorted.map((reminder) => (
            <li key={reminder.id} className="reminders__item">
              <div className="reminders__text">
                <p className="reminders__label">{reminder.label}</p>
                <p className="reminders__time">{reminder.time_of_day}</p>
              </div>
              <button
                type="button"
                role="switch"
                className="reminders__switch"
                aria-checked={reminder.enabled}
                aria-label={format(es.patient.reminders.toggleLabel, { label: reminder.label, time: reminder.time_of_day })}
                disabled={pendingId === reminder.id}
                onClick={() => { onToggle(reminder); }}
              >
                {reminder.enabled ? es.patient.reminders.on : es.patient.reminders.off}
              </button>
            </li>
          ))}
        </ul>
      )}
      {errorMessage ? <p role="alert" className="patient-layer__body">{errorMessage}</p> : null}
    </section>
  );
}

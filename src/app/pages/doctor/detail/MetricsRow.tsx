import { useId } from 'react';
import type { GlycemicMetricsDto } from '@/services/dto/clinical';
import type { MetricsViewModel } from '@/services/adapters/MetricsViewModelAdapter';
import { windowToDays } from '@/services/adapters/MetricsViewModelAdapter';
import type { MetricsWindow } from '@/services/dto/common';
import { RangeBand } from '@/ui/glucose/RangeBand';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { WINDOW_OPTIONS } from './constants';
import './MetricsRow.css';

export interface MetricsRowProps {
  readonly window: MetricsWindow;
  readonly onWindow: (window: MetricsWindow) => void;
  readonly metrics: MetricsViewModel;
  readonly current: GlycemicMetricsDto;
  /** The window before this one, when the API sends it. */
  readonly previous: GlycemicMetricsDto | undefined;
}

/** One decimal place: deltas of percentages and mg/dL are read to the tenth. */
const DECIMAL_FACTOR = 10;

/**
 * Delta of one metric against the previous window, as the text the doctor reads, or `null` when
 * there is nothing to compare: the window has no previous value, or the metric does not apply.
 * The sign is part of the template ("+{value}" or "−{value}"), so the wording stays in `es.detail`.
 */
function deltaText(current: number, previous: number | undefined, unit: string): string | null {
  if (previous === undefined) return null;
  const delta = Math.round((current - previous) * DECIMAL_FACTOR) / DECIMAL_FACTOR;
  if (delta === 0) return es.detail.metrics.deltaNone;
  const template = delta > 0 ? es.detail.metrics.deltaUp : es.detail.metrics.deltaDown;
  return format(template, { value: format('{value}', { value: Math.abs(delta) }), unit });
}

/**
 * Window selector, time-in-ranges bar and the scalar metrics. Each figure shows its delta against
 * the previous window only where the API sent one; without a previous window one note under the
 * title says so, instead of repeating it on every figure.
 */
export function MetricsRow({ window, onWindow, metrics, current, previous }: MetricsRowProps) {
  const groupName = useId();
  const percent = (value: number) => format(es.glucose.percent, { value });
  const points = es.detail.metrics.unitPoints;
  const notApplicable = es.detail.metrics.notApplicable;
  const items: { key: string; label: string; value: string; delta: string | null }[] = [
    {
      key: 'tir',
      label: es.detail.metrics.tir,
      value: percent(current.tir_pct),
      delta: deltaText(current.tir_pct, previous?.tir_pct, points),
    },
    {
      key: 'tbr',
      label: es.detail.metrics.tbr,
      value: percent(current.tbr_pct),
      delta: deltaText(current.tbr_pct, previous?.tbr_pct, points),
    },
    {
      key: 'tar',
      label: es.detail.metrics.tar,
      value: percent(current.tar_pct),
      delta: deltaText(current.tar_pct, previous?.tar_pct, points),
    },
    {
      key: 'mean',
      label: es.detail.metrics.mean,
      value: format('{value} {unit}', { value: current.mean_glucose_mg_dl, unit: es.detail.unit }),
      delta: deltaText(current.mean_glucose_mg_dl, previous?.mean_glucose_mg_dl, es.detail.metrics.unitMgDl),
    },
    {
      key: 'gmi',
      label: es.detail.metrics.gmi,
      value: current.gmi_pct === null ? notApplicable : percent(current.gmi_pct),
      delta: current.gmi_pct === null ? null : deltaText(current.gmi_pct, previous?.gmi_pct ?? undefined, points),
    },
    {
      key: 'cv',
      label: es.detail.metrics.cv,
      value: current.cv_pct === null ? notApplicable : percent(current.cv_pct),
      delta: current.cv_pct === null ? null : deltaText(current.cv_pct, previous?.cv_pct ?? undefined, points),
    },
    {
      key: 'hypo',
      label: es.detail.metrics.hypo,
      value: format('{value}', { value: current.hypo_events_count }),
      delta: deltaText(current.hypo_events_count, previous?.hypo_events_count, es.detail.metrics.unitEvents),
    },
  ];

  return (
    <section className="panel metrics-row" aria-labelledby="metrics-title">
      <header className="panel__header">
        <h2 id="metrics-title">{es.detail.metrics.title}</h2>
        <fieldset className="metrics-row__window">
          <legend className="visually-hidden">{es.detail.header.windowLabel}</legend>
          {WINDOW_OPTIONS.map((option) => (
            <label key={option} className="metrics-row__option">
              <input
                type="radio"
                name={groupName}
                value={option}
                checked={window === option}
                onChange={() => {
                  onWindow(option);
                }}
              />
              <span>{format(es.detail.header.windowOption, { days: windowToDays(option) ?? 0 })}</span>
            </label>
          ))}
        </fieldset>
      </header>
      {previous === undefined ? <p className="metrics-row__note">{es.detail.metrics.deltaUnavailable}</p> : null}
      <div className="panel__body metrics-row__body">
        <RangeBand timeInRanges={metrics.timeInRanges} thresholds={metrics.profile.thresholds} variant="full" />
        <dl className="metrics-row__figures">
          {items.map((item) => (
            <div key={item.key} className="metrics-row__figure">
              <dt>{item.label}</dt>
              <dd className="measure">{item.value}</dd>
              {item.delta === null ? null : <dd className="metrics-row__delta">{item.delta}</dd>}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

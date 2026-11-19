import { useMemo } from 'react';
import { chartRenderer } from '@/core/charts/chartRenderer';
import { TimeInRangesBandStrategy, type RangeBandModel } from '@/core/charts/TimeInRangesBandStrategy';
import type { TimeInRanges } from '@/core/glucose/timeInRanges';
import { rangeBounds, type GlucoseThresholds, type RangeBounds } from '@/core/glucose/thresholds';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import './RangeBand.css';

export interface RangeBandProps {
  /** Percentages per range state, from the API metrics (`tbr_l2`, `tbr_l1`, `tir`, `tar_l1`, `tar_l2`). */
  timeInRanges: TimeInRanges;
  /** Cut points of the patient's target profile, shown in the legend ("70 a 179 mg/dL"). */
  thresholds: GlucoseThresholds;
  /** `compact` is the bar of a triage row: no legend, labels only where they fit. */
  variant?: 'full' | 'compact';
  /** Overrides the default title ("Tiempo en rangos, últimos 14 días"). */
  title?: string;
}

const listFormat = new Intl.ListFormat('es-CO', { style: 'narrow', type: 'conjunction' });

function limitsText(bounds: RangeBounds): string {
  const template = es.glucose.rangeLimits[bounds.state];
  return format(template, { min: bounds.minMgDl ?? 0, max: bounds.maxMgDl ?? 0 });
}

/**
 * Time-in-ranges stacked bar, the "range band" signature of Insumap. Segments are proportional;
 * the percentage is written inside each segment that has room, and always in the legend with the
 * state name and its mg/dL limits, so no range depends on color alone. It paints the model of
 * `TimeInRangesBandStrategy` and refuses to draw percentages when the data is insufficient.
 */
export function RangeBand({ timeInRanges, thresholds, variant = 'full', title }: RangeBandProps) {
  const model = useMemo<RangeBandModel>(
    () => chartRenderer.render(TimeInRangesBandStrategy.KIND, timeInRanges),
    [timeInRanges],
  );
  const bounds = useMemo(() => rangeBounds(thresholds), [thresholds]);
  const heading =
    title ??
    (timeInRanges.windowDays === null
      ? es.glucose.timeInRanges
      : format(es.glucose.timeInRangesWindow, { days: timeInRanges.windowDays }));

  if (model.status === 'insufficient') {
    return (
      <figure className="range-band" data-variant={variant}>
        <figcaption className="range-band__title">{heading}</figcaption>
        <p className="range-band__insufficient">
          {format(es.glucose.insufficientData, { pct: model.dataSufficiencyPct })}
        </p>
      </figure>
    );
  }

  const percentText = (value: number) => format(es.glucose.percent, { value });
  const summary = listFormat.format(
    model.legend.map((item) => `${es.glucose.ranges[item.state]} ${percentText(item.percent)}`),
  );

  return (
    <figure className="range-band" data-variant={variant}>
      <figcaption className="range-band__title">{heading}</figcaption>
      <div className="range-band__bar" role="img" aria-label={`${heading}: ${summary}`}>
        {model.segments.map((segment) => (
          <span
            key={segment.state}
            className="range-band__segment"
            data-state={segment.state}
            style={{ '--segment-width': segment.widthPct } as React.CSSProperties}
            title={`${es.glucose.ranges[segment.state]} ${percentText(segment.percent)}`}
          >
            {segment.showInlineLabel ? percentText(segment.percent) : null}
          </span>
        ))}
      </div>
      {variant === 'full' ? (
        <ul className="range-band__legend">
          {model.legend.map((item, index) => (
            <li key={item.state} className="range-band__item" data-state={item.state}>
              <span className="range-band__swatch range-band__segment" data-state={item.state} aria-hidden="true" />
              <span className="range-band__name">{es.glucose.ranges[item.state]}</span>
              <span className="range-band__percent">{percentText(item.percent)}</span>
              <span className="range-band__limits">{limitsText(bounds[index] as RangeBounds)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {model.lowConfidence ? <p className="range-band__note">{es.glucose.lowConfidence}</p> : null}
    </figure>
  );
}

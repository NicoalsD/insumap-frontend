import { useMemo } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { triageCharts } from './triageCharts';
import { AgpBandStrategy, type AgpBandInput, type AgpBandModel, type AgpPoint } from './agp/AgpBandStrategy';
import './AgpBand.css';

export interface AgpBandProps extends AgpBandInput {
  readonly title?: string;
}

const PERCENT = 100;

const toPoints = (points: readonly AgpPoint[]): string => points.map((p) => `${p.x},${p.y}`).join(' ');

/**
 * 24-hour glucose profile of a patient (AGP): median line over the 25 to 75 % band, with the target
 * range shaded behind. The geometry comes from `AgpBandStrategy`; this component only paints it.
 * The chart is `aria-hidden` and a summary sentence carries the meaning, so screen readers get
 * the same information as sighted users.
 */
export function AgpBand(props: AgpBandProps) {
  const { bins, targetLowMgDl, targetHighMgDl, isSufficient } = props;
  const model = useMemo<AgpBandModel>(
    () => triageCharts.render(AgpBandStrategy.KIND, { bins, targetLowMgDl, targetHighMgDl, isSufficient }),
    [bins, targetLowMgDl, targetHighMgDl, isSufficient],
  );

  if (model.status === 'empty') {
    return (
      <figure className="agp-band">
        <figcaption className="agp-band__title">{es.doctor.agp.title}</figcaption>
        <p className="agp-band__empty">{es.doctor.agp.empty}</p>
      </figure>
    );
  }

  const summary = format(es.doctor.agp.summary, { low: props.targetLowMgDl, high: props.targetHighMgDl });
  return (
    <figure className="agp-band">
      <figcaption className="agp-band__title">{props.title ?? es.doctor.agp.title}</figcaption>
      {/* The SVG is decorative: the summary paragraph below carries the same information. */}
      <svg className="agp-band__svg" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <rect
          className="agp-band__target"
          x="0"
          y={model.targetTopY}
          width="1"
          height={Math.max(0, model.targetBottomY - model.targetTopY)}
        />
        <polygon className="agp-band__iqr" points={toPoints(model.band)} />
        <polyline className="agp-band__median" points={toPoints(model.median)} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="agp-band__axis" aria-hidden="true">
        {model.ticks.map((tick) => (
          <span key={tick.x} className="agp-band__tick" style={{ left: `${String(tick.x * PERCENT)}%` }}>
            {format(es.doctor.agp.hourTick, { hour: tick.hour })}
          </span>
        ))}
      </div>
      <p className="agp-band__summary">{summary}</p>
    </figure>
  );
}

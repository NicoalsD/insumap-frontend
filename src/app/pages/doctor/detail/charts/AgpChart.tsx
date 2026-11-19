import { useMemo, useState, type KeyboardEvent } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { ErrorState, LoadingState } from '@/ui/States';
import { detailCharts } from './detailCharts';
import { asPercent, PatientAgpStrategy, type AgpPoint, type PatientAgpInput, type PatientAgpModel } from './PatientAgpStrategy';
import './AgpChart.css';

export interface AgpChartProps {
  readonly input: PatientAgpInput | null;
  readonly loading: boolean;
  readonly error: unknown;
  readonly onRetry: () => void;
}

/**
 * 24-hour glucose profile: median line, the 25 to 75 % and 5 to 95 % bands, and the target range
 * shaded behind them. The geometry comes from `PatientAgpStrategy` through `detailCharts`; this
 * component paints it. A cursor moves along the day with the arrow keys (Home and End jump to the
 * ends); its values are written as text, so a screen reader hears what sighted users see.
 */
export function AgpChart({ input, loading, error, onRetry }: AgpChartProps) {
  const model = useMemo<PatientAgpModel | null>(
    () => (input ? detailCharts.render(PatientAgpStrategy.KIND, input) : null),
    [input],
  );
  const [cursor, setCursor] = useState(0);

  if (error) {
    return (
      <section className="panel agp-chart" aria-labelledby="agp-title">
        <header className="panel__header">
          <h2 id="agp-title">{es.detail.agp.title}</h2>
        </header>
        <div className="panel__body">
          <ErrorState error={error} title={es.detail.agp.errorTitle} onRetry={onRetry} />
        </div>
      </section>
    );
  }

  if (loading || !model) {
    return (
      <section className="panel agp-chart" aria-labelledby="agp-title">
        <header className="panel__header">
          <h2 id="agp-title">{es.detail.agp.title}</h2>
        </header>
        <div className="panel__body">
          <LoadingState />
        </div>
      </section>
    );
  }

  if (model.status === 'empty' || !input) {
    return (
      <section className="panel agp-chart" aria-labelledby="agp-title">
        <header className="panel__header">
          <h2 id="agp-title">{es.detail.agp.title}</h2>
        </header>
        <div className="panel__body">
          <p className="agp-chart__empty">{es.detail.agp.empty}</p>
        </div>
      </section>
    );
  }

  const last = model.points.length - 1;
  const point: AgpPoint | undefined = model.points[Math.min(cursor, last)];
  const summary = format(es.detail.agp.summary, { low: input.target.low, high: input.target.high });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number | undefined> = {
      ArrowLeft: cursor - 1,
      ArrowRight: cursor + 1,
      Home: 0,
      End: last,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setCursor(Math.min(Math.max(next, 0), last));
  };
  const tooltip = point
    ? format(es.detail.agp.tooltip, {
        time: point.timeOfDay,
        p50: point.p50,
        p25: point.p25,
        p75: point.p75,
        p5: point.p5,
        p95: point.p95,
      })
    : '';

  return (
    <section className="panel agp-chart" aria-labelledby="agp-title">
      <header className="panel__header">
        <h2 id="agp-title">{es.detail.agp.title}</h2>
      </header>
      <figure className="panel__body agp-chart__figure">
        <div
          className="agp-chart__plot"
          role="slider"
          tabIndex={0}
          aria-label={es.detail.agp.cursorLabel}
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={Math.min(cursor, last)}
          aria-valuetext={tooltip}
          onKeyDown={onKeyDown}
        >
          {/* The SVG is decorative: the summary and the tooltip carry its meaning. */}
          <svg className="agp-chart__svg" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <rect
              className="agp-chart__target"
              x="0"
              y={model.targetTopY}
              width="1"
              height={Math.max(0, model.targetBottomY - model.targetTopY)}
            />
            <polygon className="agp-chart__outer" points={model.outerBand.map((p) => `${p.x},${p.y}`).join(' ')} />
            <polygon className="agp-chart__inner" points={model.innerBand.map((p) => `${p.x},${p.y}`).join(' ')} />
            <polyline
              className="agp-chart__median"
              points={model.median.map((p) => `${p.x},${p.y}`).join(' ')}
              vectorEffect="non-scaling-stroke"
            />
            {point ? (
              <line
                className="agp-chart__cursor"
                x1={point.x}
                x2={point.x}
                y1="0"
                y2="1"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>
          {model.ticks.map((tick) => (
            <span key={tick.hour} className="agp-chart__tick" style={{ left: asPercent(tick.x) }} aria-hidden="true">
              {format(es.detail.agp.hourTick, { hour: tick.hour })}
            </span>
          ))}
        </div>
        <p className="agp-chart__tooltip">{tooltip}</p>
        <figcaption className="agp-chart__summary">{summary}</figcaption>
      </figure>
    </section>
  );
}

import { useMemo } from 'react';
import { chartRenderer } from '@/core/charts/chartRenderer';
import { GlucoseRulerStrategy, type GlucoseRulerModel } from '@/core/charts/GlucoseRulerStrategy';
import type { GlucoseThresholds } from '@/core/glucose/thresholds';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import './RangeRuler.css';

export interface RangeRulerProps {
  /** Reading in mg/dL (the API always answers in mg/dL). */
  valueMgDl: number;
  /** Cut points of the patient's target profile. The ruler never assumes any. */
  thresholds: GlucoseThresholds;
  /** `compact` is the ruler of a triage row. */
  size?: 'default' | 'compact';
  /** Shows "Rango objetivo: 70 a 180 mg/dL" below the ruler. */
  showTarget?: boolean;
}

/**
 * One glucose value placed on the patient's target range. The value, the unit mg/dL and the state
 * name are written in text; the marker and the five tinted bands only reinforce them. It paints the
 * model of `GlucoseRulerStrategy`.
 */
export function RangeRuler({ valueMgDl, thresholds, size = 'default', showTarget = true }: RangeRulerProps) {
  const model = useMemo<GlucoseRulerModel>(
    () => chartRenderer.render(GlucoseRulerStrategy.KIND, { valueMgDl, thresholds }),
    [valueMgDl, thresholds],
  );
  const stateLabel = es.glucose.ranges[model.state];

  return (
    <div className="range-ruler" data-state={model.state} data-size={size} role="group" aria-label={format(es.glucose.readingOnRange, { value: valueMgDl, state: stateLabel })}>
      <p className="range-ruler__reading">
        <span className="range-ruler__value">{format('{value}', { value: valueMgDl })}</span>
        <span className="range-ruler__unit">{es.glucose.unit}</span>
        <span className="range-ruler__state">{stateLabel}</span>
      </p>
      <div className="range-ruler__track" aria-hidden="true">
        {model.bands.map((band) => (
          <span key={band.state} className="range-ruler__band" data-state={band.state} />
        ))}
        <span className="range-ruler__marker" style={{ '--marker': model.markerPct } as React.CSSProperties} />
      </div>
      {size === 'default' ? (
        <div className="range-ruler__ticks" aria-hidden="true">
          {model.cutPoints.map((cut, index) => (
            <span
              key={cut}
              className="range-ruler__tick"
              style={{ '--tick': (index + 1) * (model.bands[0]?.widthPct ?? 0) } as React.CSSProperties}
            >
              {cut}
            </span>
          ))}
        </div>
      ) : null}
      {model.clamped ? (
        <p className="range-ruler__clamp">
          {model.clamped === 'below' ? es.glucose.belowScale : es.glucose.aboveScale}
        </p>
      ) : null}
      {showTarget && size === 'default' ? (
        <p className="range-ruler__target">
          {format(es.glucose.targetRange, { low: thresholds.rangeLowMgDl, high: thresholds.rangeHighMgDl })}
        </p>
      ) : null}
    </div>
  );
}

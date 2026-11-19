import { es } from '@/i18n/es';
import type { CSSProperties } from 'react';
import { LOCALE } from '@/i18n/format';
import type { TirSegment } from './art/demoContent';

const PERCENT_BASE = 100;
const percentFormat = new Intl.NumberFormat(LOCALE, { style: 'percent' });
const toShare = (percent: number): string => percentFormat.format(percent / PERCENT_BASE);

/**
 * Stacked time-in-range bar. Colors never carry the meaning alone: the list exposes each state's
 * name and share to assistive tech, and `showLegend` prints the in-range share as text.
 */
export function TirBand({ segments, label, showLegend = false }: { segments: readonly TirSegment[]; label: string; showLegend?: boolean }) {
  const inRange = segments.find((segment) => segment.state === 'IN_RANGE');
  return (
    <div className="grid gap-1.5">
      <ul className="lp-band" aria-label={label}>
        {segments.map((segment) => (
          <li
            key={segment.state}
            data-state={segment.state}
            data-share={segment.percent}
            style={{ '--lp-share': segment.percent } as CSSProperties}
          >
            <span className="visually-hidden">{`${es.glucose.ranges[segment.state]}: ${toShare(segment.percent)}`}</span>
          </li>
        ))}
      </ul>
      {showLegend && inRange ? (
        <p className="lp-band-legend" aria-hidden="true">
          <span data-state="IN_RANGE" className="lp-state">{es.glucose.ranges.IN_RANGE}</span>
          <span>{toShare(inRange.percent)}</span>
        </p>
      ) : null}
    </div>
  );
}

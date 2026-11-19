import { useMemo } from 'react';
import { chartRenderer } from '@/core/charts/chartRenderer';
import { TimeInRangesBandStrategy, type RangeBandModel } from '@/core/charts/TimeInRangesBandStrategy';
import type { TimeInRanges } from '@/core/glucose/timeInRanges';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge } from '@/ui/Badge';
import './TirBar.css';

export interface TirBarProps {
  readonly timeInRanges: TimeInRanges;
}

/**
 * Time in ranges of the window for a queue row. Every state with a share is named in text under the
 * bar (state, percent), so no segment depends on its width or color. Segments get a minimum visible
 * width, so a 1 % share is still a mark, not a 4 px sliver. The bar is decorative (`aria-hidden`).
 *
 * Pattern: P19 Strategy (reuses `TimeInRangesBandStrategy`)
 */
export function TirBar({ timeInRanges }: TirBarProps) {
  const model = useMemo<RangeBandModel>(
    () => chartRenderer.render(TimeInRangesBandStrategy.KIND, timeInRanges),
    [timeInRanges],
  );

  if (model.status === 'insufficient') {
    return <Badge tone="warning">{es.doctor.triage.tirInsufficient}</Badge>;
  }

  const summary = model.legend
    .filter((item) => item.percent > 0)
    .map((item) => `${es.glucose.ranges[item.state]} ${format(es.glucose.percent, { value: item.percent })}`)
    .join(' · ');

  return (
    <div className="tir-bar" title={summary}>
      <div className="tir-bar__track" aria-hidden="true">
        {model.segments.map((segment) => (
          <span
            key={segment.state}
            className="tir-bar__segment"
            data-state={segment.state}
            style={{ '--segment-width': segment.widthPct } as React.CSSProperties}
          />
        ))}
      </div>
      <p className="tir-bar__text">{summary}</p>
    </div>
  );
}

import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { DetectedPattern, PatternRules } from './model/patterns';
import { PATTERN_MIN_REPEATED_DAYS } from './constants';

export interface PatternsPanelProps {
  readonly patterns: readonly DetectedPattern[];
  /** The rules the profile allows; missing fields mean the matching pattern was not computed. */
  readonly rules: PatternRules;
  readonly computed: { readonly night: boolean; readonly postprandial: boolean };
}

/**
 * Patterns that repeat across days, with the profile's thresholds. The text states the cut points
 * and the number of days, so the doctor can check the claim against the sensor chart.
 *
 * Pattern: none (presentation of `detectPatterns`).
 */
export function PatternsPanel({ patterns, rules, computed }: PatternsPanelProps) {
  return (
    <section className="panel" aria-labelledby="patterns-title">
      <header className="panel__header">
        <h2 id="patterns-title">{es.detail.patterns.title}</h2>
      </header>
      <div className="panel__body">
        <p>{format(es.detail.patterns.intro, { min: rules.minRepeatedDays ?? PATTERN_MIN_REPEATED_DAYS })}</p>
        {patterns.length === 0 ? <p>{es.detail.patterns.empty}</p> : null}
        {patterns.length > 0 ? (
          <ul className="patterns-panel__list">
            {patterns.map((pattern, index) => (
              <li key={`${pattern.kind}-${String(index)}`}>
                {pattern.kind === 'NIGHT_HYPO' && rules.night
                  ? format(es.detail.patterns.night, {
                      days: pattern.days,
                      observed: pattern.observedDays,
                      low: rules.rangeLowMgDl,
                      start: rules.night.start,
                      end: rules.night.end,
                    })
                  : null}
                {pattern.kind === 'REPEATED_HIGH_AT_HOUR' && rules.postprandialMaxMgDl !== null
                  ? format(es.detail.patterns.spike, {
                      from: pattern.fromHour,
                      to: pattern.toHour,
                      days: pattern.days,
                      observed: pattern.observedDays,
                      max: rules.postprandialMaxMgDl,
                    })
                  : null}
              </li>
            ))}
          </ul>
        ) : null}
        {!computed.night || !computed.postprandial ? <p>{es.detail.patterns.notComputed}</p> : null}
      </div>
    </section>
  );
}

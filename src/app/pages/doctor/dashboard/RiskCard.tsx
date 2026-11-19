import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { TriageItem } from '../triage/triageModel';

const TIERS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const PERCENT = 100;
/** An empty tier still shows a sliver, so the bar is visibly zero and not missing. */
const MIN_BAR_PCT = 4;

/**
 * How the assigned patients spread over the four risk tiers, as labelled bars (count in text, never
 * color alone), on the night ink of the landing's dark zones.
 */
export function RiskCard({ rows }: { readonly rows: readonly TriageItem[] }) {
  const counts = TIERS.map((tier) => ({ tier, count: rows.filter((row) => row.riskTier === tier).length }));
  const max = Math.max(1, ...counts.map((item) => item.count));
  const urgent = rows.filter((row) => row.riskTier === 'HIGH' || row.riskTier === 'CRITICAL').length;
  return (
    <section className="risk-card" aria-labelledby="risk-card-title">
      <h2 id="risk-card-title" className="risk-card__title">
        {es.doctor.dashboard.risk.title}
      </h2>
      <ul className="risk-card__bars">
        {counts.map(({ tier, count }) => (
          <li key={tier} className="risk-card__bar" data-tier={tier}>
            <span className="risk-card__value measure">{count}</span>
            <span
              className="risk-card__fill"
              style={{ blockSize: `${String(Math.max(MIN_BAR_PCT, (count / max) * PERCENT))}%` }}
              role="img"
              aria-label={format(es.doctor.dashboard.risk.bar, { tier: es.risk[tier], count })}
            />
            <span className="risk-card__tier">{es.risk[tier]}</span>
          </li>
        ))}
      </ul>
      <p className="risk-card__summary">
        {format(es.doctor.dashboard.risk.summary, { count: urgent, total: rows.length })}
      </p>
    </section>
  );
}

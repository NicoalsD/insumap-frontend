import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge } from '@/ui/Badge';
import './TirValue.css';

const PERCENT_MAX = 100;

/**
 * Time in range of the window for a queue row: the number and a plain meter. The triage list does
 * not carry the split below and above range, so the band by state lives in the patient preview.
 * The meter is decorative (`aria-hidden`); the number says everything.
 */
export function TirValue({ tirPct }: { readonly tirPct: number | null }) {
  if (tirPct === null) return <Badge tone="warning">{es.doctor.triage.tirInsufficient}</Badge>;
  const clamped = Math.min(PERCENT_MAX, Math.max(0, tirPct));
  return (
    <div className="tir-value">
      <span className="tir-value__text measure">{format(es.glucose.percent, { value: Math.round(clamped) })}</span>
      <span className="tir-value__track" aria-hidden="true">
        <span className="tir-value__fill" style={{ inlineSize: `${clamped}%` }} />
      </span>
    </div>
  );
}
